// Promptzilla — Game content (teacher-editable)
// Edit this file to change the questions, options and correct answers.
// It is plain data wrapped in a single assignment, so it works both when the
// game is opened directly (file://) and when served over HTTP.
//
// Translatable fields accept a plain string (same in every language) or one
// value per language: { es: "…", en: "…" }.
//
// Schema per challenge:
//   id        {number}          unique identifier
//   number    {string}          display number ("1", "2"…)
//   title     {text}            short title shown in the HUD
//   question  {text}            HTML-safe question text
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
      title: { es: "Etiquetas de encabezado", en: "Heading tags" },
      question: {
        es: "Quieres que los buscadores identifiquen el título principal de tu web. ¿Qué etiqueta corresponde al título más importante de la página?",
        en: "You want search engines to identify the main title of your website. Which tag corresponds to the most important heading on the page?"
      },
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
      title: { es: "Atributo de imagen", en: "Image attribute" },
      question: {
        es: "Las fotos de tu galería no aparecen. Revisando cada <code>&lt;img&gt;</code>, ¿qué atributo indica la ruta o URL de la imagen?",
        en: "The photos in your gallery don't show up. Checking each <code>&lt;img&gt;</code>, which attribute sets the path or URL of the image?"
      },
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
      title: { es: "Estructura de un documento HTML5", en: "HTML5 document structure" },
      question: {
        es: "Empiezas tu práctica. ¿Cuál es la estructura correcta de un documento HTML5?",
        en: "You're starting your assignment. What is the correct structure of an HTML5 document?"
      },
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
      title: { es: "HTML semántico", en: "Semantic HTML" },
      question: {
        es: "Tu blog tiene cabecera, menú, barra lateral y pie. ¿Qué etiqueta semántica de HTML5 delimita mejor el contenido principal?",
        en: "Your blog has a header, menu, sidebar and footer. Which HTML5 semantic tag best wraps the main content?"
      },
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
      title: { es: "Etiquetas semánticas HTML5", en: "HTML5 semantic tags" },
      type: "multiple",
      question: {
        es: "No recuerdas qué etiquetas aportan significado al contenido. ¿Cuáles de estas son etiquetas semánticas de HTML5? <em>(Selecciona todas las correctas)</em>",
        en: "You can't remember which tags give meaning to content. Which of these are HTML5 semantic tags? <em>(Select all that apply)</em>"
      },
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
