// Promptzilla — Game content (teacher-editable)
// Edit this file to change the questions, options and correct answers.
// It is plain data wrapped in a single assignment, so it works both when the
// game is opened directly (file://) and when served over HTTP.
//
// Schema per challenge:
//   id        {number}          unique identifier
//   number    {string}          display number ("1", "2"…)
//   title     {string}          short title shown in the HUD
//   question  {string}          HTML-safe question text
//   options   [{label, text}]   answer options; text is HTML-safe
//   correct   {number|number[]} 0-based index or array of indices
//   type      {"single"|"multiple"}  optional; inferred from correct if omitted

"use strict";

/* global window */
window.CONTENT = {
  challenges: [
    {
      id: 1,
      number: "1",
      title: "Etiquetas de encabezado",
      question: "Quieres que los buscadores identifiquen el título principal de tu web. ¿Qué etiqueta corresponde al título más importante de la página?",
      options: [
        { label: "A", text: "<code>&lt;title&gt;</code>" },
        { label: "B", text: "<code>&lt;h1&gt;</code>" },
        { label: "C", text: "<code>&lt;header&gt;</code>" },
        { label: "D", text: "<code>&lt;heading&gt;</code>" }
      ],
      correct: 1
    },
    {
      id: 2,
      number: "2",
      title: "Atributo de imagen",
      question: "Las fotos de tu galería no aparecen. Revisando cada <code>&lt;img&gt;</code>, ¿qué atributo indica la ruta o URL de la imagen?",
      options: [
        { label: "A", text: "<code>href</code>" },
        { label: "B", text: "<code>src</code>" },
        { label: "C", text: "<code>alt</code>" },
        { label: "D", text: "<code>url</code>" }
      ],
      correct: 1
    },
    {
      id: 3,
      number: "3",
      title: "Estructura de un documento HTML5",
      question: "Empiezas tu práctica. ¿Cuál es la estructura correcta de un documento HTML5?",
      options: [
        { label: "A", text: "<code>&lt;html&gt; &lt;head&gt;…&lt;/head&gt; &lt;body&gt;…&lt;/body&gt; &lt;/html&gt;</code>" },
        { label: "B", text: "<code>&lt;html&gt; &lt;body&gt;…&lt;/body&gt; &lt;head&gt;…&lt;/head&gt; &lt;/html&gt;</code>" },
        { label: "C", text: "<code>&lt;head&gt;…&lt;/head&gt; &lt;body&gt;…&lt;/body&gt;</code>" },
        { label: "D", text: "<code>&lt;html&gt; &lt;content&gt;…&lt;/content&gt; &lt;/html&gt;</code>" }
      ],
      correct: 0
    },
    {
      id: 4,
      number: "5",
      title: "HTML semántico",
      question: "Tu blog tiene cabecera, menú, barra lateral y pie. ¿Qué etiqueta semántica de HTML5 delimita mejor el contenido principal?",
      options: [
        { label: "A", text: "<code>&lt;div id=\"main\"&gt;</code>" },
        { label: "B", text: "<code>&lt;section&gt;</code>" },
        { label: "C", text: "<code>&lt;main&gt;</code>" },
        { label: "D", text: "<code>&lt;content&gt;</code>" }
      ],
      correct: 2
    },
    {
      id: 5,
      number: "4",
      title: "Etiquetas semánticas HTML5",
      type: "multiple",
      question: "No recuerdas qué etiquetas aportan significado al contenido. ¿Cuáles de estas son etiquetas semánticas de HTML5? <em>(Selecciona todas las correctas)</em>",
      options: [
        { label: "A", text: "<code>&lt;section&gt;</code>" },
        { label: "B", text: "<code>&lt;div&gt;</code>" },
        { label: "C", text: "<code>&lt;header&gt;</code>" },
        { label: "D", text: "<code>&lt;span&gt;</code>" }
      ],
      correct: [0, 2]
    }
  ]
};
