#!/usr/bin/env node
// Prints the names (all languages) of every activity the current game can log,
// keyed by activity path ("/scene/entrance"), reusing the game's own xapi.js.
// Used by xapi_to_pm.py to relabel statements logged by older game versions.
"use strict";

const fs = require("fs");
const path = require("path");

const GAME_DIR = process.env.GAME_DIR || "/game";
const FILES = ["i18n/es.js", "i18n/en.js", "content.js", "scenes.data.js", "dialogues.data.js", "i18n.js", "xapi.js"];
const BASE = "https://promptzilla.local/xapi";

global.window = global;
global.CONFIG = { xapi: { activityBase: BASE } };
global.addEventListener = () => {};
global.document = { readyState: "complete", documentElement: {}, addEventListener: () => {}, getElementById: () => null, querySelectorAll: () => [] };
global.location = { search: "", href: "http://localhost/" };
// Recent Node versions expose read-only navigator/localStorage globals.
const stub = (name, value) => Object.defineProperty(global, name, { value, configurable: true, writable: true });
stub("navigator", { languages: [] });
stub("localStorage", { getItem: () => null, setItem: () => {} });

const i18nDir = path.join(GAME_DIR, "i18n");
const languages = fs.existsSync(i18nDir) ? fs.readdirSync(i18nDir).filter(f => f.endsWith(".js")).map(f => `i18n/${f}`) : [];
[...new Set([...languages, ...FILES])].forEach(file => {
  const code = fs.readFileSync(path.join(GAME_DIR, file), "utf8").replace(/^const (I18N|XAPI) =/m, "global.$1 =");
  (0, eval)(code);
});

const out = {};
global.XAPI.catalog().forEach(a => {
  if (a.definition && a.definition.name) out[a.id.slice(BASE.length)] = a.definition.name;
});
process.stdout.write(JSON.stringify(out));
