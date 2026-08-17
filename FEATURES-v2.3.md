# Trader OS v2.3 — Feature Matrix

| Area | Status | Notes |
|---|---|---|
| External generative AI | Removed | No OpenAI/GPT/model runtime calls |
| Broad market discovery | Yes | Static universe + dynamic movers, quota-aware |
| Fresh quote scan | Yes | Single-flight prevents duplicate concurrent scans |
| True 5m / 15m / 1h / 1d analysis | Yes | Daily series fetched independently |
| Session VWAP | Yes | Regular session only |
| Time-of-day RVOL | Yes | Falls back to rolling RVOL if history is insufficient |
| Incomplete-bar filtering | Yes | Current unfinished 5m candle excluded |
| Structural stop | Yes | Structure/support + ATR validation |
| Structural targets / resistance room | Yes | Blocks if there is insufficient room before resistance |
| Unified Pre-Trade Gate | Yes | Scan, rank, entry check, background automation |
| Market regime | Yes | Benchmark/breadth based; breadth explicitly refers to scanned universe |
| Relative strength | Yes | Market + mapped sector |
| Playbooks | Yes | Breakout, pullback, RS breakout, trend reclaim, squeeze, etc. |
| News/headline classifier | Yes | Deterministic Finnhub headline classifier |
| Earnings lock | Yes | Finnhub earnings calendar |
| Macro calendar | Yes, best effort | Official BLS/Fed parser + cache + manual fallback |
| Portfolio capacity gate | Yes | Overall risk + same-sector limit + duplicate symbol |
| Background scanner | Yes | Honors AUTOMATION_ENABLED |
| Trigger engine | Yes | Entry/Stop/TP monitoring |
| Alerts | Yes | In-app + Telegram/Webhook optional |
| Remote browser Web Push | No | Requires push infrastructure |
| Open trades / Trade Room | Yes | Rich lifecycle and management actions |
| Partial exits | Yes | Weighted realized P&L/R |
| Break-even | Yes | Explicit user action |
| Stop widening protection | Yes | Widening blocked by default |
| ATR / structure trailing | Suggested | Suggests tighter stop; never mutates autonomously |
| MFE / MAE | Yes | Trade management diagnostics |
| Shadow trading | Yes | TP1 partial + remainder to TP2/stop/expiry |
| Decision journal | Yes | Feeds adaptive statistics |
| Adaptive learning | Yes | Weighted real/shadow, recency, confidence bounds, conservative caps |
| SQLite persistence | Yes | WAL + JSON migration/fallback |
| IBI staged orders | Yes | No live execution |
| Live IBI sync/execution | No | Requires supported broker API/integration |
| Hebrew-first UI | Yes | Explanations, loading states, Trade Room |

## Explicit limitations

1. Dynamic movers depend on provider availability/quota; the static universe remains the fallback.
2. Official macro pages are parsed deterministically, so source HTML changes can temporarily break refresh; cached/manual events remain available.
3. “Market breadth” inside Trader OS is breadth of the scanned universe, not a full NYSE/Nasdaq advance-decline feed.
4. No automatic broker mutation is performed.
