// Promptzilla — Spanish UI strings. Values may use {placeholders} or be functions(vars).
"use strict";

/* global window */
window.I18N_STRINGS = window.I18N_STRINGS || {};
window.I18N_STRINGS.es = {
  _meta: { locale: "es-ES", label: "ES", name: "Spanish", nativeName: "Español" },

  "doc.title": "Promptzilla — Aventura",

  // Start screen
  "start.intro": "Año 2035. <strong>Promptzilla</strong>, un monstruo que engorda con cada prompt perezoso, ronda la Universidad. Tu misión: superar los retos sin cebarlo.",
  "start.rule.move": "Haz clic en el escenario para moverte y en los personajes para hablar con ellos.",
  "start.rule.challenges": "Algunos personajes te plantearán retos relacionados con la asignatura.",
  "start.rule.tokens": "En cada reto puedes consultar a la IA, pero gasta <strong>tokens</strong>: el modo socrático cuesta la mitad que el directo.",
  "start.rule.once": "Cada reto solo se puede responder una vez. Si fallas, verás la solución.",
  "start.rule.report": "Al final recibirás un informe sobre cómo has usado la IA.",
  "start.privacy.title": "Registro anónimo de la partida",
  "start.privacy.text": "Se registra de forma anónima tu interacción con el juego con fines de investigación docente. No se guarda el texto de tus prompts ni ningún dato que permita identificarte o relacionar el registro contigo.",
  "start.loading": "Cargando…",
  "start.loadingPct": "Cargando… {pct}%",
  "start.ready": "¡Todo listo!",
  "start.slow": "Aún se está cargando, pero ya puedes empezar.",
  "start.button": "Empezar →",

  // HUD + world
  "hud.tokens": "{tokens} / {max} tokens",
  "world.nothing": "No hay nada interesante aquí.",

  // End screen
  "end.summary": ({ correct, total }) => correct === 0
    ? `No acertaste ninguno de los ${total} retos.`
    : `Acertaste ${correct} de los ${total} retos.`,
  "end.flavor.high": "Has cebado a Promptzilla: se ha zampado casi todos tus tokens y ahora ronda la facultad más grande que nunca.",
  "end.flavor.low": "Has puesto a Promptzilla a dieta: apenas ha probado tus tokens y se ha quedado con hambre.",
  "end.flavor.mid": "Promptzilla sigue en la ciudad, pero hoy no lo has cebado. La facultad respira.",
  "end.tokens": "Tokens gastados: <strong>{spent}</strong> · Restantes: <strong>{remaining}</strong>",
  "end.analyzing": "Analizando tus prompts…",
  "end.download": "Descargar informe (HTML)",
  "end.restart": "Volver a empezar",

  // Challenge overlay
  "challenge.tokens": "{tokens} tokens",
  "challenge.exit": "✕ Salir",
  "challenge.exitTitle": "Salir del reto y volver más tarde",
  "challenge.multiHint": "☑ Selecciona <strong>todas</strong> las respuestas correctas",
  "challenge.submit": "Responder →",
  "challenge.llmTitle": "Consultar al LLM",
  "challenge.modeLabel": "Modo:",
  "challenge.modeDirect": "Directo (×2)",
  "challenge.modeSocratic": "Socrático (×1)",
  "challenge.modeInfo": "¿Qué es cada modo?",
  "challenge.modeHelpDirect": "<strong>Directo (×2):</strong> la IA te responde con la solución completa. Cuesta el doble de tokens.",
  "challenge.modeHelpSocratic": "<strong>Socrático (×1):</strong> la IA no te da la solución, solo pistas y preguntas para que llegues tú. Cuesta la mitad.",
  "challenge.placeholder": "Escribe tu consulta y pulsa Consultar (o Enter)…",
  "challenge.consult": "Consultar",
  "challenge.noTokens": "⛔ Sin tokens — responde por tu cuenta",
  "challenge.cost": ({ cost, words }) => `Coste estimado: ${cost} tokens (${words} ${words === 1 ? "palabra" : "palabras"})`,
  "challenge.costTooHigh": "⛔ Coste estimado: {cost} tokens — solo tienes {tokens}",
  "challenge.warnEmpty": "⚠️ Escribe una consulta antes de preguntar.",
  "challenge.warnProfanity": "⚠️ Cuida el lenguaje: reformula tu consulta sin palabras ofensivas.",
  "challenge.warnNoTokens": "⚠️ Sin tokens. No puedes consultar al LLM.",
  "challenge.warnTooExpensive": "⚠️ Esta consulta cuesta {cost} tokens y solo tienes {tokens}. Acórtala o usa el modo socrático.",
  "challenge.tagDirect": "Directo",
  "challenge.tagSocratic": "Socrático",
  "challenge.typing": "escribiendo…",
  "challenge.failed": "📡 La conexión ha fallado, cosas de la IA… vuelve a intentarlo.",
  "challenge.correct": "¡Correcto!",
  "challenge.incorrect": "Incorrecto",
  "challenge.answerOne": "Respuesta correcta",
  "challenge.answerMany": "Respuestas correctas",
  "challenge.and": " y ",
  "challenge.tokensUsed": "Tokens usados: {tokens}",
  "challenge.continue": "Continuar →",

  // Prompt report
  "report.summary": "Resumen",
  "report.detail": "Detalle por prueba",
  "report.strengths": "Fortalezas",
  "report.improvements": "A mejorar",
  "report.conclusion": "Conclusión",
  "report.summaryUnavailable": "Resumen no disponible.",
  "report.noConsults": "No consultaste al LLM en ninguna prueba.",
  "report.repeated": "repetido ×{n}",
  "report.copied": "copiado del enunciado",
  "report.modeDirect": "Directo",
  "report.modeSocratic": "Socrático",
  "report.clarity": "Claridad",
  "report.context": "Contexto",
  "report.conciseness": "Concisión",
  "report.overall": "Valoración",
  "report.suggestion": "Sugerencia",
  "report.notEvaluated": "No evaluado.",
  "report.tutorAnswer": "Respuesta del tutor",
  "report.abandoned": "↩ Abandonada",
  "report.passed": "✓ Acertada",
  "report.failed": "✗ Fallada",
  "report.solvedNoConsult": "Resuelto sin consultar",
  "report.answeredNoConsult": "Respondido sin consultar",
  "report.attempt": "Prueba {number} — {title}",
  "report.title": "Informe de tus prompts",
  "report.docTitle": "Promptzilla — Informe de prompts",
  "report.filename": "informe-promptzilla.html",

  // xAPI activity names
  "xapi.tutor": "Tutor IA · {title}",
  "xapi.mode": "Modo IA · {title}",
  "xapi.evaluation": "Evaluación de prompts · {title}",
  "xapi.report": "Informe de prompts"
};
