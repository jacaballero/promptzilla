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
    initialTokens: 150,     // starting tokens
    directFactor: 2,        // cost multiplier for DIRECT consultations
    socraticFactor: 1       // cost multiplier for SOCRATIC consultations
  },
  llm: {
    provider: "ollama",     // "ollama" | "openai"
    endpoint: "http://localhost:11434/api/generate",
    model: "qwen3:4b"       // any model available on your Ollama server
  }
};
```

Two backends are supported via `provider`:

- `"ollama"` — Ollama `/api/generate` (NDJSON streaming).
- `"openai"` — any OpenAI-compatible API such as **vLLM** `/v1/chat/completions`
  (SSE streaming). Example:

```js
window.APP_CONFIG = {
  llm: {
    provider: "openai",
    endpoint: "/v1/chat/completions",   // relative → proxied by Caddy
    model: "google/gemma-4-12B-it"
  }
};
```

## Deploying with Docker

The game is fully static, but browsers can't call an external LLM directly
(CORS and, under HTTPS, mixed-content). The container solves this by serving the
game **and** reverse-proxying the API path to the backend with **Caddy**, so the
browser only ever talks to the same origin. One backend is active per deployment
(chosen in `config.js`), so both paths share a single upstream:

- `/api/*` → Ollama.
- `/v1/*` → OpenAI-compatible backend such as vLLM.

```
                 ┌──────────── container (Caddy) ─────────────┐
 Browser ──────► │  /                    → static files       │
 (same origin)   │  /api/generate        → proxy ┐            │
                 │  /v1/chat/completions → proxy ─┴→ LLM_UPSTREAM ──► your backend
                 └────────────────────────────────────────────┘
```

Because of this, the production `config.js` uses a **relative** endpoint
(`/api/generate` or `/v1/chat/completions`): no CORS, no mixed-content, works
over HTTP or HTTPS.

### Files

- `Dockerfile` — bakes the static game into a `caddy:2-alpine` image.
- `Caddyfile` — serves `/srv` and proxies `/api/*` and `/v1/*` to
  `{$LLM_UPSTREAM}`.
- `docker-compose.yml` — one `web` service on port `8080`, reads `LLM_UPSTREAM`
  from `.env`, and mounts `config.js` as a read-only volume.
- `.env.example` / `config.prod.example.js` — templates to copy.

### Steps

```bash
# 1. Point the proxy to your backend (host:port). .env is git-ignored.
cp .env.example .env
#    edit .env → LLM_UPSTREAM=your-ollama-host:11434   (provider "ollama")
#             or LLM_UPSTREAM=your-vllm-host:8002       (provider "openai")

# 2. Production config with the relative endpoint. config.js is git-ignored.
cp config.prod.example.js config.js
#    pick provider (openai/ollama) and adjust "model" if needed

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

# Ollama backend (provider "ollama")
curl -N -X POST http://localhost:8080/api/generate \
  -d '{"model":"qwen3:4b","prompt":"hola","stream":true,"think":false}'  # → streaming NDJSON

# vLLM backend (provider "openai")
curl -N -X POST http://localhost:8080/v1/chat/completions \
  -d '{"model":"google/gemma-4-12B-it","messages":[{"role":"user","content":"hola"}],"stream":true}'  # → streaming SSE
```

The container must be able to reach the backend host set in `LLM_UPSTREAM`
(e.g. be on the same internal network / VPN); otherwise the proxied path
returns `502`.

### LLM on the same host (Linux)

If the LLM backend runs on the same machine as the container, uncomment
`extra_hosts` in `docker-compose.yml` and set
`LLM_UPSTREAM=host.docker.internal:11434` (or the vLLM port).

### Public HTTPS (optional)

With a public domain and ports 80/443 open, replace `:80` with your domain in
the `Caddyfile` and Caddy provisions TLS certificates automatically. On an
internal network without a public domain, plain HTTP is enough.

### Portability

To deploy elsewhere (another server or university), just change
`LLM_UPSTREAM` in `.env` and, if needed, `model` in `config.js`. Nothing else.

## Interaction logging (xAPI) and process mining

With `xapi.enabled: true` (default in `config.prod.example.js`, off in
`config.default.js`) the game sends anonymous xAPI statements for every
relevant action (scenes, hotspots, characters, dialogue options, challenges,
AI consultations, prompt-evaluation metadata, game start/end/abandon). Each game
gets a fresh random actor and registration (the process-mining case id); no
prompt or answer text is stored. Add `?group=<name>` to the game URL to tag a
class/group. Vocabulary: xAPI Serious Games Profile + ADL verbs.

Compose runs a **SQL LRS** (`lrs`) backed by **Postgres** (`db`). The browser
only POSTs to `/xapi/statements` on the game origin; Caddy forwards it to the
LRS adding the credentials (any other `/xapi/*` request gets `404`).

1. Fill the `LRS_*` variables in `.env` (see `.env.example`). `LRS_BASIC_AUTH`
   must be `printf 'LRS_API_KEY:LRS_API_SECRET' | base64`. Admin user and API
   credentials are seeded on the first start.
2. `docker compose up --build -d`.
3. LRS admin UI: `http://<host>:${LRS_PORT}/admin` (default `8081`).
   Postgres listens on `${LRS_DB_BIND}:${LRS_DB_PORT}` (default `127.0.0.1:5433`).

Export an event log (CSV for Disco, XES for ProM / PM4Py). The exporter always
runs in its own container (pinned Python + pm4py) and talks to the LRS over the
internal Docker network with the credentials from `.env`:

```bash
docker compose run --rm analytics [--group 1A] [--since 2026-10-01]
# → analytics/out/events.csv and analytics/out/events.xes
```

The first run builds the image. On Linux, set `ANALYTICS_UID`/`ANALYTICS_GID`
in `.env` to your `id -u`/`id -g` if they are not 1000 so the output files are
yours.

Basic process mining: frequency and performance directly-follows graphs from a
log in `analytics/out/` (`events.xes` by default, `.csv` also accepted):

```bash
docker compose run --rm dfg [--input events.csv] [--activity activity_coarse] \
  [--aggregation median] [--format svg]
# → analytics/out/events_dfg_frequency.png and events_dfg_performance.png
```

`concept:name` is the fine-grained activity (verb + object, e.g. a specific
challenge) and `activity_coarse` the coarse one (verb + type). Games played with
`?debug` are skipped unless `--include-debug` is given.