# Migration: Trader OS v2.0 → v2.1 Adaptive Expert

No new API keys are required. Keep the existing `.env` with Finnhub/Twelve Data, account risk, automation, alerts and broker settings.

## Preserve state
Do **not** use `docker compose down -v`; the `-v` flag removes the persistent Trader OS data volume.

Recommended migration:

```bash
cp .env ../trader-os.env
docker compose down
cd ..
mv trader-os trader-os-v2.0-backup
unzip trader-os-docker-v2.1.0-adaptive-expert.zip
cp trader-os.env trader-os/.env
cd trader-os
docker compose build --no-cache
docker compose up -d
```

Then verify:

```bash
curl http://localhost:8787/health
```

Expected version: `2.1.0`, engine `DETERMINISTIC`, `externalAi: false`, `modelCostUsd: 0`.

## Data compatibility
v2.1 reuses the same persistent files for trades, watchlist, ledger, alerts, decision journal and shadow trades. Adaptive learning reads completed historical data but does not rewrite past outcomes.
