# Trader OS v2.3 Architecture

```text
Browser / PWA
  ├─ Hebrew Dashboard
  ├─ Opportunities + ranking state
  ├─ Trade Room
  ├─ Watchlist / Alerts / Journal / Learning
  └─ Strategy Console
          │
          ▼
Node 22 server
  ├─ Market-data router
  │   ├─ Finnhub: quotes/status/news/earnings
  │   └─ Twelve Data: movers + 5m/daily OHLCV
  ├─ Scanner single-flight coordinator
  ├─ Analytics
  │   ├─ session VWAP
  │   ├─ time-of-day RVOL
  │   ├─ true MTF
  │   └─ structural levels
  ├─ Unified Pre-Trade Gate
  ├─ Strategy / catalyst / event engine
  ├─ Portfolio risk / correlation
  ├─ Trade lifecycle + Trade Manager
  ├─ Background automation / triggers
  ├─ Decision journal / Shadow book / Learning
  ├─ Alerts
  ├─ Broker staging
  └─ Storage
      ├─ SQLite/WAL default
      └─ atomic JSON fallback / import
```

## Scan lifecycle

1. Build universe from priorities + dynamic movers + static liquid symbols.
2. Pull broad quotes concurrently with a hard universe/concurrency cap.
3. Rank discovery candidates locally.
4. Deep-analyze only the quota-safe top candidates.
5. Pull deep 5m data and separate daily history.
6. Calculate true MTF, session VWAP, time-of-day RVOL and structural levels.
7. Add market/sector/RS/playbook context.
8. For executable ranking, add news/catalyst/events and portfolio capacity.
9. Pass through one Pre-Trade Gate.
10. Persist ranking metadata with a scan ID for diagnostics.

## Concurrency controls

- Scan single-flight: concurrent callers share the same active scan.
- Ranking single-flight: repeated ranking clicks share the same active ranking.
- Caches are separated by data type; daily bars live much longer than intraday bars.
- The UI blocks duplicate clicks and shows elapsed loading time.

## Trade safety

- PLANNED != broker fill.
- Fill must be recorded explicitly.
- Stop widening is blocked unless a future privileged flow explicitly opts in.
- Trailing modes generate suggestions, not autonomous broker mutations.
- Partial exits and final close are retained in the timeline and realized-R calculation.
