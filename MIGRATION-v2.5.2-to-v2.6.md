# Migration v2.5.2 → v2.6.0

No destructive storage migration is required. Keep the existing Docker volume and `.env`.

Optional but strongly recommended free configuration:

```env
ALPACA_API_KEY_ID=
ALPACA_API_SECRET_KEY=
ALPACA_DATA_FEED=iex
SEC_USER_AGENT=TraderOS your-email@example.com
FRED_API_KEY=
MIN_DATA_CONFIDENCE_SCORE=70
MAX_EXECUTION_SPREAD_PCT=0.8
HISTORICAL_WAREHOUSE_ENABLED=true
HISTORY_SYNC_YEARS=5
FULL_MARKET_SWEEP_BATCH_SIZE=150
```

Without Alpaca keys, Trader OS continues to work with Finnhub/Twelve Data; SEC intelligence still works without an API key. The large full-market batch automatically falls back to a smaller per-symbol batch when no batch loader is available.

Do **not** run `docker compose down -v` during migration.
