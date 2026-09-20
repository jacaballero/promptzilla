// Promptzilla — LLM adapter
// Single entry point for "consulting the LLM", with two modes selected by
// window.CONFIG.mode:
//   • "sim"  → returns pre-configured (canned) responses per challenge/mode at
//              a FIXED token cost (economy.directCost / economy.socraticCost).
//              No network, deterministic, safe for a whole class at once.
//   • "live" → real LLM over the network. NOT IMPLEMENTED YET: the branch is
//              present and, for now, falls back to the simulated response so the
//              game keeps working until we wire the real backend.
//
// The public API is intentionally async (Promise-based) so the "live" mode can
// be dropped in later without touching challenge.js.

"use strict";

/* global CHALLENGES, window */

const LLM = (function () {

  function economy() { return (window.CONFIG && window.CONFIG.economy) || {}; }
  function mode() { return (window.CONFIG && window.CONFIG.mode) || "sim"; }

  function countWords(text) {
    return String(text || "").trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  // Fixed cost per query in simulated mode.
  function simCost(consultMode) {
    const e = economy();
    return consultMode === "socratic" ? (e.socraticCost ?? 8) : (e.directCost ?? 16);
  }

  // Word-based cost, reserved for the future real-LLM ("live") integration.
  function liveCost(prompt, consultMode) {
    const e = economy();
    const words = countWords(prompt);
    const raw = (e.baseCost ?? 8) + words * (e.costPerWord ?? 1);
    const factor = consultMode === "socratic" ? (e.socraticFactor ?? 1) : (e.directFactor ?? 2);
    return Math.max(1, Math.round(raw * factor));
  }

  function cannedResponse(challengeId, consultMode) {
    const ch = CHALLENGES.find(c => c.id === challengeId);
    if (!ch) return "Error: reto no encontrado.";
    const key = consultMode === "socratic" ? "socratic" : "direct";
    return (ch.llm_responses && ch.llm_responses[key]) || "(sin respuesta configurada)";
  }

  // Resolve a consultation. Returns { text, cost, source } where source is
  // "sim" | "fallback" (and, in the future, "live").
  async function query({ challengeId, prompt, mode: consultMode }) {
    const m = consultMode === "socratic" ? "socratic" : "direct";
    if (mode() === "live") {
      // TODO: real LLM call (fetch to CONFIG.llm.endpoint with timeout,
      // concurrency limit and streaming). Until then, degrade to simulated.
      return { text: cannedResponse(challengeId, m), cost: liveCost(prompt, m), source: "fallback" };
    }
    return { text: cannedResponse(challengeId, m), cost: simCost(m), source: "sim" };
  }

  return { query, simCost, liveCost, countWords };
})();

window.LLM = LLM;
