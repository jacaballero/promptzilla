// Promptzilla — Challenge data (editable data file, loaded as a script tag)
// Edit this file to add, remove or modify challenges.
//
// Schema per challenge:
//   id        {number}          unique identifier
//   number    {string}          display number ("1", "2"…)
//   title     {string}          short title shown in HUD
//   question  {string}          HTML-safe question text
//   options   [{label, text}]   answer options; text is HTML-safe
//   correct   {number|number[]} 0-based index or array of indices
//   type      {"single"|"multiple"}  optional; inferred from correct if omitted
//   llm_responses.direct    {string}  simulated LLM direct response
//   llm_responses.socratic  {string}  simulated LLM socratic response

"use strict";

/* global window */
window.CHALLENGES = [
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
    correct: 1,
    llm_responses: {
      direct:
        "La etiqueta correcta es <strong>&lt;h1&gt;</strong>. Es el encabezado de nivel 1, el más importante jerárquicamente en HTML. Los niveles van del &lt;h1&gt; al &lt;h6&gt;. Se recomienda usar solo un &lt;h1&gt; por página, para el título principal del contenido.",
      socratic:
        "Pista: las etiquetas de encabezado en HTML se nombran con la letra <em>h</em> seguida de un número del 1 al 6. Si ese número indica el nivel de importancia… ¿qué número usarías para el encabezado <em>más</em> importante?"
    }
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
    correct: 1,
    llm_responses: {
      direct:
        "El atributo correcto es <strong>src</strong> (abreviatura de <em>source</em>, fuente en inglés). Ejemplo: <code>&lt;img src='foto.jpg' alt='descripción'&gt;</code>. El atributo <code>href</code> se usa en los enlaces <code>&lt;a&gt;</code>, no en imágenes.",
      socratic:
        "Pista: la etiqueta <code>&lt;img&gt;</code> necesita saber dónde encontrar la imagen. ¿Qué abreviatura inglesa podría representar el concepto de <em>fuente</em> u <em>origen</em> de ese archivo?"
    }
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
    correct: 0,
    llm_responses: {
      direct:
        "La estructura correcta sitúa <code>&lt;head&gt;</code> antes que <code>&lt;body&gt;</code>, ambos dentro del elemento raíz <code>&lt;html&gt;</code>. El <code>&lt;head&gt;</code> contiene metadatos, CSS y el título; el <code>&lt;body&gt;</code> contiene el contenido visible. Las otras opciones alteran ese orden o eliminan el elemento raíz.",
      socratic:
        "Piensa en la estructura como un cuerpo humano: primero va la <em>cabeza</em> (head) con información que no se ve, luego el <em>cuerpo</em> (body) con lo que sí se muestra. ¿Cuál de las opciones respeta ese orden, con ambas partes dentro de <code>&lt;html&gt;</code>?"
    }
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
    correct: 2,
    llm_responses: {
      direct:
        "La etiqueta correcta es <strong>&lt;main&gt;</strong>. HTML5 introdujo etiquetas semánticas que describen su propio contenido. <code>&lt;main&gt;</code> identifica el bloque de contenido principal del documento, distinto de la cabecera, el pie y la navegación. Solo debería haber un <code>&lt;main&gt;</code> por página.",
      socratic:
        "HTML5 tiene etiquetas cuyo nombre en inglés describe literalmente su función. ¿Cuál de las opciones tiene un nombre que en inglés significa exactamente <em>principal</em>? Pista: no es un genérico como <code>&lt;div&gt;</code> ni una invención."
    }
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
    correct: [0, 2],
    llm_responses: {
      direct:
        "Las etiquetas semánticas correctas son <strong>&lt;section&gt;</strong> y <strong>&lt;article&gt;</strong>. Describen el tipo de contenido que encierran. <code>&lt;div&gt;</code> y <code>&lt;span&gt;</code> son genéricos: no transmiten ningún significado semántico al navegador ni a los lectores de pantalla.",
      socratic:
        "Pista: una etiqueta «semántica» es aquella cuyo nombre describe el <em>significado</em> del contenido, no solo su presentación visual. ¿Qué opciones tienen nombres que indican claramente qué tipo de contenido encierran? <code>&lt;div&gt;</code> y <code>&lt;span&gt;</code>: ¿dicen algo sobre lo que contienen?"
    }
  }
];
