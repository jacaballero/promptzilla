#!/usr/bin/env node
// Prints the names (all languages) of every activity the current game can log,
// keyed by activity path ("/scene/entrance"), reusing the game's own xapi.js.
// Used by xapi_to_pm.py to relabel statements logged by older game versions.
"use strict";

const fs = require("fs");
const path = require("path");

const GAME_DIR = process.env.GAME_DIR || "/game";
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

const readJSON = file => JSON.parse(fs.readFileSync(path.join(GAME_DIR, file), "utf8"));
["dialogues.data.js", "i18n.js", "xapi.js"].forEach(file => {
  const code = fs.readFileSync(path.join(GAME_DIR, file), "utf8").replace(/^const (I18N|XAPI) =/m, "global.$1 =");
  (0, eval)(code);
});

global.SCENES = readJSON("scenes.json");
global.CHALLENGES = readJSON("content.json").challenges;
const strings = {};
fs.readdirSync(path.join(GAME_DIR, "i18n")).filter(f => f.endsWith(".json"))
  .forEach(f => { strings[f.replace(/\.json$/, "")] = readJSON(`i18n/${f}`); });
global.I18N.init(strings, "es");

const names = {};
global.XAPI.catalog().forEach(a => {
  if (a.definition && a.definition.name) names[a.id.slice(BASE.length)] = a.definition.name;
});
// Option ids per dialogue node, to translate responses logged as an index by older versions.
const options = {};
Object.entries(global.DIALOGUES).forEach(([d, dlg]) => Object.entries(dlg.nodes).forEach(([n, node]) => {
  if (node.options) options[`/dialogue/${d}/node/${n}`] = node.options.map((o, i) => o.id ?? String(i));
}));
process.stdout.write(JSON.stringify({ names, options }));
