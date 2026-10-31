// Promptzilla — Internationalisation
// Picks the game language (?lang= > saved choice > browser languages > default),
// translates UI strings from window.I18N_STRINGS (one file per language under
// i18n/) and resolves bilingual content values written as { es: "…", en: "…" }.
//
//   I18N.lang                      current language code ("es", "en"…)
//   I18N.t(key, vars)              UI string; {name} placeholders or function entries
//   I18N.pick(value, ...args)      content value in the current language
//   I18N.map(value)                { "es-ES": …, "en-US": … } for xAPI language maps
//   I18N.setLanguage(code)         save + reload with ?lang=code
//
// Adding a language: create i18n/<code>.js, load it in index.html and add the
// <code> field to the bilingual content (content.js, dialogues, scenes).

"use strict";

/* global window, document, location, navigator, localStorage, URL */

const I18N = (function () {

  const STRINGS = window.I18N_STRINGS || {};
  const DEFAULT = "es";
  const STORAGE_KEY = "promptzilla.lang";
  const supported = Object.keys(STRINGS);

  function base(code) { return String(code || "").toLowerCase().split(/[-_]/)[0]; }
  function isSupported(code) { return supported.includes(code); }

  function load() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }
  function save(code) {
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* private mode / file:// */ }
  }

  function detect() {
    const fromUrl = base(new URLSearchParams(location.search).get("lang"));
    if (isSupported(fromUrl)) { save(fromUrl); return fromUrl; }
    const saved = base(load());
    if (isSupported(saved)) return saved;
    const browser = (navigator.languages || [navigator.language]).map(base).find(isSupported);
    return browser || DEFAULT;
  }

  const lang = detect();

  function meta(code) { return (STRINGS[code] && STRINGS[code]._meta) || {}; }

  function format(value, vars) {
    if (typeof value === "function") return value(vars || {});
    return String(value).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m));
  }

  function tFor(code, key, vars) {
    const value = (STRINGS[code] && STRINGS[code][key]) ?? (STRINGS[DEFAULT] && STRINGS[DEFAULT][key]);
    return value === undefined ? key : format(value, vars);
  }

  function isLangMap(v) {
    return v && typeof v === "object" && !Array.isArray(v) && (DEFAULT in v || supported.some(c => c in v));
  }

  function pickFor(code, value, ...args) {
    if (typeof value === "function") return pickFor(code, value(...args));
    if (!isLangMap(value)) return value;
    return value[code] ?? value[DEFAULT] ?? Object.values(value)[0];
  }

  function map(value) {
    const out = {};
    supported.forEach(code => {
      const v = pickFor(code, value);
      if (v !== undefined && v !== null && v !== "") out[meta(code).locale || code] = String(v);
    });
    return out;
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyStatic);
  else applyStatic();

  return {
    lang,
    supported,
    locale: () => meta(lang).locale || lang,
    localeOf: code => meta(code).locale || code,
    languageName: () => meta(lang).name || lang,
    t: (key, vars) => tFor(lang, key, vars),
    tFor,
    pick: (value, ...args) => pickFor(lang, value, ...args),
    pickFor,
    map,
    setLanguage
  };
})();

window.I18N = I18N;
