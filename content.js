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
      question: "¿Cuál es la etiqueta HTML correcta para el título <strong>más importante</strong> de una página web?",
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
      question: "¿Qué atributo de la etiqueta <code>&lt;img&gt;</code> indica la <strong>ruta o URL</strong> de la imagen a mostrar?",
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
      question: "¿Cuál de estas opciones representa la estructura <strong>correcta</strong> de un documento HTML5?",
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
      number: "4",
      title: "HTML semántico",
      question: "¿Cuál es la etiqueta semántica de HTML5 más adecuada para delimitar el <strong>contenido principal</strong> de una página?",
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
      number: "5",
      title: "Etiquetas semánticas HTML5",
      type: "multiple",
      question: "¿Cuáles de estas son etiquetas <strong>semánticas</strong> de HTML5? <em>(Selecciona todas las correctas)</em>",
      options: [
        { label: "A", text: "<code>&lt;section&gt;</code>" },
        { label: "B", text: "<code>&lt;div&gt;</code>" },
        { label: "C", text: "<code>&lt;article&gt;</code>" },
        { label: "D", text: "<code>&lt;span&gt;</code>" }
      ],
      correct: [0, 2]
    }
  ]
};
