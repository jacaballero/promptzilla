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
  // "sim"  → simulated LLM (canned answers, no free text). ACTIVE MODE.
  // "live" → real LLM over the network. NOT IMPLEMENTED YET (structure ready).
  mode: "sim",

  economy: {
    initialTokens: 100,

    // Simulated mode: fixed cost per query (may be moved per-challenge later).
    directCost: 16,     // 🎯 direct consultation (gives the answer)
    socraticCost: 8,    // 🤔 socratic consultation (gives hints only)

    // Live mode (future): word-based cost = (baseCost + words*costPerWord)*factor
    baseCost: 8,
    costPerWord: 1,
    directFactor: 2,
    socraticFactor: 1
  },

  // Live-mode connection settings — placeholders for the future real LLM.
  llm: {
    endpoint: "http://localhost:11434/api/generate",
    apiToken: "",
    model: "llama3.2:3b",
    timeoutMs: 8000,
    maxTokens: 256,
    maxConcurrent: 4,
    system: "Eres un tutor de HTML que ayuda a estudiantes sin dar la respuesta directa salvo que se pida."
  }
};
