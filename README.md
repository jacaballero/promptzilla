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

- `content.js` — **the questions, answers and LLM responses** (this is what a
  teacher edits).
- `config.default.js` — app configuration (game mode + token economy + LLM
  connection). It is the committed template with safe defaults.
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
      correct: 1,            // 0-based index of the right option (use [0, 2] for multiple)
      llm_responses: {
        direct:   "Full answer shown when the player asks in DIRECT mode…",
        socratic: "Hint (no answer) shown when the player asks in SOCRATIC mode…"
      }
    }
    // add as many challenges as you want…
  ]
};
```

Notes:

- `question`, `options[].text` and the `llm_responses` accept HTML (use
  `&lt;` / `&gt;` to display literal `<` `>`).
- `correct` is a **0-based** index. For questions with several right answers use
  an array, e.g. `correct: [0, 2]` (the game infers a multiple-choice question).
- `llm_responses.direct` / `.socratic` are the pre-written answers the simulated
  LLM returns; there is no free-text typing in simulated mode.

### Changing mode and token costs

Defaults live in `config.default.js`. To override locally, create `config.js`
and set only the keys you want to change — they are deep-merged on top of the
defaults:

```js
window.APP_CONFIG = {
  mode: "sim",              // "sim" = simulated LLM (active). "live" is reserved for a future real LLM.
  economy: {
    initialTokens: 100,
    directCost: 16,         // fixed cost of a DIRECT consultation
    socraticCost: 8         // fixed cost of a SOCRATIC consultation
  }
};
```