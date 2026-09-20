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

/* global SCENES, DIALOGUES, Challenge */

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
  promptzilla: [
    "assets/characters/promptzilla_idle_1.png",
    "assets/characters/promptzilla_idle_2.png",
    "assets/characters/promptzilla_idle_3.png"
  ]
};

const INITIAL_TOKENS = (window.CONFIG && window.CONFIG.economy && window.CONFIG.economy.initialTokens) || 100;
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

  preloadSprites();
  refreshHUD();
  changeScene("entrance", "default");
  startPlayerAnim();
});

// ─── HUD ──────────────────────────────────────────────────────────────────────
function refreshHUD() {
  if (hudTokensEl) hudTokensEl.textContent = `⚡ ${GAME.tokens} / ${INITIAL_TOKENS} tokens`;
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
  positionEntity(wrap, c.x, c.y);
  if (c.scale) wrap.style.setProperty("--cscale", c.scale);   // per-character size

  const img = document.createElement("img");
  img.className = "character";
  img.src = SPRITES[c.sprite][0];
  img.alt = "";
  wrap.appendChild(img);

  wrap.addEventListener("click", e => {
    e.stopPropagation();
    onCharacterClick(c);
  });

  startIdle(img, SPRITES[c.sprite], 950 + Math.random() * 300, Math.random() * 500);
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
function walkTo(x, y, cb) {
  const scene = SCENES[GAME.sceneId] || {};
  const w = scene.walk || DEFAULT_WALK;
  const obstacles = scene.obstacles || [];
  const start = { x: GAME.player.x, y: GAME.player.y };
  const target = resolveTarget(start, x, y, obstacles, 3, w);
  const path = findPath(start, target, obstacles, w);
  clearTimeout(playerEl._t);
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
  const ax = c.x < GAME.player.x ? c.x + off : c.x - off;
  closeBubble();
  walkTo(ax, c.y, () => {
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
  npc.innerHTML = node.npc || "";
  dialogueEl.appendChild(npc);

  const opts = document.createElement("div");
  opts.className = "dlg-options";
  (node.options || []).forEach(opt => {
    if (opt.requires && !GAME.flags[opt.requires]) return;
    if (opt.hideIfFlag && GAME.flags[opt.hideIfFlag]) return;
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

function handleAction(action) {
  if (action.type === "challenge") {
    dialogueEl.style.display = "none";
    Challenge.open(action.challengeId, {
      onWin: () => resumeDialogue(action.onWinGoto),
      onLose: () => resumeDialogue(action.onLoseGoto)
    });
  } else if (action.type === "win") {
    closeDialogue();
    showWin();
  }
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

// ─── Win screen ─────────────────────────────────────────────────────────────
function showWin() {
  const spent = GAME.totalSpent;
  const remaining = GAME.tokens;
  const grade = remaining >= 70 ? "Matrícula de honor"
              : remaining >= 40 ? "Aprobado con nota"
              : "Aprobado raspado";
  const overlay = document.createElement("div");
  overlay.id = "win-screen";
  overlay.innerHTML = `
    <div class="win-card">
      <h1>🎓 ¡Examen superado!</h1>
      <p class="win-grade">${grade}</p>
      <p>Tokens gastados: <strong>${spent}</strong> · Restantes: <strong>${remaining}</strong></p>
      <p class="win-flavor">Promptzilla sigue en la ciudad, pero hoy no lo has cebado. La facultad respira.</p>
      <button id="win-restart" class="btn-primary">Volver a empezar</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#win-restart").addEventListener("click", () => {
    overlay.remove();
    GAME.tokens = INITIAL_TOKENS;
    GAME.totalSpent = 0;
    GAME.flags = {};
    refreshHUD();
    changeScene("entrance", "default");
  });
}

// ─── Sprite idle cycling ────────────────────────────────────────────────────
function preloadSprites() {
  Object.values(SPRITES).flat().forEach(src => { const i = new Image(); i.src = src; });
}

function startIdle(imgEl, frames, period, delay) {
  let idx = 0;
  const seq = [0, 1, 2, 1];
  setTimeout(() => {
    const t = setInterval(() => {
      idx = (idx + 1) % seq.length;
      imgEl.src = frames[seq[idx]];
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
