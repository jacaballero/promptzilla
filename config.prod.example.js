"use strict";

// Production config for the Dockerized deployment. Copy this file to config.js
// (which is mounted into the container as a read-only volume) and adjust the
// model to whatever the target Ollama serves.
//
// The endpoint is RELATIVE ("/api/generate"): the browser calls the container,
// and Caddy proxies it to the real Ollama (see OLLAMA_UPSTREAM in
// docker-compose.yml). Same origin => no CORS, no mixed-content, HTTP or HTTPS.
window.APP_CONFIG = {
  llm: {
    endpoint: "/api/generate",
    model: "qwen3:4b",
    think: null,
    maxTokens: 1024,
    maxConcurrent: 8
  }
};
