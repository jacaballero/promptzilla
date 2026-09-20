// Promptzilla — Challenge overlay module
// Self-contained quiz overlay reused from the original prototype. It is opened
// from a dialogue option and reports the result back through callbacks.
//
//   Challenge.open(challengeId, { onWin, onLose })
//
// Token state lives in the shared global GAME (see engine.js). This module only
// reads/writes GAME.tokens / GAME.totalSpent and calls window.refreshHUD().

"use strict";

/* global CHALLENGES, LLM, GAME, refreshHUD, window */

const Challenge = (function () {

  let overlay = null;
  let ch = null;
  let selected = [];
  let mode = "direct";              // used by live mode's mode selector
  let tokensThisChallenge = 0;
  let busy = false;                 // guards against double consultations
  let onWin = null;
  let onLose = null;

  function llmMode() { return (window.CONFIG && window.CONFIG.mode) || "sim"; }

  // ─── Helpers ───────────────────────────────────────────────────────────
  function getCorrectSet(c) {
    return Array.isArray(c.correct) ? [...c.correct].sort((a, b) => a - b) : [c.correct];
  }
  function isMultiple(c) {
    if (c.type === "multiple") return true;
    if (c.type === "single") return false;
    return getCorrectSet(c).length > 1;
  }
  function matches(sel, c) {
    const correct = getCorrectSet(c);
    const s = [...sel].sort((a, b) => a - b);
    return s.length === correct.length && s.every((v, i) => v === correct[i]);
  }

  // ─── Public entry point ────────────────────────────────────────────────
  function open(challengeId, opts) {
    ch = CHALLENGES.find(c => c.id === challengeId);
    if (!ch) { console.error("Challenge not found:", challengeId); return; }
    selected = [];
    mode = "direct";
    tokensThisChallenge = 0;
    onWin = opts && opts.onWin;
    onLose = opts && opts.onLose;
    build();
    renderQuestion();
  }

  // ─── DOM construction ──────────────────────────────────────────────────
  function build() {
    overlay = document.createElement("div");
    overlay.id = "challenge-overlay";
    overlay.innerHTML = `
      <div class="challenge-card">
        <div class="challenge-header">
          <span id="c-title"></span>
          <span id="c-tokens" class="c-tokens"></span>
        </div>
        <div id="c-question"></div>
        <div id="c-options"></div>
        <p id="c-multi-hint">☑ Selecciona <strong>todas</strong> las respuestas correctas</p>

        ${llmSectionHTML()}

        <div class="c-submit-row">
          <button id="c-submit" class="btn-primary" disabled>Responder →</button>
        </div>

        <div id="c-feedback"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    wireLLMSection();
    $("c-submit").addEventListener("click", submit);
  }

  function $(id) { return overlay.querySelector("#" + id); }

  // ─── LLM section (mode-dependent) ──────────────────────────────────────
  // "sim": two fixed-cost buttons, no free text. "live": free-text prompt.
  function llmSectionHTML() {
    if (llmMode() === "live") {
      return `
        <div id="c-llm">
          <span class="c-llm-title">🤖 Consultar al LLM</span>
          <div class="c-mode-row">
            <span class="c-mode-label">Modo:</span>
            <button class="c-mode-btn active" data-mode="direct">🎯 Directo (×2)</button>
            <button class="c-mode-btn" data-mode="socratic">🤔 Socrático (×1)</button>
          </div>
          <div class="c-llm-input">
            <input type="text" id="c-prompt" placeholder="Escribe tu consulta y pulsa Consultar (o Enter)…" autocomplete="off">
            <button id="c-consult" class="btn-primary">Consultar</button>
          </div>
          <span id="c-cost"></span>
          <div id="c-no-tokens">⛔ Sin tokens — responde por tu cuenta</div>
          <div id="c-response"></div>
        </div>`;
    }
    return `
        <div id="c-llm">
          <span class="c-llm-title">🤖 Consultar al LLM</span>
          <div class="c-sim-actions">
            <button class="c-sim-btn" data-mode="direct">🎯 Consulta directa <span class="c-sim-cost">−${LLM.simCost("direct")}</span></button>
            <button class="c-sim-btn" data-mode="socratic">🤔 Consulta socrática <span class="c-sim-cost">−${LLM.simCost("socratic")}</span></button>
          </div>
          <div id="c-no-tokens">⛔ Sin tokens — responde por tu cuenta</div>
          <div id="c-response"></div>
        </div>`;
  }

  function wireLLMSection() {
    if (llmMode() === "live") {
      overlay.querySelectorAll(".c-mode-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          overlay.querySelectorAll(".c-mode-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          mode = btn.dataset.mode;
          updateCost();
        });
      });
      $("c-prompt").addEventListener("input", updateCost);
      $("c-consult").addEventListener("click", () => consult(mode, $("c-prompt").value.trim()));
      $("c-prompt").addEventListener("keydown", e => {
        if (e.key === "Enter" && !$("c-consult").disabled) consult(mode, $("c-prompt").value.trim());
      });
      return;
    }
    overlay.querySelectorAll(".c-sim-btn").forEach(btn => {
      btn.addEventListener("click", () => consult(btn.dataset.mode, ""));
    });
  }

  function close() {
    if (overlay) { overlay.remove(); overlay = null; }
  }

  // ─── Render ────────────────────────────────────────────────────────────
  function renderQuestion() {
    $("c-title").textContent = ch.title;
    $("c-question").innerHTML = ch.question;
    updateTokenLabel();

    const multi = isMultiple(ch);
    $("c-multi-hint").style.display = multi ? "block" : "none";

    const box = $("c-options");
    box.innerHTML = "";
    ch.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.innerHTML = `<span class="opt-label">${opt.label}</span><span class="opt-text">${opt.text}</span>`;
      btn.addEventListener("click", () => clickOption(i));
      box.appendChild(btn);
    });

    const prompt = $("c-prompt");
    if (prompt) prompt.value = "";
    $("c-response").innerHTML = "";
    $("c-response").classList.remove("visible");
    const cost = $("c-cost");
    if (cost) cost.textContent = "";
    $("c-submit").disabled = true;
    refreshLLMAvailability();
  }

  function updateTokenLabel() {
    $("c-tokens").textContent = `⚡ ${GAME.tokens} tokens`;
  }

  function refreshLLMAvailability() {
    const canUse = GAME.tokens > 0 && !busy;
    if (llmMode() === "live") {
      if ($("c-prompt")) $("c-prompt").disabled = !canUse;
      if ($("c-consult")) $("c-consult").disabled = !canUse;
    } else {
      overlay.querySelectorAll(".c-sim-btn").forEach(b => { b.disabled = !canUse; });
    }
    $("c-no-tokens").style.display = GAME.tokens > 0 ? "none" : "block";
  }

  function clickOption(index) {
    if (isMultiple(ch)) {
      const pos = selected.indexOf(index);
      if (pos === -1) selected.push(index); else selected.splice(pos, 1);
    } else {
      selected = [index];
    }
    overlay.querySelectorAll(".option-btn").forEach((btn, i) => {
      btn.classList.toggle("selected", selected.includes(i));
    });
    $("c-submit").disabled = selected.length === 0;
  }

  // ─── LLM consultation ──────────────────────────────────────────────────
  function updateCost() {
    const el = $("c-cost");
    if (!el) return;
    const value = $("c-prompt") ? $("c-prompt").value : "";
    if (!value.trim()) { el.textContent = ""; return; }
    const words = LLM.countWords(value);
    const cost = LLM.liveCost(value, mode);
    el.textContent = `Coste estimado: ${cost} tokens (${words} ${words === 1 ? "palabra" : "palabras"})`;
  }

  async function consult(consultMode, prompt) {
    if (busy) return;
    if (llmMode() === "live" && !prompt) { showMsg("⚠️ Escribe una consulta antes de preguntar."); return; }
    if (GAME.tokens <= 0) { showMsg("⚠️ Sin tokens. No puedes consultar al LLM."); return; }

    busy = true;
    refreshLLMAvailability();
    if (llmMode() === "live") showMsg("🤖 Pensando…");

    const { text, cost } = await LLM.query({ challengeId: ch.id, prompt, mode: consultMode });
    const deducted = Math.min(cost, GAME.tokens);
    GAME.tokens -= deducted;
    GAME.totalSpent += deducted;
    tokensThisChallenge += deducted;
    refreshHUD();
    updateTokenLabel();

    const modeTag = consultMode === "socratic"
      ? '<span class="tag-socratic">Socrático</span>'
      : '<span class="tag-direct">Directo</span>';
    $("c-response").innerHTML = `
      <div class="llm-header"><span class="llm-icon">🤖</span>${modeTag}<span class="llm-cost">−${deducted} tokens</span></div>
      <div class="llm-text">${text}</div>`;
    $("c-response").classList.add("visible");
    if ($("c-prompt")) $("c-prompt").value = "";
    if ($("c-cost")) $("c-cost").textContent = "";

    busy = false;
    refreshLLMAvailability();
  }

  function showMsg(msg) {
    $("c-response").innerHTML = `<div class="llm-msg-warn">${msg}</div>`;
    $("c-response").classList.add("visible");
  }

  // ─── Submit + feedback ─────────────────────────────────────────────────
  function submit() {
    if (selected.length === 0) return;
    const correct = matches(selected, ch);

    const correctTexts = getCorrectSet(ch).map(i => ch.options[i].text).join(" y ");
    const answerLabel = getCorrectSet(ch).length > 1 ? "Respuestas correctas" : "Respuesta correcta";

    $("c-options").style.pointerEvents = "none";
    $("c-llm").style.display = "none";
    $("c-submit").style.display = "none";
    $("c-multi-hint").style.display = "none";

    $("c-feedback").innerHTML = `
      <div class="fb-icon ${correct ? "fb-correct" : "fb-wrong"}">${correct ? "✓" : "✗"}</div>
      <div class="fb-result ${correct ? "fb-correct" : "fb-wrong"}">${correct ? "¡Correcto!" : "Incorrecto"}</div>
      <div class="fb-answer">${answerLabel}: ${correctTexts}</div>
      <div class="fb-tokens">${tokensThisChallenge > 0 ? `Tokens usados: ${tokensThisChallenge}` : "✨ Resuelto sin consultar al LLM"}</div>
      <button id="c-continue" class="btn-primary">Continuar →</button>
    `;
    $("c-continue").addEventListener("click", () => {
      close();
      if (correct && onWin) onWin();
      else if (!correct && onLose) onLose();
    });
  }

  return { open };
})();

window.Challenge = Challenge;
