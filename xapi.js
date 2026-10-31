// Promptzilla — Anonymous xAPI interaction log (for process mining)
// Each game is one xAPI registration (the process-mining case) with a fresh
// random actor, so nothing links a trace to a person or to other games.
// Statements are batched and POSTed best-effort to CONFIG.xapi.endpoint; the
// reverse proxy adds the LRS credentials. No prompt or answer text is sent.
//
// Vocabulary: xAPI Serious Games Profile (e-UCM) + ADL/TinCan verbs, and a few
// Promptzilla terms under VOCAB where nothing standard fits.

"use strict";

/* global window, document, location, crypto, fetch, I18N */

const XAPI = (function () {

  const VOCAB = "https://promptzilla.uca.es/xapi/vocab";
  const SG = "https://w3id.org/xapi/seriousgames";
  const SG_PROFILE = "https://w3id.org/xapi/seriousgames";
  const KEEPALIVE_MAX_BYTES = 60000;   // browsers cap keepalive bodies at 64 KB

  const VERBS = {
    initialized: "http://adlnet.gov/expapi/verbs/initialized",
    completed: "http://adlnet.gov/expapi/verbs/completed",
    abandoned: "https://w3id.org/xapi/adl/verbs/abandoned",
    accessed: SG + "/verbs/accessed",
    interacted: "http://adlnet.gov/expapi/verbs/interacted",
    selected: "https://w3id.org/xapi/adb/verbs/selected",
    exited: "http://adlnet.gov/expapi/verbs/exited",
    answered: "http://adlnet.gov/expapi/verbs/answered",
    asked: "http://adlnet.gov/expapi/verbs/asked",
    failed: "http://adlnet.gov/expapi/verbs/failed",
    downloaded: "http://id.tincanapi.com/verb/downloaded",
    received: VOCAB + "/verbs/received",
    blocked: VOCAB + "/verbs/blocked",
    evaluated: VOCAB + "/verbs/evaluated"
  };

  const VERB_ES = {
    initialized: "inició", completed: "completó", abandoned: "abandonó", accessed: "accedió",
    interacted: "interactuó", selected: "seleccionó", exited: "salió", answered: "respondió",
    asked: "preguntó", failed: "falló", downloaded: "descargó", received: "recibió",
    blocked: "bloqueado", evaluated: "evaluado"
  };

  const TYPES = {
    game: SG + "/activity-types/serious-game",
    area: SG + "/activity-types/area",
    npc: SG + "/activity-types/non-player-character",
    dialog: SG + "/activity-types/dialog-tree",
    menu: SG + "/activity-types/menu",
    question: "http://adlnet.gov/expapi/activities/question",
    hotspot: VOCAB + "/activity-types/hotspot",
    tutor: VOCAB + "/activity-types/ai-tutor",
    evaluation: VOCAB + "/activity-types/prompt-evaluation",
    report: VOCAB + "/activity-types/report",
    profile: "http://adlnet.gov/expapi/activities/profile"
  };

  const EXT = name => VOCAB + "/extensions/" + name;

  const params = new URLSearchParams(location.search);
  const isDebug = params.has("debug");

  let actorId = null;
  let registration = null;
  let seq = 0;
  let inGame = false;
  let currentChallenge = null;
  let challengeOpenedAt = 0;
  let queue = [];
  let flushTimer = null;

  function cfg() { return (window.CONFIG && window.CONFIG.xapi) || {}; }
  function enabled() { return cfg().enabled === true; }
  function base() { return String(cfg().activityBase || "https://promptzilla.uca.es/xapi").replace(/\/+$/, ""); }

  // crypto.randomUUID() only exists in secure contexts; plain-HTTP intranet
  // deployments still have getRandomValues().
  function uuid() {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  function group() {
    const g = params.get(cfg().groupParam || "group");
    return g && /^[\w.-]{1,64}$/.test(g) ? g : null;
  }

  function duration(ms) {
    return `PT${Math.max(0, ms / 1000).toFixed(2)}S`;
  }

  function plain(html) {
    return String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
  }

  // xAPI language map with one entry per game language: { "es-ES": …, "en-US": … }.
  function langMap(fn) {
    const out = {};
    I18N.supported.forEach(code => {
      const v = fn(code);
      if (v) out[I18N.localeOf(code)] = String(v);
    });
    return out;
  }
  const names = value => langMap(code => plain(I18N.pickFor(code, value)));
  const tNames = (key, title) => langMap(code => I18N.tFor(code, key, { title: plain(I18N.pickFor(code, title)) }));

  // ─── Activities ───────────────────────────────────────────────────────
  function activity(path, type, nameMap, extra) {
    const definition = Object.assign({ type }, extra || {});
    if (nameMap && Object.keys(nameMap).length) definition.name = nameMap;
    return { objectType: "Activity", id: base() + path, definition };
  }

  function gameActivity() { return activity("/game", TYPES.game, names("Promptzilla")); }

  function challengeActivity(ch) {
    const correct = Array.isArray(ch.correct) ? ch.correct : [ch.correct];
    return activity(`/challenge/${ch.id}`, TYPES.question, names(ch.title), {
      interactionType: "choice",
      correctResponsesPattern: [correct.map(String).join("[,]")],
      choices: (ch.options || []).map((o, i) => ({
        id: String(i),
        description: langMap(code => `${o.label}) ${plain(I18N.pickFor(code, o.text))}`)
      }))
    });
  }

  // ─── Statement building + sending ─────────────────────────────────────
  function track(verb, object, opts) {
    if (!enabled() || !registration) return;
    const o = opts || {};
    const game = window.GAME || {};
    const extensions = {
      [EXT("seq")]: ++seq,
      [EXT("tokens")]: game.tokens ?? null,
      [EXT("total-spent")]: game.totalSpent ?? null,
      [EXT("scene")]: game.sceneId ?? null
    };
    const g = group();
    if (g) extensions[EXT("group")] = g;
    if (isDebug) extensions[EXT("debug")] = true;

    const contextActivities = {
      grouping: [gameActivity()],
      category: [{ objectType: "Activity", id: SG_PROFILE, definition: { type: TYPES.profile } }]
    };
    const parent = o.parent !== undefined ? o.parent : currentChallenge;
    if (parent) contextActivities.parent = [parent];

    const statement = {
      id: uuid(),
      actor: { objectType: "Agent", account: { homePage: base(), name: actorId } },
      verb: { id: VERBS[verb], display: { "en-US": verb, "es-ES": VERB_ES[verb] || verb } },
      object,
      context: { registration, platform: "Promptzilla", language: I18N.locale(), contextActivities, extensions },
      timestamp: new Date().toISOString()
    };
    if (o.result) statement.result = o.result;
    queue.push(statement);
    if (!flushTimer) flushTimer = setTimeout(() => flush(false), cfg().batchMs ?? 1000);
  }

  // CORS-simple request (text/plain, no custom headers, no-cors) so it also works
  // cross-origin, e.g. index.html opened as file://; Caddy sets the real headers.
  function post(batch, keepalive) {
    fetch(cfg().endpoint || "/xapi/statements", {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(batch),
      keepalive
    }).catch(() => {});
  }

  function flush(keepalive) {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (!queue.length) return;
    const batch = queue;
    queue = [];
    if (!keepalive) { post(batch, false); return; }
    // keepalive requests are size-capped: split into chunks that fit.
    let chunk = [];
    batch.forEach(s => {
      chunk.push(s);
      if (JSON.stringify(chunk).length > KEEPALIVE_MAX_BYTES && chunk.length > 1) {
        chunk.pop();
        post(chunk, true);
        chunk = [s];
      }
    });
    if (chunk.length) post(chunk, true);
  }

  function resultExt(obj) {
    const out = {};
    Object.keys(obj).forEach(k => { if (obj[k] !== undefined) out[EXT(k)] = obj[k]; });
    return out;
  }

  // ─── Game lifecycle ───────────────────────────────────────────────────
  function startGame() {
    if (!enabled()) return;
    if (inGame) flush(false);
    actorId = uuid();
    registration = uuid();
    seq = 0;
    currentChallenge = null;
    inGame = true;
    track("initialized", gameActivity(), { parent: null });
  }

  function endGame({ correct, total, grade, spent, remaining }) {
    if (!inGame) return;
    track("completed", gameActivity(), {
      parent: null,
      result: {
        completion: true,
        success: total > 0 && correct === total,
        score: { raw: correct, min: 0, max: total, scaled: total ? correct / total : 0 },
        extensions: resultExt({ grade, "tokens-spent": spent, "tokens-remaining": remaining })
      }
    });
    inGame = false;
    flush(false);
  }

  // ─── World ────────────────────────────────────────────────────────────
  const sceneActivity = scene => activity(`/scene/${scene.id}`, TYPES.area, names(scene.name));
  const hotspotActivity = (sceneId, h) =>
    activity(`/scene/${sceneId}/hotspot/${h.id}`, TYPES.hotspot, names(h.label || h.id));
  const characterActivity = c => activity(`/character/${c.id}`, TYPES.npc, names(c.name || c.id));

  function sceneAccessed(scene, entryKey) {
    track("accessed", sceneActivity(scene),
      { result: { extensions: resultExt({ entry: entryKey || "default" }) } });
  }

  function hotspotClicked(sceneId, h) {
    track("interacted", hotspotActivity(sceneId, h),
      { result: { extensions: resultExt({ kind: h.kind }) } });
  }

  function characterClicked(c) {
    track("interacted", characterActivity(c));
  }

  // ─── Dialogues ────────────────────────────────────────────────────────
  function dialogueName(dialogueId) {
    const d = window.DIALOGUES && window.DIALOGUES[dialogueId];
    return (d && d.name) || dialogueId;
  }

  function dialogueActivity(dialogueId) {
    return activity(`/dialogue/${dialogueId}`, TYPES.dialog, names(dialogueName(dialogueId)));
  }

  function dialogueOpened(dialogueId) {
    track("accessed", dialogueActivity(dialogueId));
  }

  function dialogueOptionSelected(dialogueId, nodeId, index, text) {
    track("selected", nodeActivity(dialogueId, nodeId), {
      result: { response: String(index), extensions: resultExt({ "option-text": names(text) }) }
    });
  }

  function nodeActivity(dialogueId, nodeId) {
    const node = window.DIALOGUES && window.DIALOGUES[dialogueId] && window.DIALOGUES[dialogueId].nodes[nodeId];
    const nodeLabel = (node && node.label) || (window.DIALOGUE_NODE_LABELS || {})[nodeId] || nodeId;
    const nodeNames = langMap(code =>
      `${plain(I18N.pickFor(code, dialogueName(dialogueId)))} · ${plain(I18N.pickFor(code, nodeLabel))}`);
    return activity(`/dialogue/${dialogueId}/node/${nodeId}`, TYPES.dialog, nodeNames);
  }

  function dialogueClosed(dialogueId) {
    track("exited", dialogueActivity(dialogueId));
  }

  // ─── Challenges ───────────────────────────────────────────────────────
  function challengeOpened(ch) {
    if (!enabled()) return;
    currentChallenge = challengeActivity(ch);
    challengeOpenedAt = Date.now();
    track("accessed", currentChallenge, { parent: null });
  }

  function challengeExited(ch) {
    track("exited", challengeActivity(ch), {
      parent: null,
      result: { completion: false, duration: duration(Date.now() - challengeOpenedAt) }
    });
    currentChallenge = null;
  }

  function challengeAnswered(ch, selected, correct, tokensUsed) {
    track("answered", challengeActivity(ch), {
      parent: null,
      result: {
        success: !!correct,
        completion: true,
        response: [...selected].sort((a, b) => a - b).map(String).join("[,]"),
        duration: duration(Date.now() - challengeOpenedAt),
        extensions: resultExt({ "tokens-used": tokensUsed })
      }
    });
  }

  function challengeClosed() { currentChallenge = null; }

  function tutorActivity(ch) {
    return activity(`/challenge/${ch.id}/tutor`, TYPES.tutor, tNames("xapi.tutor", ch.title));
  }
  const modeActivity = ch => activity(`/challenge/${ch.id}/llm-mode`, TYPES.menu, tNames("xapi.mode", ch.title));
  const evaluationActivity = (id, title) =>
    activity(`/challenge/${id}/prompt-evaluation`, TYPES.evaluation, tNames("xapi.evaluation", title));
  const reportActivity = () => activity("/report", TYPES.report, langMap(code => I18N.tFor(code, "xapi.report")));

  function modeSelected(ch, mode) {
    track("selected", modeActivity(ch), { result: { response: mode } });
  }

  function tutorAsked(ch, mode, words, estimatedCost) {
    track("asked", tutorActivity(ch),
      { result: { extensions: resultExt({ mode, words, "estimated-cost": estimatedCost }) } });
  }

  function tutorReceived(ch, mode, { cost, ms, evalCount, chars }) {
    track("received", tutorActivity(ch), {
      result: {
        success: true,
        duration: duration(ms),
        extensions: resultExt({ mode, cost, "eval-count": evalCount, "response-chars": chars })
      }
    });
  }

  function tutorFailed(ch, mode, reason, ms) {
    track("failed", tutorActivity(ch), {
      result: { success: false, duration: duration(ms), extensions: resultExt({ mode, reason }) }
    });
  }

  function tutorBlocked(ch, mode, words) {
    track("blocked", tutorActivity(ch),
      { result: { success: false, extensions: resultExt({ mode, words, reason: "profanity" }) } });
  }

  // ─── Prompt evaluation + report ───────────────────────────────────────
  function promptEvaluated(attempt) {
    const items = attempt.items || [];
    track("evaluated", evaluationActivity(attempt.challengeId, attempt.titleText), {
      parent: null,
      result: {
        extensions: resultExt({
          "challenge-id": attempt.challengeId,
          "distinct-prompts": items.length,
          uses: items.reduce((n, it) => n + (it.uses ? it.uses.length : 0), 0),
          copied: items.filter(it => it.copied).length,
          done: items.filter(it => it.status === "done").length,
          failed: items.filter(it => it.status === "failed").length
        })
      }
    });
  }

  function reportDownloaded() {
    track("downloaded", reportActivity(), { parent: null });
    flush(false);
  }

  // Every activity the game can log with its names in all languages, so the
  // exporter can relabel statements logged by older versions of the game.
  function catalog() {
    const list = [gameActivity(), reportActivity()];
    Object.values(window.SCENES || {}).forEach(scene => {
      list.push(sceneActivity(scene));
      (scene.hotspots || []).forEach(h => list.push(hotspotActivity(scene.id, h)));
      (scene.characters || []).forEach(c => list.push(characterActivity(c)));
    });
    Object.entries(window.DIALOGUES || {}).forEach(([id, d]) => {
      list.push(dialogueActivity(id));
      Object.keys(d.nodes || {}).forEach(nodeId => list.push(nodeActivity(id, nodeId)));
    });
    (window.CHALLENGES || (window.CONTENT && window.CONTENT.challenges) || []).forEach(ch => {
      list.push(challengeActivity(ch), tutorActivity(ch), modeActivity(ch), evaluationActivity(ch.id, ch.title));
    });
    return list;
  }

  // ─── Page lifecycle ───────────────────────────────────────────────────
  window.addEventListener("pagehide", () => {
    if (!enabled()) return;
    if (inGame) {
      track("abandoned", gameActivity(), { parent: null });
      inGame = false;
    }
    flush(true);
  });

  document.addEventListener("DOMContentLoaded", () => {
    const rule = document.getElementById("start-xapi-rule");
    if (rule && !enabled()) rule.style.display = "none";
  });

  return {
    enabled, startGame, endGame,
    sceneAccessed, hotspotClicked, characterClicked,
    dialogueOpened, dialogueOptionSelected, dialogueClosed,
    challengeOpened, challengeExited, challengeAnswered, challengeClosed,
    modeSelected, tutorAsked, tutorReceived, tutorFailed, tutorBlocked,
    promptEvaluated, reportDownloaded, catalog
  };
})();

window.XAPI = XAPI;
