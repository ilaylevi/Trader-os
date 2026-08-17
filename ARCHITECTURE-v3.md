# Trader OS v3 — Evidence-Driven Architecture

Trader OS v3 is a deterministic, zero-LLM trading decision system. The central design goal is not to maximize the number of signals, but to combine **independent evidence**, expose contradictions, measure uncertainty, and refuse a trade when the evidence is not strong enough.

## Decision pipeline

```text
Full Market Discovery
→ Data Validation / Source Authority
→ Market Regime + Intraday Market Phase
→ Sector + Peer / Residual Strength
→ Playbook-specific Technical Structure
→ Liquidity / Spread / Execution Reality
→ SEC / Catalyst / Corporate Actions
→ FINRA Short / SEC FTD / Reg SHO / Halt Guard
→ Options Indicative Context
→ Historical Analogs / Regime Performance
→ Probability Calibration
→ Bull Case + Devil's Advocate
→ Contradiction / Independent Evidence Check
→ Stress Test + Portfolio Opportunity Cost
→ Judge
→ ENTER / ARMED / WAIT / REJECT / UNCERTAIN
```

## After entry

```text
Live Price
→ Stop / TP Monitor
→ Thesis Monitor
→ Market / Sector / RS changes
→ Event / Halt checks
→ Partial exits / BE / Trailing suggestions
→ Local tracker close
→ Broker execution verification
→ Decision Replay / Journal
→ Learning / Calibration / Shadow A-B
```

## Source hierarchy

1. **OFFICIAL:** SEC, FINRA, Nasdaq Trader, BLS, Federal Reserve.
2. **MARKET PROVIDER:** Finnhub, Twelve Data, Alpaca/IEX.
3. **LOCAL_DERIVED:** Trader OS warehouse, calculated indicators, analogs, stress models.
4. **UNVERIFIED:** incomplete/unknown source data. It cannot silently overrule official data.

## Storage

SQLite/WAL remains the local source of truth where supported. Historical bars are accumulated in the local warehouse so backtests and analog matching become less dependent on repeated remote API calls.

## Important limitations

- Trader OS does **not** place real broker orders. IBI remains staged/read-only/manual reconciliation.
- Alpaca Basic uses IEX, not consolidated SIP/NBBO.
- Alpaca options `indicative` data is context only, not OPRA execution-quality truth.
- FINRA short interest and SEC FTD data are delayed publications, not real-time short positioning.
- Full-market discovery is not the same as full OHLCV deep analysis on every US stock; free data quotas require finalist-based deep analysis.
- Free-source outages or stale data intentionally lower confidence and may produce `UNCERTAIN`.
- Historical analogs/backtests are evidence, not guarantees of future performance.
