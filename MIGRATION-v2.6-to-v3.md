# Migration — v2.6 → v3.0

The migration preserves the existing Docker volume and `.env`.

## Do not delete the volume
Never use:
```bash
docker compose down -v
```

## New optional/default environment settings
```env
FINRA_API_BASE_URL=https://api.finra.org
FINRA_CACHE_MS=1800000
SEC_FTD_CACHE_MS=86400000
NASDAQ_HALT_CACHE_MS=60000
FREE_CONTEXT_TIMEOUT_MS=10000

THESIS_MONITOR_BACKGROUND_ENABLED=true
THESIS_MONITOR_INTERVAL_MINUTES=15
SHADOW_AB_ENABLED=true
DECISION_VALIDITY_MINUTES=5
```

No paid API is required for these v3 additions. Existing SEC/Alpaca/FRED configuration from v2.6 remains valid.

## Upgrade
```bash
cp .env ../trader-os.env
docker compose down
cd ..
mv trader-os trader-os-v2.6-backup
unzip trader-os-docker-v3.0.0-evidence-driven.zip
cp trader-os.env trader-os/.env
cd trader-os
docker compose build --no-cache
docker compose up -d
curl http://localhost:8787/health
```

After upgrading, hard-refresh the browser once to replace the old PWA shell.
