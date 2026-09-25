// Promptzilla — Default app configuration (committed template)
// This file holds SAFE DEFAULTS and is tracked in the repo. To override any
// value locally without touching this file, create a `config.js` next to it
// (it is gitignored) that sets `window.APP_CONFIG` with only the keys you want
// to change. `boot.js` deep-merges APP_CONFIG on top of these defaults.
//
// Data is a plain object wrapped in one assignment so it works both when the
// game is opened directly (file://) and when served over HTTP. When we move to
// a Docker/served setup later, switching these to pure .json + fetch is trivial.

"use strict";

/* global window */
window.APP_CONFIG_DEFAULT = {
  economy: {
    initialTokens: 100,

    // Word-based cost = (baseCost + words*costPerWord)*factor,
    // charged ONLY on a successful consultation.
    baseCost: 8,
    costPerWord: 1,
    directFactor: 2,
    socraticFactor: 1
  },

  // Live-mode connection settings for the real LLM (Ollama /api/generate).
  // In production override these in config.js: point `endpoint` to an HTTPS
  // same-origin URL (reverse proxy) to avoid mixed-content and CORS issues.
  llm: {
    endpoint: "http://localhost:11434/api/generate",
    apiToken: "",            // optional; sent as "Authorization: Bearer <token>"
    model: "qwen3:4b",
    // Reasoning models (qwen3, deepseek-r1): true = think, false = don't think.
    // Non-reasoning models (gemma, llama, mistral): use null so `think` is omitted
    // (avoids a "does not support thinking" error). With think:true raise maxTokens
    // so there is room to reason AND answer; with think:false/null a low value is fine.
    think: true,
    maxTokens: 2048,          // num_predict — caps output tokens
    temperature: 0.6,
    timeoutMs: 30000,        // INACTIVITY timeout: aborts if no new chunk in this window
    maxConcurrent: 4,        // client-side concurrency gate for a whole class
    warmupOnLoad: true,      // pre-warm the model when the game boots (live mode)

    // System prompt = base + the active mode's instruction.
    system: "Eres un tutor de desarrollo web (HTML, CSS y JavaScript). Respondes en español, de forma breve (~80 palabras, 3-4 frases).",
    modeInstructions: {
      direct: " Responde de forma completa, dando la solución.",
      socratic: " NO des la solución ni el código final: ofrece solo pistas y preguntas orientadoras."
    },
    // Appended to the student's prompt to keep answers short (token economy).
    brevitySuffix: " Responde en 3-4 frases, máximo 100 palabras, sin ejemplos largos."
  }
};
