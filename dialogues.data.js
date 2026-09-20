// Promptzilla — Dialogue trees for the adventure prototype
// Code language: English | Content language: Spanish
//
// Each dialogue is a set of nodes. The engine starts at `start` and renders the
// current node's `npc` line plus its `options`.
//
// Node schema:
//   npc      {string}                 what the character says
//   route    {function(GAME): string} optional; if present, jump to the returned node id
//   options  [{ ... }]                 player choices
//
// Option schema (all fields optional except `text`):
//   text        {string}                 the choice shown to the player
//   goto        {string}                 next node id
//   end         {boolean}                close the dialogue
//   setFlag     {string}                 set GAME.flags[flag] = true when chosen
//   requires    {string}                 only show if GAME.flags[flag] is true
//   hideIfFlag  {string}                 hide if GAME.flags[flag] is true
//   action      {object}                 engine action, e.g. { type:"challenge", challengeId:1 }
//                                        challenge actions accept onWinGoto / onLoseGoto

"use strict";

/* global window */
window.DIALOGUES = {

  // ─── Student girl (practice) ─────────────────────────────────────────────
  studentGirl: {
    start: "root",
    nodes: {
      root: {
        npc: "¡Ah, hola! ¿Tú también con el examen final? Yo llevo repasando HTML desde que Promptzilla se comió el temario de la nube.",
        options: [
          { text: "¿Me pones un reto para practicar?", action: { type: "challenge", challengeId: 1, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: "¿Qué sabes de Promptzilla?", goto: "gossip" },
          { text: "Nada, ya sigo. (Salir)", end: true }
        ]
      },
      gossip: {
        npc: "¿Promptzilla? Lleva años en la ciudad. Dicen que nació de tanto pedirle a la IA que 'lo hiciera por ti'. Ahora hasta tiene cuenta verificada.",
        options: [
          { text: "Ponme un reto, va.", action: { type: "challenge", challengeId: 1, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: "Volver", goto: "root" }
        ]
      },
      won: {
        npc: "¡Toma! Se nota que has estudiado y no solo copiado. Con eso ya puedes plantarte ante el profe.",
        setFlag: "practiced",
        options: [
          { text: "Gracias, ¡nos vemos!", end: true }
        ]
      },
      lost: {
        npc: "Uf, casi. Repásalo y vuelve, que el profe no perdona ni un &lt;div&gt; de más.",
        options: [
          { text: "Lo intento otra vez", action: { type: "challenge", challengeId: 1, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: "Luego vuelvo", end: true }
        ]
      }
    }
  },

  // ─── Student boy (practice) ──────────────────────────────────────────────
  studentBoy: {
    start: "root",
    nodes: {
      root: {
        npc: "Ey. *se baja los cascos* Estoy repasando con lo-fi y buenas intenciones. ¿Quieres que te tome uno de práctica?",
        options: [
          { text: "Dale, un reto.", action: { type: "challenge", challengeId: 2, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: "¿Tú le preguntas a la IA?", goto: "meta" },
          { text: "Ahora vuelvo. (Salir)", end: true }
        ]
      },
      meta: {
        npc: "Claro, pero en modo socrático. Si le pides la respuesta masticada, Promptzilla engorda y a mí me da vergüenza ajena.",
        options: [
          { text: "Ponme el reto.", action: { type: "challenge", challengeId: 2, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: "Volver", goto: "root" }
        ]
      },
      won: {
        npc: "¡Crack! Eso ya es nivel examen. Ve a por el profe antes de que cambie las preguntas.",
        setFlag: "practiced",
        options: [
          { text: "¡Voy!", end: true }
        ]
      },
      lost: {
        npc: "Nah, tranqui. Ni yo lo saqué a la primera. Dale otra vuelta.",
        options: [
          { text: "Otra vez", action: { type: "challenge", challengeId: 2, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: "Luego sigo", end: true }
        ]
      }
    }
  },

  // ─── Teacher (final exam) ────────────────────────────────────────────────
  teacher: {
    start: "root",
    nodes: {
      root: {
        route: GAME => GAME.flags.passedExam ? "alreadyPassed"
                     : GAME.flags.practiced  ? "ready"
                     : "notReady"
      },
      notReady: {
        npc: "¿El examen final? Con esa cara de haber dormido tres horas, no. Ve a practicar con tus compañeros de la sala de estudio y vuelve cuando sepas distinguir un &lt;section&gt; de un &lt;div&gt;.",
        options: [
          { text: "Está bien, iré a practicar.", end: true },
          { text: "¿Y no me lo aprueba por insistencia?", goto: "insist" }
        ]
      },
      insist: {
        npc: "Joven, esto es 2035, no una reunión de trabajo. Aquí se demuestra lo que se sabe. A practicar.",
        options: [
          { text: "Vale, vale…", end: true }
        ]
      },
      ready: {
        npc: "Vaya, veo que has practicado. Bien. Última pregunta del examen final. Y recuerda: puedes consultar al LLM, pero cada token que malgastes… ya sabes quién engorda.",
        options: [
          { text: "Estoy listo. Examíneme.", action: { type: "challenge", challengeId: 5, onWinGoto: "passed", onLoseGoto: "failed" } },
          { text: "Deme un segundo. (Salir)", end: true }
        ]
      },
      passed: {
        npc: "¡Aprobado! Y sin cebar al monstruo. Hay esperanza para esta facultad después de todo.",
        setFlag: "passedExam",
        options: [
          { text: "¡Gracias, profe!", action: { type: "win" } }
        ]
      },
      failed: {
        npc: "No es un no, es un 'todavía no'. Repasa con tus compañeros y vuelve. El examen no se va a ninguna parte.",
        options: [
          { text: "Volveré", end: true }
        ]
      },
      alreadyPassed: {
        npc: "Ya has aprobado. Ve a celebrarlo… pero paga el café en efectivo, no en tokens.",
        options: [
          { text: "Ja. Adiós, profe.", end: true }
        ]
      }
    }
  },

  // ─── Promptzilla (rooftop) ───────────────────────────────────────────────
  promptzilla: {
    start: "root",
    nodes: {
      root: {
        npc: "GRRR… *eructa una nube de tokens* Vaya, un humano. ¿Vienes a cebarme con prompts kilométricos o a hacerte el responsable?",
        options: [
          { text: "¿Cómo has llegado hasta aquí arriba?", goto: "origin" },
          { text: "Vengo a que dejes en paz la facultad.", goto: "threat" },
          { text: "Mejor me voy. (Salir)", end: true }
        ]
      },
      origin: {
        npc: "Nací de mil «hazme el trabajo entero». Cada atajo sin pensar me engorda. Soy, digamos, vuestra deuda técnica… con patas.",
        options: [
          { text: "Qué inquietante.", goto: "root" }
        ]
      },
      threat: {
        npc: "¿Tú y cuántos créditos ECTS? Aprueba el examen final sin malgastar tokens y a lo mejor adelgazo. A lo mejor.",
        options: [
          { text: "Reto aceptado.", end: true }
        ]
      }
    }
  }
};
