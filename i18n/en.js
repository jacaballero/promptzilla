// Promptzilla — English UI strings. Values may use {placeholders} or be functions(vars).
"use strict";

/* global window */
window.I18N_STRINGS = window.I18N_STRINGS || {};
window.I18N_STRINGS.en = {
  _meta: { locale: "en-US", label: "EN", name: "English", nativeName: "English" },

  "doc.title": "Promptzilla — Adventure",

  // Start screen
  "start.intro": "Year 2035. <strong>Promptzilla</strong>, a monster that grows fatter with every lazy prompt, prowls the University. Your mission: beat the challenges without feeding it.",
  "start.rule.move": "Click on the scene to move and on characters to talk to them.",
  "start.rule.challenges": "Some characters will give you challenges about the course.",
  "start.rule.tokens": "In each challenge you can ask the AI, but it costs <strong>tokens</strong>: Socratic mode costs half as much as direct mode.",
  "start.rule.once": "Each challenge can only be answered once. If you get it wrong, you'll see the solution.",
  "start.rule.report": "At the end you'll get a report on how you used the AI.",
  "start.privacy.title": "Anonymous game log",
  "start.privacy.text": "Your interaction with the game is logged anonymously for teaching research. The text of your prompts is not stored, nor any data that could identify you or link the log to you.",
  "start.loading": "Loading…",
  "start.loadingPct": "Loading… {pct}%",
  "start.ready": "All set!",
  "start.slow": "Still loading, but you can start now.",
  "start.button": "Start →",

  // HUD + world
  "hud.tokens": "{tokens} / {max} tokens",
  "world.nothing": "Nothing interesting here.",

  // End screen
  "end.summary": ({ correct, total }) => correct === 0
    ? `You got none of the ${total} challenges right.`
    : `You got ${correct} of the ${total} challenges right.`,
  "end.flavor.high": "You've fed Promptzilla: it gobbled up almost all your tokens and now prowls the faculty bigger than ever.",
  "end.flavor.low": "You've put Promptzilla on a diet: it barely tasted your tokens and is still hungry.",
  "end.flavor.mid": "Promptzilla is still in town, but you didn't feed it today. The faculty can breathe.",
  "end.tokens": "Tokens spent: <strong>{spent}</strong> · Remaining: <strong>{remaining}</strong>",
  "end.analyzing": "Analysing your prompts…",
  "end.download": "Download report (HTML)",
  "end.restart": "Play again",

  // Challenge overlay
  "challenge.tokens": "{tokens} tokens",
  "challenge.exit": "✕ Exit",
  "challenge.exitTitle": "Leave the challenge and come back later",
  "challenge.multiHint": "☑ Select <strong>all</strong> the correct answers",
  "challenge.submit": "Answer →",
  "challenge.llmTitle": "Ask the LLM",
  "challenge.modeLabel": "Mode:",
  "challenge.modeDirect": "Direct (×2)",
  "challenge.modeSocratic": "Socratic (×1)",
  "challenge.modeInfo": "What does each mode do?",
  "challenge.modeHelpDirect": "<strong>Direct (×2):</strong> the AI gives you the full solution. It costs twice as many tokens.",
  "challenge.modeHelpSocratic": "<strong>Socratic (×1):</strong> the AI doesn't give you the solution, only hints and questions so you get there yourself. It costs half.",
  "challenge.placeholder": "Type your question and press Ask (or Enter)…",
  "challenge.consult": "Ask",
  "challenge.noTokens": "⛔ No tokens left — answer on your own",
  "challenge.cost": ({ cost, words }) => `Estimated cost: ${cost} tokens (${words} ${words === 1 ? "word" : "words"})`,
  "challenge.costTooHigh": "⛔ Estimated cost: {cost} tokens — you only have {tokens}",
  "challenge.warnEmpty": "⚠️ Type a question before asking.",
  "challenge.warnProfanity": "⚠️ Mind your language: rephrase your question without offensive words.",
  "challenge.warnNoTokens": "⚠️ No tokens left. You can't ask the LLM.",
  "challenge.warnTooExpensive": "⚠️ This question costs {cost} tokens and you only have {tokens}. Shorten it or use Socratic mode.",
  "challenge.tagDirect": "Direct",
  "challenge.tagSocratic": "Socratic",
  "challenge.typing": "typing…",
  "challenge.failed": "📡 The connection failed, AI things… please try again.",
  "challenge.correct": "Correct!",
  "challenge.incorrect": "Wrong",
  "challenge.answerOne": "Correct answer",
  "challenge.answerMany": "Correct answers",
  "challenge.and": " and ",
  "challenge.tokensUsed": "Tokens used: {tokens}",
  "challenge.continue": "Continue →",

  // Prompt report
  "report.summary": "Summary",
  "report.detail": "Details per challenge",
  "report.strengths": "Strengths",
  "report.improvements": "To improve",
  "report.conclusion": "Conclusion",
  "report.summaryUnavailable": "Summary not available.",
  "report.noConsults": "You didn't ask the LLM in any challenge.",
  "report.repeated": "repeated ×{n}",
  "report.copied": "copied from the statement",
  "report.modeDirect": "Direct",
  "report.modeSocratic": "Socratic",
  "report.clarity": "Clarity",
  "report.context": "Context",
  "report.conciseness": "Conciseness",
  "report.overall": "Assessment",
  "report.suggestion": "Suggestion",
  "report.notEvaluated": "Not evaluated.",
  "report.tutorAnswer": "Tutor's answer",
  "report.abandoned": "↩ Abandoned",
  "report.passed": "✓ Right",
  "report.failed": "✗ Wrong",
  "report.solvedNoConsult": "Solved without asking",
  "report.answeredNoConsult": "Answered without asking",
  "report.attempt": "Challenge {number} — {title}",
  "report.title": "Your prompt report",
  "report.docTitle": "Promptzilla — Prompt report",
  "report.filename": "promptzilla-report.html",

  // xAPI activity names
  "xapi.tutor": "AI tutor · {title}",
  "xapi.mode": "AI mode · {title}",
  "xapi.evaluation": "Prompt evaluation · {title}",
  "xapi.report": "Prompt report"
};
