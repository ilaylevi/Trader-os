# Trader OS v2 Architecture

```text
Market data
  ├─ Finnhub quotes / status / earnings / headlines
  └─ Twelve Data OHLCV
          ↓
Broad Discovery Scanner
          ↓
Top Shortlist
          ↓
Technical Engine
SMA / RSI / ATR / RVOL / VWAP / levels / MTF
          ↓
Context Engine
Market regime / breadth / sector / event calendar / headline risk
          ↓
Risk Engine
Data quality / no chase / R:R / portfolio capacity / correlation
          ↓
Deterministic Strategy Engine
READY / ARMED / WATCH / REJECT
          ↓
Triggers / Alerts / Watchlist / Shadow / Journal / Trades
          ↓
Strategy Console + Dashboard
```

No generative-model network path exists in v2.
