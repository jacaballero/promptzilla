// Promptzilla — Main game logic (state machine + DOM updates)
// Code language: English | UI strings in Spanish

"use strict";

// ─── Constants ─────────────────────────────────────────────────────────────────

const INITIAL_TOKENS = 100;

// Impact bar label thresholds (% of tokens spent)
const IMPACT_LEVELS = [
  { max: 25,  label: "Bajo",    color: "#2ecc71" },
  { max: 50,  label: "Moderado", color: "#f1c40f" },
  { max: 75,  label: "Alto",    color: "#e67e22" },
  { max: 101, label: "¡Crítico!", color: "#e74c3c" }
];

// Promptzilla height (px) grows with tokens spent
const PZ_MIN_HEIGHT = 105;
const PZ_MAX_HEIGHT = 260;

// ─── Game state ────────────────────────────────────────────────────────────────

let gs = createInitialState();

function createInitialState() {
  return {
    challengeIndex: 0,
    tokens: INITIAL_TOKENS,
    totalSpent: 0,
    results: [],             // { correct, tokensSpent, llmUsed } per challenge
    selectedOptions: [],       // indices of selected options (supports multi-answer)
    mode: "direct",
    tokensThisChallenge: 0,
    llmUsedThisChallenge: false
  };
}

// ─── DOM helpers ───────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(`screen-${name}`).classList.add("active");
}

function setNarrative(text) {
  $("scene-narrative").textContent = text;
}

// ─── HUD & Promptzilla ─────────────────────────────────────────────────────────

function updateHUD() {
  const pct = Math.max(0, gs.tokens / INITIAL_TOKENS) * 100;
  const spentPct = Math.min(100, (gs.totalSpent / INITIAL_TOKENS) * 100);

  // Token bar
  const tokenBar = $("token-bar");
  tokenBar.style.width = pct + "%";
  $("token-count").textContent = `${gs.tokens} / ${INITIAL_TOKENS}`;
  tokenBar.style.backgroundColor =
    pct > 50 ? "#2ecc71" : pct > 25 ? "#f1c40f" : "#e74c3c";

  // Impact bar
  const level = IMPACT_LEVELS.find(l => spentPct < l.max) || IMPACT_LEVELS[3];
  $("impact-bar").style.width = spentPct + "%";
  $("impact-bar").style.backgroundColor = level.color;
  $("impact-label").textContent = level.label;
  $("impact-label").style.color = level.color;

  // Promptzilla size + state
  updatePromptzilla(spentPct);
}

function updatePromptzilla(spentPct) {
  const svg = $("promptzilla-svg");

  // Grow height between PZ_MIN_HEIGHT and PZ_MAX_HEIGHT
  const height = Math.round(PZ_MIN_HEIGHT + (spentPct / 100) * (PZ_MAX_HEIGHT - PZ_MIN_HEIGHT));
  svg.style.height = height + "px";

  // Swap state classes
  svg.classList.remove("pz-sleeping", "pz-awake", "pz-agitated", "pz-furious");
  if (spentPct < 25) {
    svg.classList.add("pz-sleeping");
  } else if (spentPct < 50) {
    svg.classList.add("pz-awake");
  } else if (spentPct < 75) {
    svg.classList.add("pz-agitated");
  } else {
    svg.classList.add("pz-furious");
  }
}

function promptzillaRoar() {
  const svg = $("promptzilla-svg");
  svg.classList.add("pz-roar");
  setTimeout(() => svg.classList.remove("pz-roar"), 750);
}

// ─── Challenge helpers ───────────────────────────────────────────────────────────

/** Returns sorted array of correct indices (normalises int → [int]). */
function getCorrectSet(ch) {
  return Array.isArray(ch.correct)
    ? [...ch.correct].sort((a, b) => a - b)
    : [ch.correct];
}

/** True if the challenge expects more than one answer. */
function isMultiple(ch) {
  if (ch.type === "multiple") return true;
  if (ch.type === "single")   return false;
  return getCorrectSet(ch).length > 1;
}

/** True if the player's selection exactly matches all correct indices. */
function selectedMatchesCorrect(selected, ch) {
  const correct = getCorrectSet(ch);
  const sorted  = [...selected].sort((a, b) => a - b);
  return sorted.length === correct.length && sorted.every((v, i) => v === correct[i]);
}

// ─── Screen: Intro ─────────────────────────────────────────────────────────────

function initIntro() {
  gs = createInitialState();
  updateHUD();
  setNarrative("Año 2035. El aula del futuro.");
  showScreen("intro");
}

// ─── Screen: Challenge ─────────────────────────────────────────────────────────

function showChallenge() {
  const ch = CHALLENGES[gs.challengeIndex];
  gs.selectedOptions = [];
  gs.tokensThisChallenge = 0;
  gs.llmUsedThisChallenge = false;

  setNarrative(`Reto ${ch.number} de ${CHALLENGES.length} — ${ch.title}`);
  $("challenge-num").textContent = `Reto ${ch.number} / ${CHALLENGES.length}`;
  $("challenge-title-text").textContent = ch.title;
  $("challenge-question").innerHTML = ch.question;

  // Multi-answer hint
  const multi = isMultiple(ch);
  $("challenge-multi-hint").style.display = multi ? "block" : "none";

  // Render option buttons
  const container = $("challenge-options");
  container.innerHTML = "";
  container.dataset.multi = multi ? "true" : "false";
  ch.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.dataset.index = i;
    btn.innerHTML = `<span class="opt-label">${opt.label}</span><span class="opt-text">${opt.text}</span>`;
    btn.addEventListener("click", () => handleOptionClick(i));
    container.appendChild(btn);
  });

  // Reset LLM section
  $("llm-prompt").value = "";
  $("llm-response-area").innerHTML = "";
  $("llm-response-area").classList.remove("visible");
  $("cost-preview").textContent = "";
  $("btn-submit").disabled = true;

  // Reset mode buttons
  document.querySelectorAll(".mode-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.mode === gs.mode)
  );

  refreshLLMAvailability();
  showScreen("challenge");
}

function refreshLLMAvailability() {
  const canUse = gs.tokens > 0;
  $("llm-prompt").disabled = !canUse;
  $("btn-consult").disabled = !canUse;
  $("no-tokens-msg").style.display = canUse ? "none" : "block";
}

function handleOptionClick(index) {
  const ch = CHALLENGES[gs.challengeIndex];
  if (isMultiple(ch)) {
    // Toggle selection (checkbox behaviour)
    const pos = gs.selectedOptions.indexOf(index);
    if (pos === -1) {
      gs.selectedOptions.push(index);
    } else {
      gs.selectedOptions.splice(pos, 1);
    }
  } else {
    // Radio behaviour: exactly one selected
    gs.selectedOptions = [index];
  }
  document.querySelectorAll(".option-btn").forEach((btn, i) => {
    btn.classList.toggle("selected", gs.selectedOptions.includes(i));
  });
  $("btn-submit").disabled = gs.selectedOptions.length === 0;
}

// ─── LLM consultation ──────────────────────────────────────────────────────────

function handleConsult() {
  const prompt = $("llm-prompt").value.trim();
  if (!prompt) {
    showLLMMsg("⚠️ Escribe una consulta antes de preguntar.", "warn");
    return;
  }
  if (gs.tokens <= 0) {
    showLLMMsg("⚠️ Sin tokens. No puedes consultar al LLM.", "warn");
    return;
  }

  const ch = CHALLENGES[gs.challengeIndex];
  const { text, cost } = simulateLLM(ch.id, prompt, gs.mode);

  // Deduct tokens (don't go negative)
  const deducted = Math.min(cost, gs.tokens);
  gs.tokens -= deducted;
  gs.totalSpent += deducted;
  gs.tokensThisChallenge += deducted;
  gs.llmUsedThisChallenge = true;

  updateHUD();

  // Promptzilla reacts harder for expensive queries
  if (deducted >= 15) promptzillaRoar();

  // Show response
  const modeTag = gs.mode === "socratic"
    ? '<span class="tag-socratic">Socrático ×1</span>'
    : '<span class="tag-direct">Directo ×2</span>';

  $("llm-response-area").innerHTML = `
    <div class="llm-header">
      <span class="llm-icon">🤖</span>
      ${modeTag}
      <span class="llm-cost">−${deducted} tokens</span>
    </div>
    <div class="llm-text">${text}</div>
  `;
  $("llm-response-area").classList.add("visible");

  // Clear prompt & preview
  $("llm-prompt").value = "";
  $("cost-preview").textContent = "";
  refreshLLMAvailability();
}

function showLLMMsg(msg, type) {
  $("llm-response-area").innerHTML = `<div class="llm-msg-${type}">${msg}</div>`;
  $("llm-response-area").classList.add("visible");
}

// ─── Answer submission ─────────────────────────────────────────────────────────

function handleSubmit() {
  if (gs.selectedOptions.length === 0) return;
  const ch = CHALLENGES[gs.challengeIndex];
  const correct = selectedMatchesCorrect(gs.selectedOptions, ch);

  gs.results.push({
    challengeId: ch.id,
    correct,
    tokensSpent: gs.tokensThisChallenge,
    llmUsed: gs.llmUsedThisChallenge
  });

  showFeedback(correct, ch);
}

// ─── Screen: Feedback ──────────────────────────────────────────────────────────

function showFeedback(correct, ch) {
  const icon = $("fb-icon");
  icon.textContent = correct ? "✓" : "✗";
  icon.className = "fb-icon " + (correct ? "fb-correct" : "fb-wrong");

  $("fb-result").textContent = correct ? "¡Correcto!" : "Incorrecto";
  $("fb-result").className = "fb-result " + (correct ? "fb-correct" : "fb-wrong");

  const correctIndices = getCorrectSet(ch);
  const correctTexts   = correctIndices.map(i => ch.options[i].text).join(" y ");
  const answerLabel    = correctIndices.length > 1 ? "Respuestas correctas" : "Respuesta correcta";
  $("fb-answer").innerHTML = `${answerLabel}: ${correctTexts}`;

  const spent = gs.tokensThisChallenge;
  $("fb-tokens").textContent = spent > 0
    ? `Tokens usados en este reto: ${spent}`
    : "✨ Resuelto sin consultar al LLM";

  $("fb-remaining").textContent = `Tokens restantes: ${gs.tokens} / ${INITIAL_TOKENS}`;

  const isLast = gs.challengeIndex >= CHALLENGES.length - 1;
  $("btn-next").textContent = isLast ? "Ver puntuación →" : "Siguiente reto →";

  setNarrative(correct
    ? "¡Bien hecho! Promptzilla gruñe… pero retrocede un poco."
    : "Error… Promptzilla absorbe energía y crece.");

  if (!correct) promptzillaRoar();
  showScreen("feedback");
}

// ─── Screen: Score ─────────────────────────────────────────────────────────────

function showScore() {
  const correct = gs.results.filter(r => r.correct).length;
  const total = CHALLENGES.length;
  const remaining = gs.tokens;

  // Efficiency score: 60% from correctness, 40% from token savings
  const efficiency = Math.round((correct / total) * 60 + (remaining / INITIAL_TOKENS) * 40);

  let grade, gradeClass, message;
  if (efficiency >= 80) {
    grade = "A"; gradeClass = "grade-a";
    message = "¡Excelente! Has usado la IA de forma estratégica y responsable.";
  } else if (efficiency >= 60) {
    grade = "B"; gradeClass = "grade-b";
    message = "¡Bien! Podrías haber sido más eficiente con los tokens.";
  } else if (efficiency >= 40) {
    grade = "C"; gradeClass = "grade-c";
    message = "Puedes mejorar. Intenta usar la IA solo cuando sea realmente necesario.";
  } else {
    grade = "D"; gradeClass = "grade-d";
    message = "Has alimentado demasiado a Promptzilla. La próxima vez, piensa antes de consultar.";
  }

  $("score-grade").textContent = grade;
  $("score-grade").className = "score-grade " + gradeClass;
  $("score-correct").textContent = `Respuestas correctas: ${correct} / ${total}`;
  $("score-spent").textContent = `Tokens gastados: ${gs.totalSpent}`;
  $("score-remaining").textContent = `Tokens restantes: ${remaining}`;
  $("score-efficiency").textContent = `Puntuación de eficiencia: ${efficiency} / 100`;
  $("score-message").textContent = message;

  setNarrative(
    grade === "A" || grade === "B"
      ? "Promptzilla vuelve a dormitar… ¡el aula está a salvo! 🎉"
      : "Promptzilla ruge en la oscuridad… el planeta tiembla. 🌍"
  );

  showScreen("score");
}

// ─── Navigation helpers ────────────────────────────────────────────────────────

function handleNext() {
  gs.challengeIndex++;
  if (gs.challengeIndex >= CHALLENGES.length) {
    showScore();
  } else {
    showChallenge();
  }
}

// ─── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {

  // Start button
  $("btn-start").addEventListener("click", showChallenge);

  // Mode toggle
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      gs.mode = btn.dataset.mode;
      updateCostPreview();
    });
  });

  // Live cost preview while typing
  $("llm-prompt").addEventListener("input", updateCostPreview);

  // Consult button
  $("btn-consult").addEventListener("click", handleConsult);

  // Also submit on Enter in prompt field
  $("llm-prompt").addEventListener("keydown", e => {
    if (e.key === "Enter" && !$("btn-consult").disabled) handleConsult();
  });

  // Submit answer
  $("btn-submit").addEventListener("click", handleSubmit);

  // Next challenge / go to score
  $("btn-next").addEventListener("click", handleNext);

  // Restart
  $("btn-restart").addEventListener("click", initIntro);

  // Init
  initIntro();

  // Sprites: preload frames + start idle cycling
  preloadSprites();
  startIdle('avatar-svg',      950,   0);
  startIdle('teacher-svg',    1100, 350);
  startIdle('promptzilla-svg', 800,  700);
});

function updateCostPreview() {
  const preview = getCostPreview($("llm-prompt").value, gs.mode);
  if (!preview) {
    $("cost-preview").textContent = "";
    return;
  }
  $("cost-preview").textContent =
    `Coste estimado: ${preview.cost} tokens (${preview.words} ${preview.words === 1 ? "palabra" : "palabras"})`;
}

// ─── Sprite idle animation helpers ────────────────────────────────────────────

const SPRITE_FRAMES = {
  'avatar-svg':      [
    'assets/characters/player_idle_1.png',
    'assets/characters/player_idle_2.png',
    'assets/characters/player_idle_3.png'
  ],
  'teacher-svg':     [
    'assets/characters/teacher_idle_1.png',
    'assets/characters/teacher_idle_2.png',
    'assets/characters/teacher_idle_3.png'
  ],
  'promptzilla-svg': [
    'assets/characters/promptzilla_idle_1.png',
    'assets/characters/promptzilla_idle_2.png',
    'assets/characters/promptzilla_idle_3.png'
  ]
};

function preloadSprites() {
  Object.values(SPRITE_FRAMES).flat().forEach(src => {
    const img = new Image();
    img.src = src;
  });
}

function startIdle(id, period, delay) {
  const frames = SPRITE_FRAMES[id];
  if (!frames) return;
  const el = document.getElementById(id);
  if (!el) return;
  let idx = 0;
  setTimeout(() => {
    setInterval(() => {
      if (id === 'promptzilla-svg' && el.classList.contains('pz-roar')) return;
      // Promptzilla: solo frames 2-3 mientras duerme; todos cuando ha crecido
      const seq = (id === 'promptzilla-svg' && el.classList.contains('pz-sleeping'))
        ? [1, 2]
        : [0, 1, 2, 1];
      idx = (idx + 1) % seq.length;
      el.src = frames[seq[idx]];
    }, period);
  }, delay);
}
