FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOME=/tmp

# Graphviz renders the DFG images; Node runs the game's xapi.js to name activities.
RUN apt-get update && apt-get install -y --no-install-recommends graphviz nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY xapi_to_pm.py dfg.py catalog.js run-as-out-owner.sh ./
RUN chmod +x /app/run-as-out-owner.sh

ENTRYPOINT ["/app/run-as-out-owner.sh", "python", "/app/xapi_to_pm.py"]
