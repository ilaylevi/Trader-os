# Migration — v2.4 → v2.5

Do **not** delete the Docker volume. Existing trades, journal, watchlist and SQLite data are preserved.

## New recommended environment values

```env
FULL_MARKET_SWEEP_ENABLED=true
FULL_MARKET_SWEEP_BATCH_SIZE=12
FULL_MARKET_SWEEP_CONCURRENCY=2
FULL_MARKET_SWEEP_TICK_SECONDS=15
FULL_MARKET_SWEEP_REPEAT_MINUTES=30
FULL_MARKET_TOP_CACHE_SIZE=300
FULL_MARKET_EXCLUDE_OTC=true
FULL_MARKET_FINALIST_DEEP_SLOTS=1
FULL_MARKET_DEEP_FINALIST_POOL=60

MIN_OPPORTUNITY_SCORE=6.5
MIN_OPPORTUNITY_DATA_QUALITY=75
MIN_OPPORTUNITY_RR=2
```

The conservative default sweep rate is intentionally chosen to reduce rate-limit failures. If your Finnhub plan supports a higher sustained request rate, the sweep batch/tick values may be tuned upward carefully.

## Upgrade

```bash
cp .env ../trader-os.env
docker compose down
cd ..
mv trader-os trader-os-v2.4-backup
unzip trader-os-docker-v2.5.0-full-market-quality.zip
cp trader-os.env trader-os/.env
cd trader-os
```

Append the new variables above, then:

```bash
docker compose build --no-cache
docker compose up -d
curl http://localhost:8787/health
```

Expected version: `2.5.0`.

Never use `docker compose down -v` for a normal upgrade.
