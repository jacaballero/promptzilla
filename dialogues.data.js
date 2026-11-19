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
//   action      {object}                 engine action, e.g. { type:"challenge", slot:"studentGirl" }
//                                        `slot` is looked up in the set's content.json `assign`
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
// Which challenge each slot (dialogue id) asks comes from the active set.
const PRACTICE_SLOTS = ["studentGirl", "studentBoy", "studentGlasses"];
const challengeIdFor = slot => ((window.CONTENT || {}).assign || {})[slot];
const answered = (GAME, slot) => GAME.flags["answeredChallenge" + challengeIdFor(slot)];
const practiceLeft = GAME => PRACTICE_SLOTS.filter(slot => !answered(GAME, slot)).length;
const practiceDone = GAME => practiceLeft(GAME) === 0;
const afterPractice = (more, last) => GAME => practiceDone(GAME) ? last : more;
const withHint = key => [key, "dlg.hint.lastPractice"];
const spent = dialogue => GAME =>
  `dlg.${dialogue}.spent.${GAME.flags["failedChallenge" + challengeIdFor(dialogue)] ? "failed" : "passed"}`;

// Practice classmate: intro, already-done, a side topic (plus an optional follow-up
// reached from it) and win/lose replies.
function practiceDialogue(id, topic, followUp) {
  const challenge = { type: "challenge", slot: id, onWinGoto: "won", onLoseGoto: "lost" };
  const followUpOption = followUp ? [{ id: followUp, goto: followUp }] : [];
  return {
    start: "root",
    nodes: {
      root: { route: GAME => answered(GAME, id) ? "spent" : "intro" },
      intro: { options: [{ id: "challenge", action: challenge }, { id: "topic", goto: topic }, { id: "leave", end: true }] },
      spent: { npc: spent(id), options: [{ id: "topic", goto: topic }, { id: "leave", end: true }] },
      [topic]: { options: [{ id: "challenge", action: challenge }, ...followUpOption, { id: "back", goto: "root" }] },
      ...(followUp ? { [followUp]: { options: [{ id: "challenge", action: challenge }, { id: "back", goto: "root" }] } } : {}),
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

  studentGirl: practiceDialogue("studentGirl", "gossip"),
  studentBoy: practiceDialogue("studentBoy", "meta"),
  studentGlasses: practiceDialogue("studentGlasses", "meta", "footprint"),

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
          { id: "exam", action: { type: "challenge", slot: "teacher", onWinGoto: "passed", onLoseGoto: "failed" } },
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
      root: { options: [{ id: "origin", goto: "origin" }, { id: "footprint", goto: "footprint" }, { id: "threat", goto: "threat" }, { id: "leave", end: true }] },
      origin: { options: [{ id: "back", goto: "root" }] },
      footprint: { options: [{ id: "back", goto: "root" }] },
      threat: { options: [{ id: "accept", end: true }] }
    }
  }
};
