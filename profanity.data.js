// Promptzilla — Profanity word list (teacher-editable)
// Words the language filter blocks in the free-text prompt (Spanish + English).
// Plain data wrapped in a single assignment, so it works over file:// and HTTP.
//
//   words  {string[]}  terms to block. Matching is case/accent-insensitive and
//                      tolerant of repeated letters ("putaaa") and separators
//                      ("p u t a", "p.u.t.a"). Add the natural spelling.
//   allow  {string[]}  exceptions: if a matched token equals one of these it is
//                      let through (use to fix false positives per subject).

"use strict";

/* global window */
window.PROFANITY = {
  words: [
    // ── Español ──────────────────────────────────────────────────────────
    "puta", "putas", "puto", "putos", "putada", "hijoputa", "hijodeputa",
    "hijueputa", "malparido", "mierda", "mierdas", "joder", "jodido", "jodida",
    "gilipollas", "gilipolla", "gilipuertas", "cabron", "cabrona", "cabrones",
    "coño", "polla", "pollas", "capullo", "capullos", "follar", "follando",
    "zorra", "zorras", "maricon", "maricones", "marica", "subnormal",
    "subnormales", "imbecil", "pendejo", "pendeja", "verga", "vergas",
    "chingar", "chinga", "culero", "mamon", "mamona", "cojones", "gonorrea",
    "mongolo", "mongolico", "retrasado", "retrasada", "soplapollas",

    // ── English ──────────────────────────────────────────────────────────
    "fuck", "fucking", "fucker", "motherfucker", "shit", "shitty", "bullshit",
    "bitch", "bitches", "asshole", "assholes", "bastard", "dick", "dickhead",
    "pussy", "cunt", "whore", "slut", "fag", "faggot", "nigger", "nigga",
    "cock", "wanker", "twat", "prick", "retard", "retarded"
  ],
  allow: []
};
