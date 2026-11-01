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

  window.GAME_READY = Promise.all([
    getJSON("content.json"),
    getJSON("scenes.json"),
    getJSON("profanity.json"),
    ...languages.map(code => getJSON(`i18n/${code}.json`))
  ]).then(([content, scenes, profanity, ...texts]) => {
    window.CONTENT = content;
    window.CHALLENGES = content.challenges || [];
    window.SCENES = scenes;
    window.PROFANITY = profanity;
    I18N.init(Object.fromEntries(languages.map((code, i) => [code, texts[i]])), i18nCfg.default);
  });
})();
