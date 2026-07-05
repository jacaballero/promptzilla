// Promptzilla — Simulated LLM module
// Calculates token cost and returns pre-configured responses per challenge and mode.
// All logic here is client-side and requires no network connection.

"use strict";

const LLM_CONFIG = {
  BASE_COST: 8,        // fixed cost per query regardless of length
  COST_PER_WORD: 1,    // additional cost per word in the prompt
  DIRECT_FACTOR: 2,    // direct mode costs double (gives the answer)
  SOCRATIC_FACTOR: 1   // socratic mode costs ×1 (gives hints only)
};

/**
 * Count the number of words in a string.
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Calculate the token cost for a prompt in a given mode.
 * cost = (BASE_COST + words × COST_PER_WORD) × factor
 * @param {string} prompt
 * @param {'direct'|'socratic'} mode
 * @returns {number} integer token cost (minimum 1)
 */
function calculateTokenCost(prompt, mode) {
  const words = countWords(prompt);
  const raw = LLM_CONFIG.BASE_COST + words * LLM_CONFIG.COST_PER_WORD;
  const factor = mode === "socratic" ? LLM_CONFIG.SOCRATIC_FACTOR : LLM_CONFIG.DIRECT_FACTOR;
  return Math.max(1, Math.round(raw * factor));
}

/**
 * Return the simulated LLM response for the current challenge and mode.
 * The response text is pre-configured in challenges.js per challenge and mode.
 * @param {number} challengeId
 * @param {string} prompt  – the user's prompt text (used only for cost calculation)
 * @param {'direct'|'socratic'} mode
 * @returns {{ text: string, cost: number }}
 */
function simulateLLM(challengeId, prompt, mode) {
  const challenge = CHALLENGES.find(c => c.id === challengeId);
  if (!challenge) {
    return { text: "Error: reto no encontrado.", cost: 0 };
  }
  const modeKey = mode === "socratic" ? "socratic" : "direct";
  const cost = calculateTokenCost(prompt, mode);
  return {
    text: challenge.llm_responses[modeKey],
    cost
  };
}

/**
 * Return a cost preview before the player submits the query.
 * @param {string} prompt
 * @param {'direct'|'socratic'} mode
 * @returns {{ cost: number, words: number } | null}
 */
function getCostPreview(prompt, mode) {
  if (!prompt || prompt.trim().length === 0) return null;
  return {
    cost: calculateTokenCost(prompt, mode),
    words: countWords(prompt)
  };
}
