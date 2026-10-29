// Promptzilla — Dialogue trees for the adventure prototype
// Code language: English | Content language: Spanish
//
// Each dialogue is a set of nodes. The engine starts at `start` and renders the
// current node's `npc` line plus its `options`.
//
// Node schema:
//   npc      {string|function(GAME): string}  what the character says (a function
//                                              lets the line depend on game state)
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
//                                        other actions: { type:"win" } / { type:"lose" } (end screens)
//
// Each challenge can be answered only once. Any answer (right or wrong) sets
// GAME.flags["answeredChallenge" + id] and the engine hides every option that
// would reopen it; a wrong answer also sets GAME.flags["failedChallenge" + id].
// Leaving the challenge with "✕ Salir" does not count as answering.

"use strict";

/* global window */

// The exam unlocks once the three practice challenges have been answered
// (right or wrong). Only the classmate whose challenge completes the set
// points the player to the teacher. Debug mode (?debug) skips the check.
const PRACTICE_IDS = [1, 2, 3];
const practiceLeft = GAME => PRACTICE_IDS.filter(id => !GAME.flags["answeredChallenge" + id]).length;
const practiceDone = GAME => practiceLeft(GAME) === 0;
const LAST_PRACTICE_HINT = " Por cierto, con este ya has hecho los tres retos de práctica: el profe te espera en el aula 0.01 para el examen final.";
const afterPractice = (more, last) => GAME => practiceDone(GAME) ? last : more;

window.DIALOGUES = {

  // ─── Student girl (practice) ─────────────────────────────────────────────
  studentGirl: {
    start: "root",
    nodes: {
      root: {
        route: GAME => GAME.flags.answeredChallenge1 ? "spent" : "intro"
      },
      intro: {
        npc: "¡Ah, hola! ¿Tú también con el examen final? Yo llevo repasando HTML desde que Promptzilla se comió el temario de la nube.",
        options: [
          { text: "¿Me pones un reto para practicar?", action: { type: "challenge", challengeId: 1, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: "¿Qué sabes de Promptzilla?", goto: "gossip" },
          { text: "Nada, ya sigo. (Salir)", end: true }
        ]
      },
      spent: {
        npc: GAME => GAME.flags.failedChallenge1
          ? "Mi reto ya lo has visto, con solución incluida. Ahora toca que se te quede."
          : "Mi reto ya lo clavaste. No te voy a poner el mismo dos veces, que te aburres.",
        options: [
          { text: "¿Qué sabes de Promptzilla?", goto: "gossip" },
          { text: "Gracias. (Salir)", end: true }
        ]
      },
      gossip: {
        npc: "¿Promptzilla? Lleva años en la ciudad. Dicen que nació de tanto pedirle a la IA que 'lo hiciera por ti'. Ahora hasta tiene cuenta verificada.",
        options: [
          { text: "Ponme un reto, va.", action: { type: "challenge", challengeId: 1, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: "Volver", goto: "root" }
        ]
      },
      won: { route: afterPractice("wonMore", "wonLast") },
      wonMore: {
        npc: "¡Toma! Se nota que has estudiado y no solo copiado.",
        options: [
          { text: "Gracias, ¡nos vemos!", end: true }
        ]
      },
      wonLast: {
        npc: "¡Toma! Se nota que has estudiado y no solo copiado." + LAST_PRACTICE_HINT,
        options: [
          { text: "¡Voy para allá!", end: true }
        ]
      },
      lost: { route: afterPractice("lostMore", "lostLast") },
      lostMore: {
        npc: "Uf, casi. Ahora ya sabes cuál era: apúntatelo bien, que no se perdona ni un &lt;div&gt; de más.",
        options: [
          { text: "Me lo apunto. (Salir)", end: true }
        ]
      },
      lostLast: {
        npc: "Uf, casi. Ahora ya sabes cuál era: apúntatelo bien." + LAST_PRACTICE_HINT,
        options: [
          { text: "Me lo apunto. (Salir)", end: true }
        ]
      }
    }
  },

  // ─── Student boy (practice) ──────────────────────────────────────────────
  studentBoy: {
    start: "root",
    nodes: {
      root: {
        route: GAME => GAME.flags.answeredChallenge2 ? "spent" : "intro"
      },
      intro: {
        npc: "Ey. *se baja los cascos* Estoy repasando con lo-fi y buenas intenciones. ¿Quieres que te tome uno de práctica?",
        options: [
          { text: "Dale, un reto.", action: { type: "challenge", challengeId: 2, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: "¿Tú le preguntas a la IA?", goto: "meta" },
          { text: "Ahora vuelvo. (Salir)", end: true }
        ]
      },
      spent: {
        npc: GAME => GAME.flags.failedChallenge2
          ? "*se vuelve a poner un casco* Mi pregunta ya la quemaste, bro. Pero ya sabes la respuesta, que es lo que cuenta."
          : "*se vuelve a poner un casco* Mi pregunta ya la sacaste, bro. Nada más que rascar por aquí.",
        options: [
          { text: "¿Tú le preguntas a la IA?", goto: "meta" },
          { text: "Hasta luego. (Salir)", end: true }
        ]
      },
      meta: {
        npc: "Claro, pero en modo socrático. Si le pides la respuesta masticada, Promptzilla engorda y a mí me da vergüenza ajena.",
        options: [
          { text: "Ponme el reto.", action: { type: "challenge", challengeId: 2, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: "Volver", goto: "root" }
        ]
      },
      won: { route: afterPractice("wonMore", "wonLast") },
      wonMore: {
        npc: "¡Crack! Eso ya es nivel examen.",
        options: [
          { text: "¡Gracias!", end: true }
        ]
      },
      wonLast: {
        npc: "¡Crack! Eso ya es nivel examen." + LAST_PRACTICE_HINT,
        options: [
          { text: "¡Voy!", end: true }
        ]
      },
      lost: { route: afterPractice("lostMore", "lostLast") },
      lostMore: {
        npc: "Nah, tranqui. Ni yo lo saqué a la primera. Quédate con la respuesta, que aquí no hay segunda vuelta.",
        options: [
          { text: "Anotado. (Salir)", end: true }
        ]
      },
      lostLast: {
        npc: "Nah, tranqui. Ni yo lo saqué a la primera. Quédate con la respuesta." + LAST_PRACTICE_HINT,
        options: [
          { text: "Anotado. (Salir)", end: true }
        ]
      }
    }
  },

  // ─── Student with glasses (practice, classroom 0.02) ─────────────────────
  studentGlasses: {
    start: "root",
    nodes: {
      root: {
        route: GAME => GAME.flags.answeredChallenge3 ? "spent" : "intro"
      },
      intro: {
        npc: "(Levanta la vista de la tablet) Buenas. Estoy ordenando mis apuntes por etiquetas semánticas, como debe ser. ¿Te lanzo un reto de práctica?",
        options: [
          { text: "Venga, un reto.", action: { type: "challenge", challengeId: 3, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: "¿Apuntes en tablet? ¿No tiras de IA?", goto: "meta" },
          { text: "Ahora vuelvo. (Salir)", end: true }
        ]
      },
      spent: {
        npc: GAME => GAME.flags.failedChallenge3
          ? "(Sin levantar la vista) Mi reto ya lo hiciste y viste la solución. Repetirlo sería hacer trampa, y aquí no hacemos eso."
          : "(Sin levantar la vista) Mi reto ya lo resolviste, y bien. Repetirlo no te enseñaría nada nuevo.",
        options: [
          { text: "¿Apuntes en tablet? ¿No tiras de IA?", goto: "meta" },
          { text: "Entendido. (Salir)", end: true }
        ]
      },
      meta: {
        npc: "La IA la uso para entender, no para que piense por mí. Prompt concreto, respuesta útil, y Promptzilla se queda a dieta.",
        options: [
          { text: "Ponme el reto.", action: { type: "challenge", challengeId: 3, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: "Volver", goto: "root" }
        ]
      },
      won: { route: afterPractice("wonMore", "wonLast") },
      wonMore: {
        npc: "Impecable. Eso es tenerlo por dentro, no en el historial del chat.",
        options: [
          { text: "¡Gracias!", end: true }
        ]
      },
      wonLast: {
        npc: "Impecable. Eso es tenerlo por dentro, no en el historial del chat." + LAST_PRACTICE_HINT,
        options: [
          { text: "¡Gracias!", end: true }
        ]
      },
      lost: { route: afterPractice("lostMore", "lostLast") },
      lostMore: {
        npc: "Casi. Ya tienes la solución delante: entiéndela, no solo la memorices.",
        options: [
          { text: "Lo tendré en cuenta. (Salir)", end: true }
        ]
      },
      lostLast: {
        npc: "Casi. Ya tienes la solución delante: entiéndela, no solo la memorices." + LAST_PRACTICE_HINT,
        options: [
          { text: "Lo tendré en cuenta. (Salir)", end: true }
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
                     : (practiceDone(GAME) || window.DEBUG) ? "ready"
                     : "notReady"
      },
      notReady: {
        npc: GAME => {
          const n = practiceLeft(GAME);
          const left = n === 1 ? "te falta 1 reto" : `te faltan ${n} retos`;
          return `¿El examen final? Con esa cara de haber dormido tres horas, no. Todavía ${left} de práctica. Vuelve cuando sepas distinguir un &lt;section&gt; de un &lt;div&gt;.`;
        },
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
        npc: "Vaya, veo que has hecho todos los retos de práctica. Bien. Última pregunta del examen final, y solo hay una oportunidad. Y recuerda: puedes consultar al LLM, pero cada token que malgastes… ya sabes quién engorda.",
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
        npc: "Lo siento, pero es un suspenso. Y ahora que has visto la respuesta, no tendría sentido repetirlo. Revisa cómo has usado la IA y vuelve el próximo curso.",
        options: [
          { text: "Vaya… (Ver resultado)", action: { type: "lose" } }
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
