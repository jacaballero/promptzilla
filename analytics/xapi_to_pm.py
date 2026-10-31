#!/usr/bin/env python3
"""Download Promptzilla xAPI statements from the LRS and export an event log
for process mining (CSV for Disco, XES for ProM / PM4Py).

One case = one game (xAPI registration), whatever language it was played in.
Activity labels are written in every language, so DFGs can be drawn in either:
  activity_fine_es / activity_fine_en       verb + object name
                                            ("respondió Etiquetas de encabezado" /
                                             "answered Heading tags")
  activity_coarse_es / activity_coarse_en   verb + object type
                                            ("respondió pregunta" / "answered question")
concept:name and activity_coarse repeat the --lang ones (default es), for tools
that expect a single activity column. Activity names come from the current game
data (catalog.js), so games logged by older versions are labelled the same way. The `lang` column is the language
the game was played in (dfg.py --game-lang filters it).

Usage:
  docker compose run --rm analytics [--since 2026-10-01] [--group 1A] [--lang en]
Output goes to analytics/out/. Endpoint and credentials come from the
environment (LRS_ENDPOINT / LRS_API_KEY / LRS_API_SECRET, set by compose), and
the extensions prefix (--vocab-ext) from XAPI_VOCAB_EXT.
"""

import argparse
import base64
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import warnings
from datetime import datetime, timezone

import pandas as pd
import pm4py

# r4pm is an optional speed-up; the bundled exporter is fine for our log sizes.
warnings.filterwarnings("ignore", message=r".*r4pm.*", category=UserWarning)

DEFAULT_VOCAB_EXT = "https://promptzilla.uca.es/xapi/vocab/extensions/"
PAGE_LIMIT = 1000
LANGS = ("es", "en")

# Labels per language, keyed by the English verb / activity-type name. English
# is the xAPI display/IRI name itself; old statements only carry en-US.
VERB_LABELS = {
    "es": {
        "initialized": "inició", "completed": "completó", "abandoned": "abandonó",
        "accessed": "accedió", "interacted": "interactuó", "selected": "seleccionó",
        "exited": "salió", "answered": "respondió", "asked": "preguntó", "failed": "falló",
        "downloaded": "descargó", "received": "recibió", "blocked": "bloqueado",
        "evaluated": "evaluado",
    },
}
TYPE_LABELS = {
    "es": {
        "serious-game": "juego", "area": "escena", "non-player-character": "personaje",
        "dialog-tree": "diálogo", "menu": "menú", "question": "pregunta", "hotspot": "elemento",
        "ai-tutor": "tutor IA", "prompt-evaluation": "evaluación de prompts", "report": "informe",
    },
}
RESPONSE_LABELS = {"es": {"direct": "directo", "socratic": "socrático"}}


# The LRS only accepts full timestamps; dates/naive times are taken as UTC.
def xapi_timestamp(value):
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not an ISO 8601 date/time: {value!r}")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_statements(endpoint, key, secret, since=None, until=None):
    auth = base64.b64encode(f"{key}:{secret}".encode()).decode()
    headers = {"Authorization": f"Basic {auth}", "X-Experience-API-Version": "1.0.3"}
    params = {"limit": PAGE_LIMIT, "ascending": "true"}
    if since:
        params["since"] = since
    if until:
        params["until"] = until
    base = endpoint.rstrip("/") + "/"
    url = urllib.parse.urljoin(base, "statements") + "?" + urllib.parse.urlencode(params)
    while url:
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                page = json.load(resp)
        except urllib.error.HTTPError as err:
            sys.exit(f"LRS error {err.code}: {err.read().decode(errors='replace')[:500]}")
        yield from page.get("statements", [])
        more = page.get("more")
        url = urllib.parse.urljoin(base, more) if more else None


def short(iri):
    return iri.rstrip("/").rsplit("/", 1)[-1] if iri else ""


def lang_value(m, lang):
    if not m:
        return None
    for key, value in m.items():
        if key.lower().split("-")[0] == lang:
            return value
    return m.get("es-ES") or m.get("en-US") or next(iter(m.values()), None)


def is_lang_map(v):
    return isinstance(v, dict) and v and all(re.fullmatch(r"[a-z]{2}(-[A-Z]{2})?", k) for k in v)


# Statements logged by older game versions may lack a language or carry raw ids.
# Names come from the current game data (catalog.js) and, for activities it no
# longer has, from the newest statement of the same activity (oldest first).
def latest_names(statements):
    names = {}
    for st in statements:
        obj = st.get("object", {})
        name = (obj.get("definition") or {}).get("name")
        if obj.get("id") and is_lang_map(name):
            names.setdefault(obj["id"], {}).update(name)
    return names


def game_catalog():
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalog.js")
    try:
        out = subprocess.run(["node", script], capture_output=True, text=True, check=True, timeout=60)
        return json.loads(out.stdout)
    except (OSError, subprocess.SubprocessError, ValueError) as err:
        print(f"Warning: game catalog unavailable ({err}); using names from the statements.", file=sys.stderr)
        return {}


ACTIVITY_PATH = re.compile(r"/(?:game|report|scene|character|dialogue|challenge)(?:/.*)?$")


def resolve_names(statements):
    catalog = game_catalog()
    names = latest_names(statements)
    for iri in names:
        m = ACTIVITY_PATH.search(iri)
        if m and m.group(0) in catalog:
            names[iri] = {**names[iri], **catalog[m.group(0)]}
    return names


def iso_duration_seconds(d):
    if not d:
        return None
    m = re.fullmatch(r"P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?)?", d)
    if not m:
        return None
    days, hours, minutes, seconds = (float(x) if x else 0.0 for x in m.groups())
    return days * 86400 + hours * 3600 + minutes * 60 + seconds


def ext_short(exts, prefix):
    out = {}
    for k, v in (exts or {}).items():
        name = k[len(prefix):] if k.startswith(prefix) else k
        out[name.replace("-", "_")] = v
    return out


def to_row(st, vocab_ext, lang, names):
    ctx = st.get("context", {})
    if ctx.get("platform") != "Promptzilla" or not ctx.get("registration"):
        return None
    cext = ext_short(ctx.get("extensions"), vocab_ext)
    result = st.get("result", {})
    obj = st.get("object", {})
    definition = obj.get("definition", {})
    verb_obj = st.get("verb", {})
    verb = (verb_obj.get("display") or {}).get("en-US") or short(verb_obj.get("id"))
    obj_type = short(definition.get("type"))
    response = result.get("response")
    name_map = names.get(obj.get("id")) or definition.get("name")

    labels = {}
    for code in LANGS:
        verb_label = VERB_LABELS.get(code, {}).get(verb, verb)
        type_label = TYPE_LABELS.get(code, {}).get(obj_type, obj_type)
        name = lang_value(name_map, code) or short(obj.get("id"))
        fine = f"{verb_label} {name}"
        if verb == "selected" and response is not None:
            fine += f" → {RESPONSE_LABELS.get(code, {}).get(response, response)}"
        labels[f"activity_fine_{code}"] = fine
        labels[f"activity_coarse_{code}"] = f"{verb_label} {type_label}"

    row = {
        "case:concept:name": ctx["registration"],
        "concept:name": labels[f"activity_fine_{lang}"],
        "activity_coarse": labels[f"activity_coarse_{lang}"],
        **labels,
        "time:timestamp": st.get("timestamp"),
        "org:resource": st.get("actor", {}).get("account", {}).get("name"),
        "lang": (ctx.get("language") or "es").split("-")[0],
        "verb": verb,
        "object_id": obj.get("id"),
        "object_type": obj_type,
        "object_name": lang_value(name_map, lang) or short(obj.get("id")),
        "success": result.get("success"),
        "response": response,
        "duration_s": iso_duration_seconds(result.get("duration")),
        "score_raw": (result.get("score") or {}).get("raw"),
        "seq": cext.get("seq"),
        "tokens": cext.get("tokens"),
        "total_spent": cext.get("total_spent"),
        "scene": cext.get("scene"),
        "group": cext.get("group"),
        "debug": bool(cext.get("debug", False)),
    }
    for k, v in ext_short(result.get("extensions"), vocab_ext).items():
        row["r_" + k] = lang_value(v, lang) if is_lang_map(v) else v
    return row


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--endpoint", default=os.environ.get("LRS_ENDPOINT", "http://localhost:8081/xapi"))
    ap.add_argument("--key", default=os.environ.get("LRS_API_KEY"))
    ap.add_argument("--secret", default=os.environ.get("LRS_API_SECRET"))
    ap.add_argument("--since", type=xapi_timestamp,
                    help="ISO 8601 date/time, e.g. 2026-10-31 or 2026-10-31T09:00+01:00 (UTC if no zone)")
    ap.add_argument("--until", type=xapi_timestamp, help="ISO 8601 date/time (same format as --since)")
    ap.add_argument("--group", help="keep only this ?group= value")
    ap.add_argument("--lang", default="es", choices=LANGS,
                    help="language of concept:name / activity_coarse (default: es)")
    ap.add_argument("--include-debug", action="store_true", help="keep games played with ?debug")
    ap.add_argument("--out-dir", default=".")
    ap.add_argument("--vocab-ext", default=os.environ.get("XAPI_VOCAB_EXT", DEFAULT_VOCAB_EXT),
                    help="IRI prefix of the game's xAPI extensions (stripped from column names)")
    args = ap.parse_args()

    if not args.key or not args.secret:
        sys.exit("Missing LRS credentials (--key/--secret or LRS_API_KEY/LRS_API_SECRET).")

    vocab_ext = args.vocab_ext if args.vocab_ext.endswith("/") else args.vocab_ext + "/"
    statements = list(fetch_statements(args.endpoint, args.key, args.secret, args.since, args.until))
    names = resolve_names(statements)
    rows = [r for r in (to_row(st, vocab_ext, args.lang, names) for st in statements) if r]
    if not args.include_debug:
        rows = [r for r in rows if not r["debug"]]
    if args.group:
        rows = [r for r in rows if r["group"] == args.group]
    if not rows:
        sys.exit("No Promptzilla statements matched.")

    df = pd.DataFrame(rows)
    df["time:timestamp"] = pd.to_datetime(df["time:timestamp"], utc=True, format="ISO8601")
    df = df.sort_values(["case:concept:name", "time:timestamp", "seq"], kind="stable").reset_index(drop=True)

    os.makedirs(args.out_dir, exist_ok=True)
    csv_path = os.path.join(args.out_dir, "events.csv")
    xes_path = os.path.join(args.out_dir, "events.xes")
    df.to_csv(csv_path, index=False)

    log_df = pm4py.format_dataframe(df, case_id="case:concept:name",
                                    activity_key="concept:name", timestamp_key="time:timestamp")
    pm4py.write_xes(log_df, xes_path)

    print(f"{len(df)} events, {df['case:concept:name'].nunique()} cases -> {csv_path}, {xes_path}")


if __name__ == "__main__":
    main()
