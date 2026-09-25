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

## Deploying with Docker

The game is fully static, but browsers can't call an external Ollama directly
(CORS and, under HTTPS, mixed-content). The container solves this by serving the
game **and** reverse-proxying `/api/*` to Ollama with **Caddy**, so the browser
only ever talks to the same origin.

```
                 ┌──────────── container (Caddy) ─────────────┐
 Browser ──────► │  /             → static files (the game)   │
 (same origin)   │  /api/generate → reverse_proxy → Ollama ───┼──► your Ollama
                 └────────────────────────────────────────────┘
```

Because of this, the production `config.js` uses a **relative** endpoint
(`/api/generate`): no CORS, no mixed-content, works over HTTP or HTTPS.

### Files

- `Dockerfile` — bakes the static game into a `caddy:2-alpine` image.
- `Caddyfile` — serves `/srv` and proxies `/api/*` to `{$OLLAMA_UPSTREAM}`.
- `docker-compose.yml` — one `web` service on port `8080`, reads `OLLAMA_UPSTREAM`
  from `.env`, and mounts `config.js` as a read-only volume.
- `.env.example` / `config.prod.example.js` — templates to copy.

### Steps

```bash
# 1. Point the proxy to your Ollama (host:port). .env is git-ignored.
cp .env.example .env
#    edit .env → OLLAMA_UPSTREAM=your-ollama-host:11434

# 2. Production config with the relative endpoint. config.js is git-ignored.
cp config.prod.example.js config.js
#    adjust "model" if needed

# 3. Build and run
docker compose up --build -d
```

Open **http://localhost:8080**. Change the host port in `docker-compose.yml`
if `8080` is taken. Stop with `docker compose down`; view logs with
`docker compose logs -f web`. After editing static files, rebuild with
`docker compose up --build`; changes to `config.js` (mounted volume) don't need
a rebuild.

### Verify

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/        # → 200
curl -N -X POST http://localhost:8080/api/generate \
  -d '{"model":"qwen3:4b","prompt":"hola","stream":true,"think":false}'  # → streaming NDJSON
```

The container must be able to reach the Ollama host set in `OLLAMA_UPSTREAM`
(e.g. be on the same internal network / VPN); otherwise `/api/*` returns `502`.

### Ollama on the same host (Linux)

If Ollama runs on the same machine as the container, uncomment `extra_hosts`
in `docker-compose.yml` and set `OLLAMA_UPSTREAM=host.docker.internal:11434`.

### Public HTTPS (optional)

With a public domain and ports 80/443 open, replace `:80` with your domain in
the `Caddyfile` and Caddy provisions TLS certificates automatically. On an
internal network without a public domain, plain HTTP is enough.

### Portability

To deploy elsewhere (another server or university), just change
`OLLAMA_UPSTREAM` in `.env` and, if needed, `model` in `config.js`. Nothing else.