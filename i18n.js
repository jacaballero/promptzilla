// Promptzilla — Internationalisation
// Picks the game language (?lang= > saved choice > browser languages > default)
// and translates texts from i18n/<code>.json (UI, scenes and dialogues). boot.js
// loads those files and calls I18N.init(); challenge texts in content.json use
// inline values { es: "…", en: "…" } resolved with pick().
//
//   I18N.t(key, vars)              text; {name} placeholders. With vars.count, falls back
//                                  to key.zero / key.one / key.other
//   I18N.pick(value)               inline { es, en } value in the current language
//   I18N.setLanguage(code)         save + reload with ?lang=code
//
// Adding a language: create i18n/<code>.json, list it in config `i18n.languages`
// and add the <code> field to the challenges in content.json.

"use strict";

/* global window, document, location, navigator, localStorage, URL */

const I18N = (function () {

  let STRINGS = {};
  let DEFAULT = "es";
  let supported = [];
  let lang = DEFAULT;
  const STORAGE_KEY = "promptzilla.lang";

  function base(code) { return String(code || "").toLowerCase().split(/[-_]/)[0]; }
  function isSupported(code) { return supported.includes(code); }

  function load() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }
  function save(code) {
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* storage disabled (private mode) */ }
  }

  function detect() {
    const fromUrl = base(new URLSearchParams(location.search).get("lang"));
    if (isSupported(fromUrl)) { save(fromUrl); return fromUrl; }
    const saved = base(load());
    if (isSupported(saved)) return saved;
    const browser = (navigator.languages || [navigator.language]).map(base).find(isSupported);
    return browser || DEFAULT;
  }

  function meta(code) { return (STRINGS[code] && STRINGS[code]._meta) || {}; }

  function format(value, vars) {
    return String(value).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m));
  }

  function lookup(code, key) {
    return (STRINGS[code] && STRINGS[code][key]) ?? (STRINGS[DEFAULT] && STRINGS[DEFAULT][key]);
  }

  function tFor(code, key, vars, fallback) {
    let value = lookup(code, key);
    if (value === undefined && vars && typeof vars.count === "number") {
      const forms = vars.count === 0 ? ["zero", "other"] : vars.count === 1 ? ["one", "other"] : ["other"];
      value = forms.map(f => lookup(code, `${key}.${f}`)).find(v => v !== undefined);
    }
    if (value === undefined) return fallback !== undefined ? fallback : key;
    return format(value, vars);
  }

  function isLangMap(v) {
    return v && typeof v === "object" && !Array.isArray(v) && (DEFAULT in v || supported.some(c => c in v));
  }

  function pickFor(code, value) {
    if (!isLangMap(value)) return value;
    return value[code] ?? value[DEFAULT] ?? Object.values(value)[0];
  }

  function setLanguage(code) {
    if (!isSupported(code)) return;
    save(code);
    const url = new URL(location.href);
    url.searchParams.set("lang", code);
    location.href = url.toString();
  }

  // Static markup: data-i18n="key" sets innerHTML (strings are trusted, from i18n/).
  function applyStatic() {
    document.documentElement.lang = lang;
    document.title = tFor(lang, "doc.title");
    document.querySelectorAll("[data-i18n]").forEach(el => {
      el.innerHTML = tFor(lang, el.dataset.i18n);
    });
    const box = document.getElementById("start-lang");
    if (box && supported.length > 1) {
      supported.forEach(code => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "start-lang-btn" + (code === lang ? " active" : "");
        btn.textContent = meta(code).label || code.toUpperCase();
        btn.title = meta(code).nativeName || code;
        btn.addEventListener("click", () => { if (code !== lang) setLanguage(code); });
        box.appendChild(btn);
      });
    }
  }

  function init(strings, defaultLang) {
    STRINGS = strings || {};
    supported = Object.keys(STRINGS);
    DEFAULT = supported.includes(defaultLang) ? defaultLang : supported[0];
    lang = detect();
    applyStatic();
  }

  return {
    init,
    get lang() { return lang; },
    get supported() { return supported; },
    locale: () => meta(lang).locale || lang,
    localeOf: code => meta(code).locale || code,
    languageName: () => meta(lang).name || lang,
    t: (key, vars, fallback) => tFor(lang, key, vars, fallback),
    tFor,
    pick: value => pickFor(lang, value),
    pickFor,
    setLanguage
  };
})();

window.I18N = I18N;
