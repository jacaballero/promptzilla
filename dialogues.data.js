// Promptzilla — Dialogue trees for the adventure prototype
// Code language: English | Content: one value per language, { es: "…", en: "…" }
//
// Each dialogue is a set of nodes. The engine starts at `start` and renders the
// current node's `npc` line plus its `options`. `name` labels the dialogue in
// the xAPI log.
//
// Node schema:
//   npc      {text|function(GAME): text}  what the character says (a function
//                                          lets the line depend on game state)
//   route    {function(GAME): string} optional; if present, jump to the returned node id
//   options  [{ ... }]                 player choices
//   label    {text}                    optional; name of the node in the xAPI log
//                                      (defaults to DIALOGUE_NODE_LABELS[node id])
//
// Option schema (all fields optional except `text`):
//   text        {text}                   the choice shown to the player
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
const LAST_PRACTICE_HINT = {
  es: " Por cierto, con este ya has hecho los tres retos de práctica: el profe te espera en el aula 0.01 para el examen final.",
  en: " By the way, with this one you've done all three practice challenges: the teacher is waiting for you in room 0.01 for the final exam."
};
const withHint = line => ({ es: line.es + LAST_PRACTICE_HINT.es, en: line.en + LAST_PRACTICE_HINT.en });
const afterPractice = (more, last) => GAME => practiceDone(GAME) ? last : more;

// Names of the dialogue nodes in the xAPI log ("<dialogue> · <node>"), shared by
// every dialogue that reuses the same node id.
window.DIALOGUE_NODE_LABELS = {
  root: { es: "encuentro", en: "encounter" },
  intro: { es: "saludo", en: "greeting" },
  spent: { es: "reto ya hecho", en: "challenge already done" },
  gossip: { es: "rumores sobre Promptzilla", en: "Promptzilla gossip" },
  meta: { es: "uso de la IA", en: "using AI" },
  wonMore: { es: "reto acertado", en: "challenge passed" },
  wonLast: { es: "reto acertado (último de práctica)", en: "challenge passed (last practice)" },
  lostMore: { es: "reto fallado", en: "challenge failed" },
  lostLast: { es: "reto fallado (último de práctica)", en: "challenge failed (last practice)" },
  notReady: { es: "examen bloqueado", en: "exam locked" },
  insist: { es: "insistir", en: "insisting" },
  ready: { es: "examen final", en: "final exam" },
  passed: { es: "aprobado", en: "passed" },
  failed: { es: "suspenso", en: "failed" },
  alreadyPassed: { es: "ya aprobado", en: "already passed" },
  origin: { es: "origen", en: "origin" },
  threat: { es: "desafío", en: "showdown" }
};

window.DIALOGUES = {

  // ─── Student girl (practice) ─────────────────────────────────────────────
  studentGirl: {
    name: { es: "Estudiante de la coleta", en: "Student with a ponytail" },
    start: "root",
    nodes: {
      root: {
        route: GAME => GAME.flags.answeredChallenge1 ? "spent" : "intro"
      },
      intro: {
        npc: {
          es: "¡Ah, hola! ¿Tú también con el examen final? Yo llevo repasando HTML desde que Promptzilla se comió el temario de la nube.",
          en: "Oh, hi! You're also on the final exam? I've been revising HTML ever since Promptzilla ate the syllabus from the cloud."
        },
        options: [
          { text: { es: "¿Me pones un reto para practicar?", en: "Can you give me a practice challenge?" }, action: { type: "challenge", challengeId: 1, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: { es: "¿Qué sabes de Promptzilla?", en: "What do you know about Promptzilla?" }, goto: "gossip" },
          { text: { es: "Nada, ya sigo. (Salir)", en: "Nothing, I'll keep going. (Leave)" }, end: true }
        ]
      },
      spent: {
        npc: GAME => GAME.flags.failedChallenge1
          ? { es: "Mi reto ya lo has visto, con solución incluida. Ahora toca que se te quede.",
              en: "You've already seen my challenge, solution included. Now make it stick." }
          : { es: "Mi reto ya lo clavaste. No te voy a poner el mismo dos veces, que te aburres.",
              en: "You nailed my challenge already. I won't give you the same one twice, you'd get bored." },
        options: [
          { text: { es: "¿Qué sabes de Promptzilla?", en: "What do you know about Promptzilla?" }, goto: "gossip" },
          { text: { es: "Gracias. (Salir)", en: "Thanks. (Leave)" }, end: true }
        ]
      },
      gossip: {
        npc: {
          es: "¿Promptzilla? Lleva años en la ciudad. Dicen que nació de tanto pedirle a la IA que 'lo hiciera por ti'. Ahora hasta tiene cuenta verificada.",
          en: "Promptzilla? It's been in town for years. They say it was born from people asking the AI to 'just do it for me'. Now it even has a verified account."
        },
        options: [
          { text: { es: "Ponme un reto, va.", en: "Give me a challenge, go on." }, action: { type: "challenge", challengeId: 1, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: { es: "Volver", en: "Back" }, goto: "root" }
        ]
      },
      won: { route: afterPractice("wonMore", "wonLast") },
      wonMore: {
        npc: {
          es: "¡Toma! Se nota que has estudiado y no solo copiado.",
          en: "Boom! You can tell you studied and didn't just copy."
        },
        options: [
          { text: { es: "Gracias, ¡nos vemos!", en: "Thanks, see you!" }, end: true }
        ]
      },
      wonLast: {
        npc: withHint({
          es: "¡Toma! Se nota que has estudiado y no solo copiado.",
          en: "Boom! You can tell you studied and didn't just copy."
        }),
        options: [
          { text: { es: "¡Voy para allá!", en: "On my way!" }, end: true }
        ]
      },
      lost: { route: afterPractice("lostMore", "lostLast") },
      lostMore: {
        npc: {
          es: "Uf, casi. Ahora ya sabes cuál era: apúntatelo bien, que no se perdona ni un &lt;div&gt; de más.",
          en: "Ouch, close. Now you know which one it was: write it down, not even one extra &lt;div&gt; gets forgiven."
        },
        options: [
          { text: { es: "Me lo apunto. (Salir)", en: "Noted. (Leave)" }, end: true }
        ]
      },
      lostLast: {
        npc: withHint({
          es: "Uf, casi. Ahora ya sabes cuál era: apúntatelo bien.",
          en: "Ouch, close. Now you know which one it was: write it down."
        }),
        options: [
          { text: { es: "Me lo apunto. (Salir)", en: "Noted. (Leave)" }, end: true }
        ]
      }
    }
  },

  // ─── Student boy (practice) ──────────────────────────────────────────────
  studentBoy: {
    name: { es: "Estudiante de los cascos", en: "Student with headphones" },
    start: "root",
    nodes: {
      root: {
        route: GAME => GAME.flags.answeredChallenge2 ? "spent" : "intro"
      },
      intro: {
        npc: {
          es: "Ey. *se baja los cascos* Estoy repasando con lo-fi y buenas intenciones. ¿Quieres que te tome uno de práctica?",
          en: "Hey. *pulls headphones down* I'm revising with lo-fi and good intentions. Want me to quiz you with a practice one?"
        },
        options: [
          { text: { es: "Dale, un reto.", en: "Sure, a challenge." }, action: { type: "challenge", challengeId: 2, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: { es: "¿Tú le preguntas a la IA?", en: "Do you ask the AI?" }, goto: "meta" },
          { text: { es: "Ahora vuelvo. (Salir)", en: "Be right back. (Leave)" }, end: true }
        ]
      },
      spent: {
        npc: GAME => GAME.flags.failedChallenge2
          ? { es: "*se vuelve a poner un casco* Mi pregunta ya la quemaste, bro. Pero ya sabes la respuesta, que es lo que cuenta.",
              en: "*puts one earcup back on* You already burnt my question, bro. But you know the answer now, that's what counts." }
          : { es: "*se vuelve a poner un casco* Mi pregunta ya la sacaste, bro. Nada más que rascar por aquí.",
              en: "*puts one earcup back on* You already got my question, bro. Nothing more to scrape here." },
        options: [
          { text: { es: "¿Tú le preguntas a la IA?", en: "Do you ask the AI?" }, goto: "meta" },
          { text: { es: "Hasta luego. (Salir)", en: "See you. (Leave)" }, end: true }
        ]
      },
      meta: {
        npc: {
          es: "Claro, pero en modo socrático. Si le pides la respuesta masticada, Promptzilla engorda y a mí me da vergüenza ajena.",
          en: "Sure, but in Socratic mode. If you ask for the answer spoon-fed, Promptzilla gets fatter and I cringe for you."
        },
        options: [
          { text: { es: "Ponme el reto.", en: "Give me the challenge." }, action: { type: "challenge", challengeId: 2, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: { es: "Volver", en: "Back" }, goto: "root" }
        ]
      },
      won: { route: afterPractice("wonMore", "wonLast") },
      wonMore: {
        npc: { es: "¡Crack! Eso ya es nivel examen.", en: "Legend! That's exam level already." },
        options: [
          { text: { es: "¡Gracias!", en: "Thanks!" }, end: true }
        ]
      },
      wonLast: {
        npc: withHint({ es: "¡Crack! Eso ya es nivel examen.", en: "Legend! That's exam level already." }),
        options: [
          { text: { es: "¡Voy!", en: "On it!" }, end: true }
        ]
      },
      lost: { route: afterPractice("lostMore", "lostLast") },
      lostMore: {
        npc: {
          es: "Nah, tranqui. Ni yo lo saqué a la primera. Quédate con la respuesta, que aquí no hay segunda vuelta.",
          en: "Nah, chill. I didn't get it first time either. Keep the answer in mind, there's no second round here."
        },
        options: [
          { text: { es: "Anotado. (Salir)", en: "Got it. (Leave)" }, end: true }
        ]
      },
      lostLast: {
        npc: withHint({
          es: "Nah, tranqui. Ni yo lo saqué a la primera. Quédate con la respuesta.",
          en: "Nah, chill. I didn't get it first time either. Keep the answer in mind."
        }),
        options: [
          { text: { es: "Anotado. (Salir)", en: "Got it. (Leave)" }, end: true }
        ]
      }
    }
  },

  // ─── Student with glasses (practice, classroom 0.02) ─────────────────────
  studentGlasses: {
    name: { es: "Estudiante con gafas", en: "Student with glasses" },
    start: "root",
    nodes: {
      root: {
        route: GAME => GAME.flags.answeredChallenge3 ? "spent" : "intro"
      },
      intro: {
        npc: {
          es: "(Levanta la vista de la tablet) Buenas. Estoy ordenando mis apuntes por etiquetas semánticas, como debe ser. ¿Te lanzo un reto de práctica?",
          en: "(Looks up from the tablet) Hi. I'm sorting my notes by semantic tags, as one should. Shall I throw you a practice challenge?"
        },
        options: [
          { text: { es: "Venga, un reto.", en: "Go on, a challenge." }, action: { type: "challenge", challengeId: 3, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: { es: "¿Apuntes en tablet? ¿No tiras de IA?", en: "Notes on a tablet? You don't just use AI?" }, goto: "meta" },
          { text: { es: "Ahora vuelvo. (Salir)", en: "Be right back. (Leave)" }, end: true }
        ]
      },
      spent: {
        npc: GAME => GAME.flags.failedChallenge3
          ? { es: "(Sin levantar la vista) Mi reto ya lo hiciste y viste la solución. Repetirlo sería hacer trampa, y aquí no hacemos eso.",
              en: "(Without looking up) You already did my challenge and saw the solution. Repeating it would be cheating, and we don't do that here." }
          : { es: "(Sin levantar la vista) Mi reto ya lo resolviste, y bien. Repetirlo no te enseñaría nada nuevo.",
              en: "(Without looking up) You already solved my challenge, and well. Repeating it wouldn't teach you anything new." },
        options: [
          { text: { es: "¿Apuntes en tablet? ¿No tiras de IA?", en: "Notes on a tablet? You don't just use AI?" }, goto: "meta" },
          { text: { es: "Entendido. (Salir)", en: "Understood. (Leave)" }, end: true }
        ]
      },
      meta: {
        npc: {
          es: "La IA la uso para entender, no para que piense por mí. Prompt concreto, respuesta útil, y Promptzilla se queda a dieta.",
          en: "I use AI to understand, not to think for me. Specific prompt, useful answer, and Promptzilla stays on a diet."
        },
        options: [
          { text: { es: "Ponme el reto.", en: "Give me the challenge." }, action: { type: "challenge", challengeId: 3, onWinGoto: "won", onLoseGoto: "lost" } },
          { text: { es: "Volver", en: "Back" }, goto: "root" }
        ]
      },
      won: { route: afterPractice("wonMore", "wonLast") },
      wonMore: {
        npc: {
          es: "Impecable. Eso es tenerlo por dentro, no en el historial del chat.",
          en: "Flawless. That's knowing it inside, not in your chat history."
        },
        options: [
          { text: { es: "¡Gracias!", en: "Thanks!" }, end: true }
        ]
      },
      wonLast: {
        npc: withHint({
          es: "Impecable. Eso es tenerlo por dentro, no en el historial del chat.",
          en: "Flawless. That's knowing it inside, not in your chat history."
        }),
        options: [
          { text: { es: "¡Gracias!", en: "Thanks!" }, end: true }
        ]
      },
      lost: { route: afterPractice("lostMore", "lostLast") },
      lostMore: {
        npc: {
          es: "Casi. Ya tienes la solución delante: entiéndela, no solo la memorices.",
          en: "Close. You have the solution in front of you now: understand it, don't just memorise it."
        },
        options: [
          { text: { es: "Lo tendré en cuenta. (Salir)", en: "I'll keep it in mind. (Leave)" }, end: true }
        ]
      },
      lostLast: {
        npc: withHint({
          es: "Casi. Ya tienes la solución delante: entiéndela, no solo la memorices.",
          en: "Close. You have the solution in front of you now: understand it, don't just memorise it."
        }),
        options: [
          { text: { es: "Lo tendré en cuenta. (Salir)", en: "I'll keep it in mind. (Leave)" }, end: true }
        ]
      }
    }
  },

  // ─── Teacher (final exam) ────────────────────────────────────────────────
  teacher: {
    name: { es: "Profesor", en: "Teacher" },
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
          const leftEn = n === 1 ? "1 practice challenge" : `${n} practice challenges`;
          return {
            es: `¿El examen final? Con esa cara de haber dormido tres horas, no. Todavía ${left} de práctica. Vuelve cuando sepas distinguir un &lt;section&gt; de un &lt;div&gt;.`,
            en: `The final exam? With that I-slept-three-hours face, no. You still have ${leftEn} to go. Come back when you can tell a &lt;section&gt; from a &lt;div&gt;.`
          };
        },
        options: [
          { text: { es: "Está bien, iré a practicar.", en: "All right, I'll go and practise." }, end: true },
          { text: { es: "¿Y no me lo aprueba por insistencia?", en: "Can't you pass me for persistence?" }, goto: "insist" }
        ]
      },
      insist: {
        npc: {
          es: "Joven, esto es 2035, no una reunión de trabajo. Aquí se demuestra lo que se sabe. A practicar.",
          en: "Young one, this is 2035, not a business meeting. Here you prove what you know. Go practise."
        },
        options: [
          { text: { es: "Vale, vale…", en: "OK, OK…" }, end: true }
        ]
      },
      ready: {
        npc: {
          es: "Vaya, veo que has hecho todos los retos de práctica. Bien. Última pregunta del examen final, y solo hay una oportunidad. Y recuerda: puedes consultar al LLM, pero cada token que malgastes… ya sabes quién engorda.",
          en: "Well, I see you've done all the practice challenges. Good. Last question of the final exam, and there's only one chance. And remember: you can ask the LLM, but every token you waste… you know who gets fatter."
        },
        options: [
          { text: { es: "Estoy listo. Examíneme.", en: "I'm ready. Test me." }, action: { type: "challenge", challengeId: 5, onWinGoto: "passed", onLoseGoto: "failed" } },
          { text: { es: "Deme un segundo. (Salir)", en: "Give me a second. (Leave)" }, end: true }
        ]
      },
      passed: {
        npc: {
          es: "¡Aprobado! Y sin cebar al monstruo. Hay esperanza para esta facultad después de todo.",
          en: "Passed! And without feeding the monster. There's hope for this faculty after all."
        },
        setFlag: "passedExam",
        options: [
          { text: { es: "¡Gracias, profe!", en: "Thanks, professor!" }, action: { type: "win" } }
        ]
      },
      failed: {
        npc: {
          es: "Lo siento, pero es un suspenso. Y ahora que has visto la respuesta, no tendría sentido repetirlo. Revisa cómo has usado la IA y vuelve el próximo curso.",
          en: "I'm sorry, but it's a fail. And now that you've seen the answer, there's no point repeating it. Review how you used the AI and come back next year."
        },
        options: [
          { text: { es: "Vaya… (Ver resultado)", en: "Oh well… (See result)" }, action: { type: "lose" } }
        ]
      },
      alreadyPassed: {
        npc: {
          es: "Ya has aprobado. Ve a celebrarlo… pero paga el café en efectivo, no en tokens.",
          en: "You've already passed. Go and celebrate… but pay for the coffee in cash, not in tokens."
        },
        options: [
          { text: { es: "Ja. Adiós, profe.", en: "Ha. Bye, professor." }, end: true }
        ]
      }
    }
  },

  // ─── Promptzilla (rooftop) ───────────────────────────────────────────────
  promptzilla: {
    name: "Promptzilla",
    start: "root",
    nodes: {
      root: {
        npc: {
          es: "GRRR… *eructa una nube de tokens* Vaya, un humano. ¿Vienes a cebarme con prompts kilométricos o a hacerte el responsable?",
          en: "GRRR… *burps a cloud of tokens* Well, a human. Have you come to feed me miles-long prompts or to play the responsible one?"
        },
        options: [
          { text: { es: "¿Cómo has llegado hasta aquí arriba?", en: "How did you get all the way up here?" }, goto: "origin" },
          { text: { es: "Vengo a que dejes en paz la facultad.", en: "I've come to make you leave the faculty alone." }, goto: "threat" },
          { text: { es: "Mejor me voy. (Salir)", en: "I'd better go. (Leave)" }, end: true }
        ]
      },
      origin: {
        npc: {
          es: "Nací de mil «hazme el trabajo entero». Cada atajo sin pensar me engorda. Soy, digamos, vuestra deuda técnica… con patas.",
          en: "I was born from a thousand «do the whole assignment for me». Every thoughtless shortcut fattens me up. I'm, let's say, your technical debt… with legs."
        },
        options: [
          { text: { es: "Qué inquietante.", en: "How unsettling." }, goto: "root" }
        ]
      },
      threat: {
        npc: {
          es: "¿Tú y cuántos créditos ECTS? Aprueba el examen final sin malgastar tokens y a lo mejor adelgazo. A lo mejor.",
          en: "You and how many ECTS credits? Pass the final exam without wasting tokens and maybe I'll slim down. Maybe."
        },
        options: [
          { text: { es: "Reto aceptado.", en: "Challenge accepted." }, end: true }
        ]
      }
    }
  }
};
