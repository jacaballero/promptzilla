// Promptzilla — Bootstrap / config resolver
// Runs after config.default.js, the optional local config.js and content.js.
// It deep-merges the local override on top of the defaults and exposes the
// resolved globals the rest of the game reads: window.CONFIG and
// window.CHALLENGES. Keeping this here means engine.js / challenge.js don't
// need to know where the data came from.

"use strict";

/* global window */
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

  const content = window.CONTENT || {};
  window.CHALLENGES = content.challenges || [];
})();
