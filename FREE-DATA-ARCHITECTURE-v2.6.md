# Trader OS v2.6 — Free-Data Intelligence

## Goal
Increase analysis quality and information reliability without any paid AI or mandatory paid market-data plan.

## Free source hierarchy
1. **Finnhub (existing)** — live quote/status/news and server WebSocket where entitlement allows.
2. **Twelve Data (existing Basic)** — deep OHLCV for finalists, quota-aware.
3. **Alpaca Basic (optional/free)** — IEX multi-symbol snapshots, bid/ask proxy and historical bars. It is explicitly not treated as full SIP/NBBO truth.
4. **SEC EDGAR (official/free/no API key)** — ticker/CIK/exchange identity, submissions, filings and XBRL company facts.
5. **BLS/Federal Reserve calendars (official/free)** — high-impact release scheduling.
6. **FRED (optional/free key)** — VIX, 10Y yield, broad dollar index and Fed Funds context.
7. **Local SQLite warehouse** — stores bars and provenance so analysis becomes less dependent on fresh API calls.

## Reliability policy
- Each trade can carry a Data Confidence score.
- Large cross-provider price disagreement blocks execution.
- Wide IEX spread can block execution when Alpaca is configured.
- A critical SEC filing risk can block a new entry.
- Missing verification is displayed as missing; the engine does not invent data.

## Analysis upgrades
- SEC-backed dynamic sector/industry classification.
- Multi-window relative strength (1d/5d/20d) vs SPY and sector ETF when historical bars exist.
- Previous-day, weekly, monthly, opening-range, Anchored VWAP and volume-profile reference levels.
- Parallel playbook scanners instead of one universal score.
- Daily historical backtesting with chronological 70/30 walk-forward split.

## Important limitations
Free data is intentionally heterogeneous. Alpaca Basic uses IEX, not consolidated SIP/NBBO. Full-market discovery can be accelerated with batch snapshots, but deep OHLCV remains finalist-based to respect free quotas. SEC/FRED are not tick-by-tick market feeds.
