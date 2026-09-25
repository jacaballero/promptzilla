# Promptzilla: static game served by Caddy, which also reverse-proxies /api/*
# to an external Ollama instance (same-origin -> no CORS, no mixed-content).
FROM caddy:2-alpine

# Static assets. config.js is excluded via .dockerignore and mounted as a
# volume at runtime so each deployment can point to its own LLM endpoint.
COPY . /srv

# Reverse-proxy + file server config.
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
