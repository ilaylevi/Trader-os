#!/bin/sh
set -eu
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
  echo "Fill FINNHUB_API_KEY, TWELVE_DATA_API_KEY and APP_ACCESS_TOKEN, then rerun if needed."
fi
docker compose up -d --build
printf '\nTrader OS Zero-AI v2: http://localhost:8787\nHealth:                http://localhost:8787/health\nStrategy Console:      open the Trader Expert tab\n\n'
docker compose ps
