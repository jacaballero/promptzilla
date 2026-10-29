// Promptzilla — Adventure engine
// Code language: English | UI strings in Spanish
//
// Responsibilities:
//   • Global game state (tokens, flags, inventory, player position)
//   • Scene building from SCENES data (placeholder backgrounds for now)
//   • Click-to-walk movement with "walk there, then act" interactions
//   • Contextual hotspot handling (exits, characters, look-at)
//   • Dialogue trees (DIALOGUES) with challenge integration
//   • Minimal HUD + inventory scaffold + win screen
//
// Everything visual is data-driven so scenes/characters/dialogues can grow
// without touching this file.

"use strict";

/* global SCENES, DIALOGUES, Challenge, PromptEval */

// ─── Sprite frame registry ─────────────────────────────────────────────────
const SPRITES = {
  player: [
    "assets/characters/player_idle_1.png",
    "assets/characters/player_idle_2.png",
    "assets/characters/player_idle_3.png"
  ],
  playerWalk: [
    "assets/characters/player_walk_1.png",
    "assets/characters/player_walk_2.png",
    "assets/characters/player_walk_3.png",
    "assets/characters/player_walk_4.png",
    "assets/characters/player_walk_5.png",
    "assets/characters/player_walk_6.png",
    "assets/characters/player_walk_7.png",
    "assets/characters/player_walk_8.png"
  ],
  teacher: [
    "assets/characters/teacher_idle_1.png",
    "assets/characters/teacher_idle_2.png",
    "assets/characters/teacher_idle_3.png"
  ],
  "student-girl": [
    "assets/characters/student_girl_ponytail_idle_1.png",
    "assets/characters/student_girl_ponytail_idle_2.png",
    "assets/characters/student_girl_ponytail_idle_3.png"
  ],
  "student-boy": [
    "assets/characters/student_boy_headsets_idle_1.png",
    "assets/characters/student_boy_headsets_idle_2.png",
    "assets/characters/student_boy_headsets_idle_3.png"
  ],
  "students-plaza": [
    "assets/characters/students_group_1.png",   // 0: todos hablando (A)
    "assets/characters/students_group_2.png",   // 1: todos con la boca cerrada
    "assets/characters/students_group_3.png",   // 2: todos hablando (B)
    "assets/characters/students_group_5.png",   // 3: habla el del centro
    "assets/characters/students_group_6.png"    // 4: habla el de la derecha
  ],
  "student-glasses": [
    "assets/characters/student_glasses_yellow_idle_1.png",
    "assets/characters/student_glasses_yellow_idle_3.png",
    "assets/characters/student_glasses_yellow_idle_4.png"
  ],
  promptzilla: [
    "assets/characters/promptzilla_idle_1.png",
    "assets/characters/promptzilla_idle_2.png",
    "assets/characters/promptzilla_idle_3.png"
  ]
};

const INITIAL_TOKENS = (window.CONFIG && window.CONFIG.economy && window.CONFIG.economy.initialTokens) || 150;
const WALK_SPEED = 39; // percent of stage per second (euclidean)
const DEFAULT_WALK = { yMin: 58, yMax: 90, near: 1.4, far: 0.01 };

// ─── Global game state ──────────────────────────────────────────────────────
const GAME = {
  tokens: INITIAL_TOKENS,
  totalSpent: 0,
  flags: {},
  sceneId: null,
  player: { x: 50, y: 85, facing: "right" }
};
window.GAME = GAME;

// ─── DOM refs ───────────────────────────────────────────────────────────────
let stageEl, playerEl, captionEl, dialogueEl, hudTokensEl, hoverNameEl, sayBarEl;
const idleTimers = [];

// ─── Dialogue runtime state ─────────────────────────────────────────────────
let curDialogue = null;

// ─── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  stageEl = document.getElementById("stage");
  captionEl = document.getElementById("caption");
  dialogueEl = document.getElementById("dialogue-box");
  hudTokensEl = document.getElementById("hud-tokens");
  hoverNameEl = document.getElementById("hover-name");
  sayBarEl = document.getElementById("say-bar");

  document.addEventListener("dragstart", e => e.preventDefault());   // block sprite dragging

  refreshHUD();
  if (window.LLM && LLM.warmup) LLM.warmup();   // pre-warm the model while the start screen is shown
  showStartScreen();
});

// ─── Start screen ───────────────────────────────────────────────────────────
// Preloads every image while the player reads the intro; the scene is only
// built after "Empezar", so the first room never waits on the network.
function showStartScreen() {
  const screen = document.getElementById("start-screen");
  if (!screen) { startGame(); return; }

  const bar = document.getElementById("start-bar");
  const status = document.getElementById("start-status");
  const btn = document.getElementById("start-btn");
  if (window.PromptEval && !PromptEval.enabled()) {
    const rule = document.getElementById("start-report-rule");
    if (rule) rule.style.display = "none";
  }

  let ready = false;
  const enable = (label) => {
    if (ready) return;
    ready = true;
    btn.disabled = false;
    btn.textContent = "Empezar →";
    status.textContent = label;
    btn.focus({ preventScroll: true });
  };

  preloadAssets((done, total) => {
    const pct = Math.round((done / total) * 100);
    bar.style.width = pct + "%";
    if (!ready) status.textContent = `Cargando… ${pct}%`;
  }).then(() => enable("¡Todo listo!"));
  // Never trap the player behind a stalled request.
  setTimeout(() => enable("Aún se está cargando, pero ya puedes empezar."), 30000);

  btn.addEventListener("click", () => {
    if (!ready) return;
    screen.remove();
    startGame();
  });
}

function startGame() {
  changeScene("entrance", "default");
  startPlayerAnim();
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
function refreshHUD() {
  if (hudTokensEl) hudTokensEl.textContent = `${GAME.tokens} / ${INITIAL_TOKENS} tokens`;
}
window.refreshHUD = refreshHUD;

// ─── Scene building ─────────────────────────────────────────────────────────
function changeScene(sceneId, entryKey) {
  const scene = SCENES[sceneId];
  if (!scene) { console.error("Scene not found:", sceneId); return; }

  idleTimers.forEach(clearInterval);
  idleTimers.length = 0;
  stageEl.innerHTML = "";
  closeBubble();
  hideHoverName();
  GAME.sceneId = sceneId;

  // Background
  const bg = document.createElement("div");
  bg.className = "scene-bg" + (scene.bg.image ? "" : ` theme-${scene.bg.theme || "hallway"}`);
  if (scene.bg.image) bg.style.backgroundImage = `url("${scene.bg.image}")`;
  stageEl.appendChild(bg);
  bg.addEventListener("click", onFloorClick);

  // Hotspots
  scene.hotspots.forEach(h => stageEl.appendChild(buildHotspot(h)));

  // Characters
  (scene.characters || []).forEach(c => stageEl.appendChild(buildCharacter(c)));

  // Player
  const entry = (scene.entryPoints && scene.entryPoints[entryKey]) ||
                (scene.entryPoints && scene.entryPoints.default) || { x: 50, y: 85 };
  GAME.player.x = entry.x;
  GAME.player.y = entry.y;
  playerEl = buildPlayer(entry.x, entry.y);
  stageEl.appendChild(playerEl);

  // Foreground layer: a transparent cutout drawn ABOVE characters so props
  // (desk, chairs…) can overlap the character. Aligned via the same cover sizing.
  if (scene.bg.foregroundImage) {
    const fg = document.createElement("div");
    fg.className = "scene-fg";
    fg.style.backgroundImage = `url("${scene.bg.foregroundImage}")`;
    stageEl.appendChild(fg);
  }

  if (captionEl) captionEl.textContent = scene.caption || scene.name;
  if (DEBUG) drawWalkDebug(scene);
}

// ─── Debug mode (open the game with ?debug) ─────────────────────────────────
// Draws the walk-area overlay and lets dialogues skip progression checks
// (e.g. the teacher's exam is available without doing the practice challenges).
const DEBUG = new URLSearchParams(location.search).has("debug");
window.DEBUG = DEBUG;

// Walk-area overlay:
// Green: walkable polygon (vertices numbered as in scenes.data.js).
// Red: obstacles. Yellow: hotspot/character approach points. The top-left
// readout shows the cursor position in scene percentages.

function drawWalkDebug(scene) {
  const w = scene.walk || {};
  const layer = document.createElement("div");
  layer.className = "walk-debug";
  const poly = w.polygon || [[w.xMin ?? 0, w.yMin], [w.xMax ?? 100, w.yMin], [w.xMax ?? 100, w.yMax], [w.xMin ?? 0, w.yMax]];
  const pts = poly.map(p => p.join(",")).join(" ");
  const rects = (scene.obstacles || []).map(o =>
    `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" class="wd-obstacle"/>`).join("");
  layer.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <polygon points="${pts}" class="wd-poly"/>${rects}</svg>`;

  const label = (x, y, text, cls) => {
    const el = document.createElement("span");
    el.className = "wd-label " + cls;
    el.style.left = x + "%";
    el.style.top = y + "%";
    el.textContent = text;
    layer.appendChild(el);
  };
  poly.forEach(([x, y], i) => label(x, y, `${i + 1} (${x}, ${y})`, "wd-vertex"));
  scene.hotspots.forEach(h => h.approach && label(h.approach.x, h.approach.y, `▼ ${h.label}`, "wd-approach"));
  (scene.characters || []).forEach(c => c.approach && label(c.approach.x, c.approach.y, `▼ ${c.id}`, "wd-approach"));

  const cursor = document.createElement("span");
  cursor.className = "wd-cursor";
  layer.appendChild(cursor);
  stageEl.addEventListener("mousemove", e => {
    const r = stageEl.getBoundingClientRect();
    cursor.textContent = `x ${((e.clientX - r.left) / r.width * 100).toFixed(1)} · y ${((e.clientY - r.top) / r.height * 100).toFixed(1)}`;
  });
  stageEl.appendChild(layer);
}

function buildHotspot(h) {
  const el = document.createElement("div");
  el.className = `hotspot hotspot-${h.kind}`;
  el.style.left = h.x + "%";
  el.style.top = h.y + "%";
  el.style.width = h.w + "%";
  el.style.height = h.h + "%";
  el.addEventListener("click", e => {
    e.stopPropagation();
    onHotspotClick(h);
  });
  el.addEventListener("mouseenter", () => showHoverName(h));
  el.addEventListener("mouseleave", hideHoverName);
  return el;
}

function buildCharacter(c) {
  const wrap = document.createElement("div");
  wrap.className = "character-wrap";
  if (c.noShadow) wrap.classList.add("no-shadow");
  positionEntity(wrap, c.x, c.y);
  if (c.scale) wrap.style.setProperty("--cscale", c.scale);   // per-character size

  const img = document.createElement("img");
  img.className = "character";
  img.src = SPRITES[c.sprite][0];
  img.alt = "";
  wrap.appendChild(img);

  if (c.static) {
    wrap.style.pointerEvents = "none";   // ambient decor: let hotspots take the click
  } else if (c.hit) {
    // Tuned clickable box (percent of the sprite), anchored at the feet. The
    // whole sprite box is made inert so only this box takes hover/click.
    wrap.style.pointerEvents = "none";
    const hit = document.createElement("div");
    hit.className = "char-hit";
    hit.style.pointerEvents = "auto";
    hit.style.width = (c.hit.w ?? 60) + "%";
    hit.style.height = (c.hit.h ?? 90) + "%";
    hit.style.bottom = (c.hit.y ?? 0) + "%";
    hit.addEventListener("click", e => { e.stopPropagation(); onCharacterClick(c); });
    hit.addEventListener("mouseenter", () => wrap.classList.add("hovered"));
    hit.addEventListener("mouseleave", () => wrap.classList.remove("hovered"));
    wrap.appendChild(hit);
  } else {
    wrap.addEventListener("click", e => {
      e.stopPropagation();
      onCharacterClick(c);
    });
  }

  startIdle(img, SPRITES[c.sprite], c.animMs || (950 + Math.random() * 300), Math.random() * 500, c.animSeq);
  return wrap;
}

function buildPlayer(x, y) {
  const wrap = document.createElement("div");
  wrap.id = "player";
  wrap.classList.add("idlepose");   // start in idle orientation, no flip on load

  const img = document.createElement("img");
  img.src = SPRITES.player[0];
  img.alt = "";
  wrap.appendChild(img);

  const flip = GAME.player.facing === "left" ? -1 : 1;
  positionEntity(wrap, x, y, flip);

  return wrap;
}

// Positions an entity by its feet at (x%, y%), scaling by scene depth.
function positionEntity(el, x, y, flip) {
  el.style.left = x + "%";
  el.style.top = y + "%";
  el.style.setProperty("--depth", depthScale(y).toFixed(3));
  if (flip !== undefined) el.style.setProperty("--flip", flip);
  el.style.zIndex = Math.round(y);
}

function depthScale(y) {
  const s = SCENES[GAME.sceneId] || {};
  const w = s.walk || DEFAULT_WALK;
  // Perspective anchors are independent of the walkable band (yMin/yMax), so
  // changing how far the player can walk doesn't flatten the size falloff.
  const nearY = w.depthNearY ?? w.yMax;
  const farY = w.depthFarY ?? w.yMin;
  const t = Math.max(0, Math.min(1, (y - farY) / (nearY - farY)));
  return (w.far + t * (w.near - w.far)) * (s.charScale || 1);
}

// ─── Movement ───────────────────────────────────────────────────────────────
// Reads the sprite's actual on-screen feet position (as scene percentages),
// even mid-transition, so an interrupted walk resumes from where it visually is.
function currentPlayerPos() {
  const w = stageEl.clientWidth || 1;
  const h = stageEl.clientHeight || 1;
  const cs = getComputedStyle(playerEl);
  const px = parseFloat(cs.left);
  const py = parseFloat(cs.top);
  if (Number.isNaN(px) || Number.isNaN(py)) return { x: GAME.player.x, y: GAME.player.y };
  return { x: (px / w) * 100, y: (py / h) * 100 };
}

function walkTo(x, y, cb) {
  const scene = SCENES[GAME.sceneId] || {};
  const w = scene.walk || DEFAULT_WALK;
  const obstacles = scene.obstacles || [];
  clearTimeout(playerEl._t);
  // Sync logical position to the real on-screen spot so a re-click mid-walk
  // doesn't start from an already-advanced position and slide.
  const cur = currentPlayerPos();
  GAME.player.x = cur.x; GAME.player.y = cur.y;
  const start = { x: cur.x, y: cur.y };
  const target = resolveTarget(start, x, y, obstacles, 3, w);
  const path = findPath(start, target, obstacles, w);
  walkAlong(path.slice(1), cb);
}

// Walk through a list of waypoints, one CSS transition per segment.
function walkAlong(points, cb) {
  if (!points.length) {
    if (playerEl) {
      playerEl.classList.remove("walking");
      playerEl.classList.add("idlepose");
      const img = playerEl.querySelector("img");
      if (img) img.src = SPRITES.player[0];
    }
    if (cb) cb();
    return;
  }
  const p = points[0];
  moveStep(p.x, p.y, () => walkAlong(points.slice(1), cb));
}

function moveStep(x, y, cb) {
  const dx = x - GAME.player.x;
  const dy = y - GAME.player.y;
  const dist = Math.hypot(dx, dy);
  if (Math.abs(dx) > 0.01) GAME.player.facing = dx < 0 ? "left" : "right";
  const flip = GAME.player.facing === "left" ? -1 : 1;

  if (dist < 0.6) {
    GAME.player.x = x; GAME.player.y = y;
    positionEntity(playerEl, x, y, flip);
    if (cb) cb();
    return;
  }
  const dur = Math.max(0.14, dist / WALK_SPEED);
  GAME.player.x = x; GAME.player.y = y;
  playerEl.classList.remove("idlepose");   // switch to walk orientation instantly
  playerEl.classList.add("walking");
  playerEl.style.transitionDuration = dur + "s";
  positionEntity(playerEl, x, y, flip);
  playerEl._t = setTimeout(() => { if (cb) cb(); }, dur * 1000);
}

// ─── Walkable area / obstacle avoidance ────────────────────────────────────
function clampv(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function pointInRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

// Point-in-polygon (ray casting) and nearest-point clamp onto the polygon edges.
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function clampToPoly(x, y, poly) {
  if (pointInPoly(x, y, poly)) return { x, y };
  let best = { x, y }, bd = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], ay = poly[j][1], bx = poly[i][0], by = poly[i][1];
    const dx = bx - ax, dy = by - ay;
    let t = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1);
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx, py = ay + t * dy;
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bd) { bd = d; best = { x: px, y: py }; }
  }
  return best;
}

// Clamp the target into the walkable area (band + optional polygon) and, if it
// lands inside an obstacle, pull it back toward the player to a reachable edge.
function resolveTarget(start, x, y, obstacles, pad, w) {
  x = clampv(x, w.xMin ?? 4, w.xMax ?? 96);
  y = clampv(y, w.yMin, w.yMax);
  if (w.polygon) { const p = clampToPoly(x, y, w.polygon); x = p.x; y = p.y; }
  const inside = (px, py) => obstacles.some(o =>
    pointInRect(px, py, { x: o.x - pad, y: o.y - pad, w: o.w + 2 * pad, h: o.h + 2 * pad }));
  if (!inside(x, y)) return { x, y };
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const px = x + (start.x - x) * t;
    const py = y + (start.y - y) * t;
    if (!inside(px, py)) return { x: px, y: py };
  }
  return { x: start.x, y: start.y };
}

function segCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
         ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function segHitsRect(a, b, r) {
  if (pointInRect(a.x, a.y, r) || pointInRect(b.x, b.y, r)) return true;
  const c = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y },
             { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
  return segCross(a, b, c[0], c[1]) || segCross(a, b, c[1], c[2]) ||
         segCross(a, b, c[2], c[3]) || segCross(a, b, c[3], c[0]);
}

// Visibility-graph shortest path around obstacle rectangles (Dijkstra).
function findPath(start, goal, obstacles, w) {
  if (!obstacles.length) return [start, goal];
  const mBlock = 2.5, mNode = 4;
  const block = obstacles.map(r => ({ x: r.x - mBlock, y: r.y - mBlock, w: r.w + 2 * mBlock, h: r.h + 2 * mBlock }));
  const clear = (a, b) => block.every(r => !segHitsRect(a, b, r));
  if (clear(start, goal)) return [start, goal];

  const nodes = [start, goal];
  obstacles.forEach(r => {
    const e = { x: r.x - mNode, y: r.y - mNode, w: r.w + 2 * mNode, h: r.h + 2 * mNode };
    [[e.x, e.y], [e.x + e.w, e.y], [e.x + e.w, e.y + e.h], [e.x, e.y + e.h]].forEach(([x, y]) => {
      nodes.push({ x: clampv(x, w.xMin ?? 4, w.xMax ?? 96), y: clampv(y, w.yMin, w.yMax) });
    });
  });
  const valid = nodes.filter((n, i) => i < 2 || !block.some(r => pointInRect(n.x, n.y, r)));

  const N = valid.length;
  const adj = Array.from({ length: N }, () => []);
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    if (clear(valid[i], valid[j])) {
      const d = Math.hypot(valid[i].x - valid[j].x, valid[i].y - valid[j].y);
      adj[i].push([j, d]); adj[j].push([i, d]);
    }
  }
  const dist = Array(N).fill(Infinity), prev = Array(N).fill(-1), done = Array(N).fill(false);
  dist[0] = 0;
  for (let it = 0; it < N; it++) {
    let u = -1, best = Infinity;
    for (let k = 0; k < N; k++) if (!done[k] && dist[k] < best) { best = dist[k]; u = k; }
    if (u === -1 || u === 1) break;
    done[u] = true;
    adj[u].forEach(([v, d]) => { if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; prev[v] = u; } });
  }
  if (dist[1] === Infinity) return [start, goal];
  const path = []; let cur = 1;
  while (cur !== -1) { path.unshift(valid[cur]); cur = prev[cur]; }
  return path;
}

// ─── Input handlers ─────────────────────────────────────────────────────────
function onFloorClick(e) {
  if (curDialogue) return;
  const rect = stageEl.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  closeBubble();
  walkTo(x, y);
}

function onHotspotClick(h) {
  if (curDialogue) return;
  const w = (SCENES[GAME.sceneId] && SCENES[GAME.sceneId].walk) || DEFAULT_WALK;
  const ap = h.approach || { x: h.approachX ?? 50, y: w.yMax - 4 };
  closeBubble();
  walkTo(ap.x, ap.y, () => {
    if (h.kind === "exit") {
      changeScene(h.target, h.targetEntry || "default");
    } else if (h.kind === "look") {
      say(h.look || "No hay nada interesante aquí.");
    }
  });
}

function onCharacterClick(c) {
  if (curDialogue) return;
  const off = 10;
  // Optional per-character `approach` point (e.g. for very wide sprites).
  const ax = c.approach ? c.approach.x : (c.x < GAME.player.x ? c.x + off : c.x - off);
  const ay = c.approach ? c.approach.y : c.y;
  closeBubble();
  walkTo(ax, ay, () => {
    GAME.player.facing = c.x < GAME.player.x ? "left" : "right";
    const flip = GAME.player.facing === "left" ? -1 : 1;
    positionEntity(playerEl, GAME.player.x, GAME.player.y, flip);
    if (c.dialogue) openDialogue(c.dialogue);
  });
}

// ─── Player speech bubble ───────────────────────────────────────────────────
function say(text) {
  if (!sayBarEl) return;
  sayBarEl.innerHTML = text;
  sayBarEl.style.display = "block";
}
function closeBubble() {
  if (sayBarEl) { sayBarEl.style.display = "none"; clearTimeout(sayBarEl._t); }
}
// Places the name pill above the hotspot, or below it when there's no room up top.
function showHoverName(h) {
  if (!hoverNameEl || !h.label) return;
  hoverNameEl.textContent = h.label;
  const cx = Math.max(10, Math.min(90, h.x + h.w / 2));
  hoverNameEl.style.left = cx + "%";
  if (h.y > 6) {
    hoverNameEl.style.top = `calc(${h.y}% + 20px)`;
    hoverNameEl.style.transform = "translate(-50%, -100%)";
  } else {
    hoverNameEl.style.top = `calc(${h.y + h.h}% - 20px)`;
    hoverNameEl.style.transform = "translate(-50%, 0)";
  }
  hoverNameEl.classList.add("show");
}
function hideHoverName() {
  if (hoverNameEl) hoverNameEl.classList.remove("show");
}

// ─── Dialogue system ────────────────────────────────────────────────────────
function openDialogue(dialogueId) {
  const d = DIALOGUES[dialogueId];
  if (!d) { console.error("Dialogue not found:", dialogueId); return; }
  closeBubble();
  hideHoverName();
  curDialogue = { id: dialogueId, data: d };
  goToNode(d.start);
}

function goToNode(nodeId) {
  let node = curDialogue.data.nodes[nodeId];
  if (!node) { closeDialogue(); return; }

  // Router node: jump immediately based on game state
  if (node.route) { goToNode(node.route(GAME)); return; }

  if (node.setFlag) GAME.flags[node.setFlag] = true;

  renderDialogue(node);
}

function renderDialogue(node) {
  dialogueEl.innerHTML = "";
  dialogueEl.style.display = "block";

  const npc = document.createElement("div");
  npc.className = "dlg-npc";
  npc.innerHTML = (typeof node.npc === "function" ? node.npc(GAME) : node.npc) || "";
  dialogueEl.appendChild(npc);

  const opts = document.createElement("div");
  opts.className = "dlg-options";
  (node.options || []).forEach(opt => {
    if (opt.requires && !GAME.flags[opt.requires]) return;
    if (opt.hideIfFlag && GAME.flags[opt.hideIfFlag]) return;
    // An answered challenge (right or wrong) can never be repeated.
    if (opt.action && opt.action.type === "challenge" && isChallengeAnswered(opt.action.challengeId)) return;
    const btn = document.createElement("button");
    btn.className = "dlg-option";
    btn.innerHTML = opt.text;
    btn.addEventListener("click", () => chooseOption(opt));
    opts.appendChild(btn);
  });
  dialogueEl.appendChild(opts);
}

function chooseOption(opt) {
  if (opt.setFlag) GAME.flags[opt.setFlag] = true;

  if (opt.action) { handleAction(opt.action); return; }
  if (opt.end) { closeDialogue(); return; }
  if (opt.goto) { goToNode(opt.goto); return; }
  closeDialogue();
}

function failedFlag(challengeId) { return "failedChallenge" + challengeId; }
function answeredFlag(challengeId) { return "answeredChallenge" + challengeId; }
function isChallengeAnswered(challengeId) { return !!GAME.flags[answeredFlag(challengeId)]; }

function handleAction(action) {
  if (action.type === "challenge") {
    dialogueEl.style.display = "none";
    Challenge.open(action.challengeId, {
      onWin: () => {
        GAME.flags[answeredFlag(action.challengeId)] = true;
        resumeDialogue(action.onWinGoto);
      },
      onLose: () => {
        GAME.flags[answeredFlag(action.challengeId)] = true;
        GAME.flags[failedFlag(action.challengeId)] = true;
        resumeDialogue(action.onLoseGoto);
      },
      onExit: () => closeDialogue()
    });
  } else if (action.type === "win" || action.type === "lose") {
    closeDialogue();
    showEnd();
  }
}

// Every challenge the player can meet: collected from the dialogue actions, so
// adding a new one to DIALOGUES automatically counts towards the final grade.
function gameChallengeIds() {
  const ids = new Set();
  Object.values(DIALOGUES).forEach(d => Object.values(d.nodes).forEach(n =>
    (n.options || []).forEach(o => {
      if (o.action && o.action.type === "challenge") ids.add(o.action.challengeId);
    })));
  return [...ids];
}

function resumeDialogue(nodeId) {
  if (nodeId) goToNode(nodeId);
  else closeDialogue();
}

function closeDialogue() {
  curDialogue = null;
  dialogueEl.style.display = "none";
  dialogueEl.innerHTML = "";
}

// ─── End screen ─────────────────────────────────────────────────────────────
function showEnd() {
  const spent = GAME.totalSpent;
  const remaining = GAME.tokens;

  // Grade by number of challenges answered correctly, out of all the ones in the game.
  const ids = gameChallengeIds();
  const total = ids.length;
  const correct = ids.filter(id => GAME.flags[answeredFlag(id)] && !GAME.flags[failedFlag(id)]).length;
  const letter = "ABCDE"[Math.min(total - correct, 4)];
  const summary = correct === 0 ? `No acertaste ninguno de los ${total} retos.`
                                : `Acertaste ${correct} de los ${total} retos.`;

  const usedRatio = spent / INITIAL_TOKENS;
  const flavor = usedRatio > 0.9
    ? "Has cebado a Promptzilla: se ha zampado casi todos tus tokens y ahora ronda la facultad más grande que nunca."
    : usedRatio < 0.25
    ? "Has puesto a Promptzilla a dieta: apenas ha probado tus tokens y se ha quedado con hambre."
    : "Promptzilla sigue en la ciudad, pero hoy no lo has cebado. La facultad respira.";

  const overlay = document.createElement("div");
  overlay.id = "win-screen";
  overlay.innerHTML = `
    <div class="win-card">
      <h1 class="win-letter grade-${letter.toLowerCase()}">${letter}</h1>
      <p class="win-grade">${summary}</p>
      <p>Tokens gastados: <strong>${spent}</strong> · Restantes: <strong>${remaining}</strong></p>
      <p class="win-flavor">${flavor}</p>
      <div id="win-report" class="win-report" style="display:none">
        <p class="rep-loading">Analizando tus prompts…</p>
      </div>
      <div class="win-actions">
        <button id="win-download" class="btn-secondary" style="display:none">Descargar informe (HTML)</button>
        <button id="win-restart" class="btn-primary">Volver a empezar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  if (PromptEval.enabled()) {
    const reportEl = overlay.querySelector("#win-report");
    const downloadBtn = overlay.querySelector("#win-download");
    const restartBtn = overlay.querySelector("#win-restart");
    reportEl.style.display = "block";
    restartBtn.style.display = "none";
    PromptEval.finalize().catch(() => null).then(report => {
      if (!overlay.isConnected) return;
      restartBtn.style.display = "";
      if (!report) { reportEl.style.display = "none"; return; }
      reportEl.innerHTML = PromptEval.buildReportHTML(report);
      downloadBtn.style.display = "";
      downloadBtn.addEventListener("click", () => PromptEval.downloadReport(report));
    });
  }

  overlay.querySelector("#win-restart").addEventListener("click", () => {
    overlay.remove();
    PromptEval.reset();
    GAME.tokens = INITIAL_TOKENS;
    GAME.totalSpent = 0;
    GAME.flags = {};
    refreshHUD();
    changeScene("entrance", "default");
  });
}

// ─── Asset preloading ───────────────────────────────────────────────────────
// Images are kept referenced so the browser keeps them decoded in memory.
const preloadedImages = [];

function preloadAssets(onProgress) {
  const urls = new Set(Object.values(SPRITES).flat());
  Object.values(SCENES).forEach(s => {
    if (s.bg && s.bg.image) urls.add(s.bg.image);
    if (s.bg && s.bg.foregroundImage) urls.add(s.bg.foregroundImage);
  });
  const total = urls.size;
  let done = 0;
  return Promise.all([...urls].map(src => new Promise(resolve => {
    const img = new Image();
    preloadedImages.push(img);
    const finish = () => { done++; if (onProgress) onProgress(done, total); resolve(); };
    // Count on download; decode in the background (browsers defer decode() in
    // hidden tabs, which would otherwise stall the progress bar).
    img.onload = () => { if (img.decode) img.decode().catch(() => {}); finish(); };
    img.onerror = finish;   // a missing image must not block the start
    img.src = src;
  })));
}

// ─── Sprite idle cycling ────────────────────────────────────────────────────
function startIdle(imgEl, frames, period, delay, seq) {
  const order = seq && seq.length ? seq : [0, 1, 2, 1];
  let idx = 0;
  setTimeout(() => {
    const t = setInterval(() => {
      idx = (idx + 1) % order.length;
      imgEl.src = frames[order[idx]];
    }, period);
    idleTimers.push(t);
  }, delay);
}

// Drives the player's frames: walk cycle while moving, front idle when stopped.
// Orientation (idlepose) is toggled eagerly in moveStep/walkAlong, not here.
function startPlayerAnim() {
  let wi = 0, ii = 0, tick = 0, wasWalking = false;
  const idleSeq = [0, 1, 2, 1];
  const walkSeq = [0, 1, 2, 3, 4, 5, 6, 7];   // 8-frame walk cycle, in sheet order
  setInterval(() => {
    const img = playerEl && playerEl.querySelector("img");
    if (!img) return;
    if (playerEl.classList.contains("walking")) {
      wi = (wi + 1) % walkSeq.length;
      img.src = SPRITES.playerWalk[walkSeq[wi]];
      wasWalking = true;
    } else if (wasWalking) {                // just stopped: snap to idle now
      wasWalking = false; ii = 0; tick = 0;
      img.src = SPRITES.player[idleSeq[0]];
    } else if (++tick % 7 === 0) {
      ii = (ii + 1) % idleSeq.length;
      img.src = SPRITES.player[idleSeq[ii]];
    }
  }, 115);
}
