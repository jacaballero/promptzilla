// Promptzilla — Dialogue trees (logic only; texts live in i18n/<lang>.json)
//
// Each dialogue is a set of nodes. The engine starts at `start` and renders the
// current node's `npc` line plus its `options`.
//
// Text keys (i18n/<lang>.json):
//   dlg.<dialogue>.name              name of the dialogue in the xAPI log
//   dlg.<dialogue>.<node>            what the character says in <node>
//   dlg.<dialogue>.<node>.<option>   the option with that id in <node>
//   dlg.node.<node>                  name of the node in the xAPI log
//
// Node schema:
//   npc      optional; overrides the default text key. A key, a list of keys
//            (joined), { key, vars }, or function(GAME) returning any of these
//   route    {function(GAME): string} optional; jump to the returned node id
//   options  [{ ... }]                 player choices
//   label    optional; text key naming the node in the xAPI log
//
// Option schema (all fields optional except `id`):
//   id          {string}                 names the option: text key and xAPI response
//   text        text key overriding dlg.<dialogue>.<node>.<id>
//   goto        {string}                 next node id
//   end         {boolean}                close the dialogue
//   setFlag     {string}                 set GAME.flags[flag] = true when chosen
//   requires    {string}                 only show if GAME.flags[flag] is true
//   hideIfFlag  {string}                 hide if GAME.flags[flag] is true
//   action      {object}                 engine action, e.g. { type:"challenge", challengeId:1 }
//                                        challenge actions accept onWinGoto / onLoseGoto
//                                        other actions: { type:"win" } / { type:"lose" } (end screens)
//
// Each challenge can be answered only once. Any answer (right or wrong) sets
// GAME.flags["answeredChallenge" + id] and the engine hides every option that
// would reopen it; a wrong answer also sets GAME.flags["failedChallenge" + id].
// Leaving the challenge with "✕ Exit" does not count as answering.

"use strict";

/* global window */

// The exam unlocks once the three practice challenges have been answered
// (right or wrong). Only the classmate whose challenge completes the set
// points the player to the teacher. Debug mode (?debug) skips the check.
const PRACTICE_IDS = [1, 2, 3];
const practiceLeft = GAME => PRACTICE_IDS.filter(id => !GAME.flags["answeredChallenge" + id]).length;
const practiceDone = GAME => practiceLeft(GAME) === 0;
const afterPractice = (more, last) => GAME => practiceDone(GAME) ? last : more;
const withHint = key => [key, "dlg.hint.lastPractice"];
const spent = (dialogue, challengeId) => GAME =>
  `dlg.${dialogue}.spent.${GAME.flags["failedChallenge" + challengeId] ? "failed" : "passed"}`;

// Practice classmate: intro, already-done, a side topic and win/lose replies.
function practiceDialogue(id, challengeId, topic) {
  const challenge = { type: "challenge", challengeId, onWinGoto: "won", onLoseGoto: "lost" };
  return {
    start: "root",
    nodes: {
      root: { route: GAME => GAME.flags["answeredChallenge" + challengeId] ? "spent" : "intro" },
      intro: { options: [{ id: "challenge", action: challenge }, { id: "topic", goto: topic }, { id: "leave", end: true }] },
      spent: { npc: spent(id, challengeId), options: [{ id: "topic", goto: topic }, { id: "leave", end: true }] },
      [topic]: { options: [{ id: "challenge", action: challenge }, { id: "back", goto: "root" }] },
      won: { route: afterPractice("wonMore", "wonLast") },
      wonMore: { options: [{ id: "leave", end: true }] },
      wonLast: { npc: withHint(`dlg.${id}.wonLast`), options: [{ id: "leave", end: true }] },
      lost: { route: afterPractice("lostMore", "lostLast") },
      lostMore: { options: [{ id: "leave", end: true }] },
      lostLast: { npc: withHint(`dlg.${id}.lostLast`), options: [{ id: "leave", end: true }] }
    }
  };
}

window.DIALOGUES = {

  studentGirl: practiceDialogue("studentGirl", 1, "gossip"),
  studentBoy: practiceDialogue("studentBoy", 2, "meta"),
  studentGlasses: practiceDialogue("studentGlasses", 3, "meta"),

  // ─── Teacher (final exam) ────────────────────────────────────────────────
  teacher: {
    start: "root",
    nodes: {
      root: {
        route: GAME => GAME.flags.passedExam ? "alreadyPassed"
                     : (practiceDone(GAME) || window.DEBUG) ? "ready"
                     : "notReady"
      },
      notReady: {
        npc: GAME => ({ key: "dlg.teacher.notReady", vars: { count: practiceLeft(GAME) } }),
        options: [{ id: "leave", end: true }, { id: "insist", goto: "insist" }]
      },
      insist: { options: [{ id: "leave", end: true }] },
      ready: {
        options: [
          { id: "exam", action: { type: "challenge", challengeId: 5, onWinGoto: "passed", onLoseGoto: "failed" } },
          { id: "leave", end: true }
        ]
      },
      passed: { setFlag: "passedExam", options: [{ id: "thanks", action: { type: "win" } }] },
      failed: { options: [{ id: "result", action: { type: "lose" } }] },
      alreadyPassed: { options: [{ id: "leave", end: true }] }
    }
  },

  // ─── Promptzilla (rooftop) ───────────────────────────────────────────────
  promptzilla: {
    start: "root",
    nodes: {
      root: { options: [{ id: "origin", goto: "origin" }, { id: "threat", goto: "threat" }, { id: "leave", end: true }] },
      origin: { options: [{ id: "back", goto: "root" }] },
      threat: { options: [{ id: "accept", end: true }] }
    }
  }
};
