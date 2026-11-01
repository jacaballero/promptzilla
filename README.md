# Promptzilla
Serious game to raise awareness about the (ab)use of GenAI in Higher Education.

## Run

The game is always served by Docker (see [Deploying with Docker](#deploying-with-docker)):
it needs the same-origin proxy for the LLM and the xAPI log.

For development, add `COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml` to
your `.env`: the project folder is then mounted into the container, so edits
show up on reload without rebuilding the image.

```bash
docker compose up -d      # http://localhost:8080
```

## Tools

Helper scripts (not part of the game image):

- `tools/llm/load_test.py` — concurrent load test against the LLM with the game's
  own config; by default through the local proxy (`LOAD_TEST_BASE_URL` to change it).
- `tools/art/remove_bg.py` — removes the baked-in light background from character PNGs.
- `tools/art/make_foreground.py` — cuts a scene's foreground layer (props drawn over the player).
- `tools/art/slice_walk_sheet.py` — slices the player walk sheet into aligned frames.
- `tools/art/equalize_frames.py`, `tools/art/match_frames.py` — match colour and
  exposure across animation frames so loops don't flicker.

## Configuration

These files drive the game so you can change content and behaviour without
touching the engine code:

- `content.json` — **the questions and answers** (this is what a teacher edits).
- `scenes.json` — scenes, hotspots and characters (positions, walkable areas).
- `dialogues.data.js` — dialogue trees (JS because they contain game logic).
- `i18n/<lang>.json` — every text of the interface, scenes and dialogues.
- `profanity.json` — words blocked in prompts.
- `config.default.js` — app configuration (token economy + LLM connection). It
  is the committed template with safe defaults.
- `config.js` *(optional, git-ignored)* — a local override. Create it next to
  `config.default.js` to change any value locally without editing the template.

### Changing the questions

Edit `content.json`. Each challenge is an object inside `challenges`; texts
are given per language:

```json
{
  "challenges": [
    {
      "id": 1,
      "number": "1",
      "title": { "es": "Etiquetas de encabezado", "en": "Heading tags" },
      "question": { "es": "¿Qué etiqueta…?", "en": "Which tag…?" },
      "options": [
        { "label": "A", "text": "<code>&lt;title&gt;</code>" },
        { "label": "B", "text": "<code>&lt;h1&gt;</code>" }
      ],
      "correct": 1
    }
  ]
}
```

Notes:

- `title`, `question` and `options[].text` accept a plain string (same in all
  languages) or `{ "es": "…", "en": "…" }`. `question` and options accept HTML
  (use `&lt;` / `&gt;` to display literal `<` `>`).
- `correct` is a **0-based** index. For questions with several right answers use
  an array, e.g. `"correct": [0, 2]` (the game infers a multiple-choice question).

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

## Languages

The game is available in Spanish and English. The language is chosen in this
order: `?lang=es|en` in the URL, the last choice made with the ES/EN buttons on
the start screen (saved in the browser), the browser languages, and Spanish as
the fallback.

- Texts of the interface, scenes and dialogues live in `i18n/es.json` and
  `i18n/en.json`, one key per text: `scene.<scene>.<hotspot>`,
  `character.<id>`, `dlg.<dialogue>.<node>` (what the character says),
  `dlg.<dialogue>.<node>.<option>` (each option, by its `id` in
  `dialogues.data.js`). Keys ending in `.one`/`.other` (and `.zero`) are plural forms.
- Challenges keep their texts in `content.json` as `{ "es": "…", "en": "…" }`.
- LLM prompts in the config may contain `{language}`, replaced by the game
  language ("Spanish"/"English"), or be `{ es: "…", en: "…" }`. Keep this in
  mind if your `config.js` overrides `system`, `modeInstructions`,
  `brevitySuffix` or the evaluation prompts.
- xAPI statements always carry names in both languages and the game language in
  `context.language`. The exporter writes the activity labels in both languages
  for every game, so DFGs can be drawn in either (`dfg --lang`); `dfg
  --game-lang` keeps only games played in one language.

To add a language: create `i18n/<code>.json`, add `<code>` to `i18n.languages`
in the config, and add the `<code>` field to the challenges in `content.json`.

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
docker compose run --rm analytics [--group 1A] [--since 2026-10-01] [--lang en]
# → analytics/out/events.csv and analytics/out/events.xes
```

The first run builds the image. On Linux, set `ANALYTICS_UID`/`ANALYTICS_GID`
in `.env` to your `id -u`/`id -g` if they are not 1000 so the output files are
yours.

Basic process mining: frequency and performance directly-follows graphs from a
log in `analytics/out/` (`events.xes` by default, `.csv` also accepted):

```bash
docker compose run --rm dfg [--input events.csv] [--activity coarse] [--lang en] \
  [--game-lang es] [--aggregation median] [--format svg]
# → analytics/out/events_<activity>_<lang>_dfg_frequency.png and …_dfg_performance.png
```

The log has `activity_fine_es/en` (verb + object, e.g. a specific challenge)
and `activity_coarse_es/en` (verb + type) for every game, whatever language it
was played in; `concept:name`/`activity_coarse` repeat the exporter's `--lang`.
Games played with `?debug` are skipped unless `--include-debug` is given.