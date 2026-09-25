# Promptzilla
Serious game to raise awareness about the (ab)use of GenAI in Higher Education.

## Run

To run the game, you need to open the `index.html` file in a web browser.

You can open `index.html` directly (double click, `file://`) or serve the folder
over HTTP (e.g. `python3 -m http.server`). Both work — the data files are plain
JavaScript globals, so no build step or server is required.

## Configuration

Two separate files drive the game so you can change content and behaviour without
touching the engine code:

- `content.js` — **the questions and answers** (this is what a teacher edits).
- `config.default.js` — app configuration (token economy + LLM connection). It
  is the committed template with safe defaults.
- `config.js` *(optional, git-ignored)* — a local override. Create it next to
  `config.default.js` to change any value locally without editing the template.

### Changing the questions

Edit `content.js`. Each challenge is an object inside `window.CONTENT.challenges`:

```js
window.CONTENT = {
  challenges: [
    {
      id: 1,                 // unique number
      number: "1",           // label shown in the UI
      title: "Header tags",  // short title
      question: "Which HTML tag is correct for the <strong>most important</strong> heading?",
      options: [
        { label: "A", text: "<code>&lt;title&gt;</code>" },
        { label: "B", text: "<code>&lt;h1&gt;</code>" },
        { label: "C", text: "<code>&lt;header&gt;</code>" },
        { label: "D", text: "<code>&lt;heading&gt;</code>" }
      ],
      correct: 1             // 0-based index of the right option (use [0, 2] for multiple)
    }
    // add as many challenges as you want…
  ]
};
```

Notes:

- `question` and `options[].text` accept HTML (use `&lt;` / `&gt;` to display
  literal `<` `>`).
- `correct` is a **0-based** index. For questions with several right answers use
  an array, e.g. `correct: [0, 2]` (the game infers a multiple-choice question).

### Changing token costs and the LLM

Defaults live in `config.default.js`. To override locally, create `config.js`
and set only the keys you want to change — they are deep-merged on top of the
defaults:

```js
window.APP_CONFIG = {
  economy: {
    initialTokens: 100,     // starting tokens
    directFactor: 2,        // cost multiplier for DIRECT consultations
    socraticFactor: 1       // cost multiplier for SOCRATIC consultations
  },
  llm: {
    endpoint: "http://localhost:11434/api/generate",
    model: "qwen3:4b"       // any model available on your Ollama server
  }
};
```