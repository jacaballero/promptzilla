// Promptzilla — LLM adapter
// Consults a real LLM (Ollama /api/generate) over the network with streaming.
// Emits partial tokens through an onToken callback and REJECTS on error/timeout
// (no fallback) so the UI can keep the tokens and the student's prompt intact.
//
// The public API is async (Promise-based). Token cost is the word-based estimate
// (see cost) and is charged by challenge.js ONLY on a successful consultation.

"use strict";

/* global window */

const LLM = (function () {

  function economy() { return (window.CONFIG && window.CONFIG.economy) || {}; }
  function llmCfg() { return (window.CONFIG && window.CONFIG.llm) || {}; }

  function countWords(text) {
    return String(text || "").trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  // Word-based cost of a consultation.
  function cost(prompt, consultMode) {
    const e = economy();
    const words = countWords(prompt);
    const raw = (e.baseCost ?? 8) + words * (e.costPerWord ?? 1);
    const factor = consultMode === "socratic" ? (e.socraticFactor ?? 1) : (e.directFactor ?? 2);
    return Math.max(1, Math.round(raw * factor));
  }

  // ─── Concurrency gate ─────────────────────────────────────────────────────
  let active = 0;
  const waiting = [];
  function acquireSlot() {
    const max = llmCfg().maxConcurrent || 4;
    if (active < max) { active++; return Promise.resolve(); }
    return new Promise(resolve => waiting.push(resolve));
  }
  function releaseSlot() {
    const next = waiting.shift();
    if (next) next();          // hand the slot straight to the next waiter
    else active = Math.max(0, active - 1);
  }

  function systemPrompt(consultMode) {
    const c = llmCfg();
    const instr = (c.modeInstructions && c.modeInstructions[consultMode]) || "";
    return `${c.system || ""}${instr}`;
  }

  // Remove any reasoning block. Reasoning models may emit it either as a paired
  // <think>…</think> block or as leading text ending in a stray </think>.
  function stripThink(text) {
    let t = String(text || "");
    const end = t.lastIndexOf("</think>");
    if (end !== -1) t = t.slice(end + "</think>".length);
    return t.replace(/<\/?think>/gi, "").trim();
  }

  // Streamed request. Resolves with { text, counts } or rejects on network
  // error / inactivity timeout. Calls onToken(chunk) for each fragment.
  async function request({ prompt, consultMode, onToken }) {
    const c = llmCfg();
    const controller = new AbortController();
    const idleMs = c.timeoutMs || 30000;

    // Inactivity timeout: reset the timer on every chunk; abort only if the
    // server goes silent for longer than idleMs (cold-start friendly).
    let timer = null;
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), idleMs);
    };
    arm();

    const headers = { "Content-Type": "application/json" };
    if (c.apiToken) headers["Authorization"] = `Bearer ${c.apiToken}`;

    const body = {
      model: c.model,
      system: systemPrompt(consultMode),
      prompt: `${prompt}${c.brevitySuffix || ""}`,
      stream: true,
      options: {
        num_predict: c.maxTokens ?? 256,
        temperature: c.temperature ?? 0.6
      }
    };
    // `think` is only accepted by reasoning models (qwen3, deepseek-r1). Send it
    // when it is a boolean; leave it out (config think:null) for other models to
    // avoid a "does not support thinking" error.
    if (typeof c.think === "boolean") body.think = c.think;

    let resp;
    try {
      resp = await fetch(c.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (err) {
      if (timer) clearTimeout(timer);
      throw err;
    }
    if (!resp.ok || !resp.body) {
      if (timer) clearTimeout(timer);
      throw new Error(`HTTP ${resp.status}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let counts = null;

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        arm();
        buffer += decoder.decode(value, { stream: true });

        let nl;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;

          let obj;
          try { obj = JSON.parse(line); } catch { continue; }
          if (obj.error) throw new Error(obj.error);
          if (obj.response) {
            text += obj.response;
            if (onToken) onToken(obj.response, text);
          }
          if (obj.done) {
            counts = {
              prompt_eval_count: obj.prompt_eval_count || 0,
              eval_count: obj.eval_count || 0
            };
          }
        }
      }
    } finally {
      if (timer) clearTimeout(timer);
    }

    const clean = stripThink(text);
    if (!clean) throw new Error("Respuesta vacía del modelo.");
    return { text: clean, counts };
  }

  // Resolve a consultation. Returns { text, cost, counts } or a REJECTED promise.
  async function query({ prompt, mode: consultMode, onToken }) {
    const m = consultMode === "socratic" ? "socratic" : "direct";
    const tokenCost = cost(prompt, m);
    await acquireSlot();
    try {
      const { text, counts } = await request({ prompt, consultMode: m, onToken });
      return { text, cost: tokenCost, counts };
    } finally {
      releaseSlot();
    }
  }

  // Pre-warm: load the model into memory so the first real query is not a cold
  // start. Non-blocking, best-effort; ignores result and errors.
  function warmup() {
    const c = llmCfg();
    if (c.warmupOnLoad === false) return;

    const headers = { "Content-Type": "application/json" };
    if (c.apiToken) headers["Authorization"] = `Bearer ${c.apiToken}`;

    fetch(c.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: c.model,
        prompt: "",
        stream: false,
        options: { num_predict: 1 }
      })
    }).catch(() => { /* best-effort; ignore */ });
  }

  return { query, warmup, cost, countWords };
})();

window.LLM = LLM;
