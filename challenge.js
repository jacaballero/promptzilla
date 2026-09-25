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
  let mode = "direct";              // consultation mode selector (direct/socratic)
  let tokensThisChallenge = 0;
  let busy = false;                 // guards against double consultations
  let onWin = null;
  let onLose = null;

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

  // ─── LLM section ───────────────────────────────────────────────────────
  function llmSectionHTML() {
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

  function wireLLMSection() {
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
    if ($("c-prompt")) $("c-prompt").disabled = busy || GAME.tokens <= 0;
    updateCost();   // sets #c-consult disabled based on affordability + busy
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
  // Estimated cost of a consultation with the current prompt/mode.
  function estimatedCost(consultMode, prompt) {
    return LLM.cost(prompt || "", consultMode);
  }

  function updateCost() {
    const el = $("c-cost");
    if (!el) return;
    const consultBtn = $("c-consult");
    const value = $("c-prompt") ? $("c-prompt").value : "";
    if (!value.trim()) {
      el.textContent = "";
      el.classList.remove("c-cost-warn");
      if (consultBtn) consultBtn.disabled = busy || GAME.tokens <= 0;
      return;
    }
    const words = LLM.countWords(value);
    const cost = LLM.cost(value, mode);
    const affordable = cost <= GAME.tokens;
    el.textContent = affordable
      ? `Coste estimado: ${cost} tokens (${words} ${words === 1 ? "palabra" : "palabras"})`
      : `⛔ Coste estimado: ${cost} tokens — solo tienes ${GAME.tokens}`;
    el.classList.toggle("c-cost-warn", !affordable);
    if (consultBtn) consultBtn.disabled = busy || !affordable || GAME.tokens <= 0;
  }

  // ─── Profanity filter ──────────────────────────────────────────────────
  // Lowercase and strip accents, but keep ñ so "coño" ≠ "cono".
  function normalizeText(s) {
    return String(s).toLowerCase()
      .replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i")
      .replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u");
  }
  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // Per-word regex: tolerates repeated letters and separators, bounded by
  // non-letters to avoid false positives (e.g. "clase", "disputa").
  function profanityPattern(word) {
    const sep = "[\\s._\\-*]*";
    const body = [...normalizeText(word)].map(ch => escapeRegExp(ch) + "+").join(sep);
    return new RegExp(`(?<![\\p{L}])${body}(?![\\p{L}])`, "iu");
  }
  let profanityPatterns = null;
  function hasProfanity(text) {
    const data = window.PROFANITY || {};
    if (!profanityPatterns) profanityPatterns = (data.words || []).map(profanityPattern);
    const allow = (data.allow || []).map(normalizeText);
    const t = normalizeText(text);
    return profanityPatterns.some(re => {
      const m = re.exec(t);
      return m && !allow.includes(m[0]);
    });
  }

  async function consult(consultMode, prompt) {
    if (busy) return;
    if (!prompt) { showMsg("⚠️ Escribe una consulta antes de preguntar."); return; }
    if (hasProfanity(prompt)) { showMsg("⚠️ Cuida el lenguaje: reformula tu consulta sin palabras ofensivas."); return; }
    if (GAME.tokens <= 0) { showMsg("⚠️ Sin tokens. No puedes consultar al LLM."); return; }

    const cost = estimatedCost(consultMode, prompt);
    if (cost > GAME.tokens) {
      showMsg(`⚠️ Esta consulta cuesta ${cost} tokens y solo tienes ${GAME.tokens}. Acórtala o usa el modo socrático.`);
      return;
    }

    busy = true;
    refreshLLMAvailability();
    await consultLive(consultMode, prompt);
    busy = false;
    refreshLLMAvailability();
  }

  // Deduct the query cost (capped at the remaining balance) and refresh the HUD.
  function deductTokens(cost) {
    const deducted = Math.min(cost, GAME.tokens);
    GAME.tokens -= deducted;
    GAME.totalSpent += deducted;
    tokensThisChallenge += deducted;
    refreshHUD();
    updateTokenLabel();
    return deducted;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function modeTagHTML(consultMode) {
    return consultMode === "socratic"
      ? '<span class="tag-socratic">Socrático</span>'
      : '<span class="tag-direct">Directo</span>';
  }

  // What to show live: strip the model's reasoning. While still inside an open
  // <think> block, show nothing yet (keep the typing indicator).
  function visibleAnswer(full) {
    const t = String(full || "");
    const end = t.lastIndexOf("</think>");
    if (end !== -1) return t.slice(end + "</think>".length).replace(/<\/?think>/gi, "");
    if (/<think>/i.test(t)) return "";
    return t;
  }

  // Stream tokens in, charge ONLY on success. On failure keep the tokens and
  // the prompt so the student can retry.
  async function consultLive(consultMode, prompt) {
    const resp = $("c-response");
    resp.classList.add("visible");
    resp.innerHTML = `
      <div class="llm-header"><span class="llm-icon">🤖</span>${modeTagHTML(consultMode)}<span class="llm-typing">escribiendo…</span></div>
      <div class="llm-text" id="c-live-text"><span class="llm-cursor">▋</span></div>`;

    const onToken = (_frag, full) => {
      const el = $("c-live-text");
      if (!el) return;
      const shown = visibleAnswer(full);
      el.innerHTML = shown
        ? escapeHTML(shown) + '<span class="llm-cursor">▋</span>'
        : '<span class="llm-cursor">▋</span>';
    };

    try {
      const { text, cost } = await LLM.query({ prompt, mode: consultMode, onToken });
      const deducted = deductTokens(cost);
      resp.innerHTML = `
        <div class="llm-header"><span class="llm-icon">🤖</span>${modeTagHTML(consultMode)}<span class="llm-cost">−${deducted} tokens</span></div>
        <div class="llm-text">${escapeHTML(text)}</div>`;
      if ($("c-prompt")) $("c-prompt").value = "";
      if ($("c-cost")) $("c-cost").textContent = "";
    } catch (err) {
      console.warn("LLM live query failed:", err);
      resp.innerHTML = `<div class="llm-msg-warn">📡 La conexión ha fallado, cosas de la IA… vuelve a intentarlo.</div>`;
      resp.classList.add("visible");
    }
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
