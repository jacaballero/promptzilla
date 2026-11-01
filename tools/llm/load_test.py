#!/usr/bin/env python3
"""Prueba de carga concurrente contra el LLM del juego.

Lee la MISMA configuración que usa Promptzilla (config.default.js + el opcional
config.js, con el mismo deep-merge que boot.js) y construye las peticiones según
el `provider` ("ollama" o "openai"/vLLM). Así el test simula exactamente lo que
haría el juego en producción, sin duplicar endpoint, modelo ni prompts.
"""

import json
import os
import socket
import subprocess
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- Knobs del test (no forman parte de la config del juego) ----------------
TOTAL_REQUESTS = 30              # Nº total de peticiones a lanzar
MAX_CONCURRENT = None            # None = usar llm.maxConcurrent del config
# Ojo: el 1er request hace "cold start" (el servidor carga el modelo) y bajo
# carga concurrente el 2º lote del pool tarda mucho más; deja margen holgado.
TIMEOUT_S = 120                  # Timeout por petición (segundos)
PRINT_RESPONSES = False          # Imprimir el texto de cada respuesta
MODE = "direct"                  # "direct" | "socratic" (elige modeInstructions)

# Si el endpoint del config es RELATIVO (p.ej. "/v1/chat/completions"), se llama
# a través del proxy del juego, igual que los alumnos. Por defecto el contenedor
# local; cámbialo con la variable de entorno LOAD_TEST_BASE_URL (sin barra final).
BASE_URL = os.environ.get("LOAD_TEST_BASE_URL", "http://localhost:8080")
LANGUAGE = "Spanish"            # sustituye {language} en los prompts del config

# Prompt ~300 caracteres sobre HTML básico.
PROMPT = (
    "Explica de forma breve y clara qué es HTML y para qué sirve en una página web. "
    "Describe qué es una etiqueta, la diferencia entre etiquetas de apertura y cierre, "
    "y menciona tres etiquetas habituales. Por último, pon un ejemplo sencillo de la "
    "estructura mínima de un documento HTML válido."
)
# ---------------------------------------------------------------------------


def load_llm_config():
    """Carga y fusiona la config del juego (via Node) y devuelve el bloque llm."""
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(os.path.dirname(here))  # tools/llm/ -> raíz del proyecto
    node_script = r"""
      globalThis.window = {};
      const path = require('path');
      const root = process.argv[1];
      require(path.join(root, 'config.default.js'));
      // config.js es opcional (override local, gitignored).
      try { require(path.join(root, 'config.js')); } catch (e) {}
      function isObject(v){ return v && typeof v === 'object' && !Array.isArray(v); }
      function deepMerge(base, override){
        const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
        if (!isObject(override)) return out;
        Object.keys(override).forEach(k => {
          out[k] = (isObject(out[k]) && isObject(override[k]))
            ? deepMerge(out[k], override[k]) : override[k];
        });
        return out;
      }
      const cfg = deepMerge(window.APP_CONFIG_DEFAULT || {}, window.APP_CONFIG || {});
      process.stdout.write(JSON.stringify(cfg.llm || {}));
    """
    out = subprocess.run(
        ["node", "-e", node_script, root],
        capture_output=True, text=True, check=True,
    )
    return json.loads(out.stdout)


def resolve_endpoint(cfg):
    """Devuelve la URL absoluta a la que llamar, resolviendo endpoints relativos."""
    endpoint = cfg.get("endpoint", "")
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint
    if not BASE_URL:
        raise SystemExit(
            f"El endpoint del config es relativo ('{endpoint}') y BASE_URL está vacío. "
            "Rellena BASE_URL con el host del backend."
        )
    return BASE_URL.rstrip("/") + "/" + endpoint.lstrip("/")


def localize(value):
    """Igual que LLM.localize: texto o {es, en}, con {language} sustituido."""
    if isinstance(value, dict):
        value = value.get("es") or next(iter(value.values()), "")
    return (value or "").replace("{language}", LANGUAGE)


def system_prompt(cfg):
    """system base + la instrucción del modo activo (igual que llm.js)."""
    base = localize(cfg.get("system"))
    instr = localize((cfg.get("modeInstructions", {}) or {}).get(MODE))
    return f"{base}{instr}"


def build_payload(cfg):
    """Construye el body según el provider, replicando llm.js (stream desactivado)."""
    user_prompt = f"{PROMPT}{localize(cfg.get('brevitySuffix'))}"
    max_tokens = cfg.get("maxTokens", 256)
    temperature = cfg.get("temperature", 0.6)

    if cfg.get("provider") == "openai":
        return {
            "model": cfg.get("model"),
            "messages": [
                {"role": "system", "content": system_prompt(cfg)},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

    payload = {
        "model": cfg.get("model"),
        "system": system_prompt(cfg),
        "prompt": user_prompt,
        "stream": False,
        "options": {"num_predict": max_tokens, "temperature": temperature},
    }
    # `think` solo lo aceptan modelos de razonamiento (qwen3, deepseek-r1).
    if isinstance(cfg.get("think"), bool):
        payload["think"] = cfg["think"]
    return payload


def parse_response(cfg, data, latency):
    """Extrae texto y tokens/s de la respuesta según el provider."""
    if cfg.get("provider") == "openai":
        choices = data.get("choices") or [{}]
        text = (choices[0].get("message") or {}).get("content", "")
        completion = (data.get("usage") or {}).get("completion_tokens") or 0
        # vLLM no devuelve duración de generación: aproximamos con la latencia.
        tokens_per_s = (completion / latency) if latency else 0.0
        return text, tokens_per_s

    text = data.get("response", "")
    eval_count = data.get("eval_count") or 0
    eval_duration_ns = data.get("eval_duration") or 0
    tokens_per_s = (eval_count / (eval_duration_ns / 1e9)) if eval_duration_ns else 0.0
    return text, tokens_per_s


def _is_timeout(exc):
    """True si el fallo es un timeout, aunque venga envuelto en URLError."""
    if isinstance(exc, (TimeoutError, socket.timeout)):
        return True
    reason = getattr(exc, "reason", None)
    return isinstance(reason, (TimeoutError, socket.timeout))


def do_request(idx, url, headers, payload_bytes, cfg):
    """Lanza una petición y devuelve un dict con métricas y resultado."""
    req = urllib.request.Request(url, data=payload_bytes, headers=headers)
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        latency = time.perf_counter() - start
        text, tokens_per_s = parse_response(cfg, data, latency)
        return {
            "idx": idx,
            "ok": True,
            "latency": latency,
            "tokens_per_s": tokens_per_s,
            "text": text,
            "error": None,
        }
    except Exception as exc:  # noqa: BLE001 - queremos registrar cualquier fallo
        elapsed = time.perf_counter() - start
        if isinstance(exc, urllib.error.HTTPError):
            error = f"HTTP {exc.code} {exc.reason}"
        elif _is_timeout(exc):
            error = f"timeout tras {elapsed:.1f}s (>TIMEOUT_S={TIMEOUT_S})"
        else:
            error = repr(exc)
        return {
            "idx": idx,
            "ok": False,
            "latency": elapsed,
            "tokens_per_s": 0.0,
            "text": "",
            "error": error,
        }


def percentile(values, pct):
    """Percentil por interpolación lineal sobre una lista ya ordenable."""
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    rank = (pct / 100) * (len(ordered) - 1)
    low = int(rank)
    high = min(low + 1, len(ordered) - 1)
    frac = rank - low
    return ordered[low] + (ordered[high] - ordered[low]) * frac


def main():
    cfg = load_llm_config()
    url = resolve_endpoint(cfg)
    concurrency = MAX_CONCURRENT or cfg.get("maxConcurrent") or 4

    headers = {"Content-Type": "application/json"}
    if cfg.get("apiToken"):
        headers["Authorization"] = f"Bearer {cfg['apiToken']}"
    payload_bytes = json.dumps(build_payload(cfg)).encode("utf-8")

    print(f"Provider: {cfg.get('provider')} | Modelo: {cfg.get('model')} | Modo: {MODE}")
    print(f"Lanzando {TOTAL_REQUESTS} peticiones a {url}")
    print(f"Concurrencia máxima: {concurrency}\n")

    results = []
    test_start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [
            pool.submit(do_request, i, url, headers, payload_bytes, cfg)
            for i in range(1, TOTAL_REQUESTS + 1)
        ]
        for fut in as_completed(futures):
            results.append(fut.result())
    total_time = time.perf_counter() - test_start

    results.sort(key=lambda r: r["idx"])
    successes = [r for r in results if r["ok"]]
    failures = [r for r in results if not r["ok"]]

    if PRINT_RESPONSES:
        for r in results:
            tag = "OK" if r["ok"] else "FALLO"
            print(f"[{r['idx']:>3}] {tag}  {r['latency']:.2f}s")
            if r["ok"]:
                print(f"      {r['text'].strip()}\n")
            else:
                print(f"      error: {r['error']}\n")

    print("=" * 60)
    print("RESUMEN")
    print("=" * 60)
    print(f"Éxitos: {len(successes)} / {TOTAL_REQUESTS}   Fallos: {len(failures)}")
    print(f"Tiempo total del test: {total_time:.2f}s")

    if successes:
        latencies = [r["latency"] for r in successes]
        tps = [r["tokens_per_s"] for r in successes if r["tokens_per_s"] > 0]
        print(
            "Latencia (s)  "
            f"min={min(latencies):.2f}  "
            f"max={max(latencies):.2f}  "
            f"media={sum(latencies) / len(latencies):.2f}  "
            f"p95={percentile(latencies, 95):.2f}"
        )
        if tps:
            print(f"Tokens/s medio: {sum(tps) / len(tps):.1f}")

    if failures:
        print(f"\n{len(failures)} petición(es) con error. Revisa endpoint/modelo o el servidor.")


if __name__ == "__main__":
    main()
