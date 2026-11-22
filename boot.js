// Promptzilla — Bootstrap / config resolver
// Runs after config.default.js and the optional local config.js. It deep-merges
// the local override on top of the defaults into window.CONFIG, then loads the
// JSON data (content, scenes, profanity list, i18n texts). window.GAME_READY
// resolves once everything is in place; engine.js starts the game after it.

"use strict";

/* global window, fetch, I18N */
(function () {
  function isObject(v) {
    return v && typeof v === "object" && !Array.isArray(v);
  }

  // Deep-merge source onto a clone of base (arrays and scalars are replaced).
  function deepMerge(base, override) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!isObject(override)) return out;
    Object.keys(override).forEach(key => {
      if (isObject(out[key]) && isObject(override[key])) {
        out[key] = deepMerge(out[key], override[key]);
      } else {
        out[key] = override[key];
      }
    });
    return out;
  }

  const defaults = window.APP_CONFIG_DEFAULT || {};
  const local = window.APP_CONFIG || {};        // from optional config.js (may be absent)
  window.CONFIG = deepMerge(defaults, local);

  function getJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(resp => {
      if (!resp.ok) throw new Error(`${url}: HTTP ${resp.status}`);
      return resp.json();
    });
  }

  const i18nCfg = window.CONFIG.i18n || {};
  const languages = i18nCfg.languages || ["es"];

  const params = new URLSearchParams(window.location.search);

  // ?group=<name> tags the xAPI log and picks the group's settings in `groups`.
  const g = params.get("group");
  window.GAME_GROUP = g && /^[\w.-]{1,64}$/.test(g) ? g : null;
  const groups = window.CONFIG.groups || {};
  window.GROUP_CONFIG = window.GAME_GROUP && Object.prototype.hasOwnProperty.call(groups, window.GAME_GROUP)
    ? groups[window.GAME_GROUP] || {} : {};

  // Set: ?set= (if listed in `sets`) > the group's `set` > the default `set`.
  const contentCfg = window.CONFIG.content || {};
  const allowedSets = contentCfg.sets || [];
  const validName = s => typeof s === "string" && /^[a-z0-9_-]+$/.test(s);
  const requested = params.get("set");
  let set = contentCfg.set || "html";
  if (validName(window.GROUP_CONFIG.set)) set = window.GROUP_CONFIG.set;
  else if (window.GROUP_CONFIG.set !== undefined) console.warn(`Invalid set for group "${window.GAME_GROUP}"; using "${set}".`);
  if (requested !== null) {
    if (validName(requested) && allowedSets.includes(requested)) set = requested;
    else console.warn(`Challenge set "${requested}" not allowed; using "${set}".`);
  }
  window.CHALLENGE_SET = set;

  // A set may replace the tutor/report prompts via `prompts` in its content.json.
  // Only these keys are taken, so a set can never change endpoints, models or costs.
  const SET_PROMPT_KEYS = {
    llm: ["system", "modeInstructions", "brevitySuffix"],
    evaluation: ["systemPerChallenge", "systemSummary"]
  };
  function applySetPrompts(prompts) {
    if (!isObject(prompts)) return;
    Object.keys(SET_PROMPT_KEYS).forEach(section => {
      const src = prompts[section];
      if (!isObject(src)) return;
      const picked = {};
      SET_PROMPT_KEYS[section].forEach(key => { if (key in src) picked[key] = src[key]; });
      window.CONFIG[section] = deepMerge(window.CONFIG[section] || {}, picked);
    });
  }

  window.GAME_READY = Promise.all([
    getJSON(`challenges/${set}/content.json`),
    getJSON("scenes.json"),
    getJSON("profanity.json"),
    ...languages.map(code => getJSON(`i18n/${code}.json`))
  ]).then(([content, scenes, profanity, ...texts]) => {
    window.CONTENT = content;
    window.CHALLENGES = content.challenges || [];
    applySetPrompts(content.prompts);
    window.SCENES = scenes;
    window.PROFANITY = profanity;
    I18N.init(Object.fromEntries(languages.map((code, i) => [code, texts[i]])), i18nCfg.default);
  });
})();
