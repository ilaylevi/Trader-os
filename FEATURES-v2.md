# Trader OS v2 Feature Matrix

| Feature | v2 |
|---|---|
| External generative AI | Removed |
| Model/API token cost | $0 |
| Broad two-stage scan | Yes |
| OHLCV validation | Yes |
| Market regime/breadth | Yes |
| Sector alignment | Yes |
| Multi-timeframe | Yes |
| Playbook classifier | Yes |
| Deterministic headline classifier | Yes |
| Earnings event lock | Yes |
| Manual macro-event lock | Yes |
| High-conviction ranking | Deterministic |
| Strategy Console | Deterministic |
| Background scanner | Yes |
| Trigger engine | Yes |
| Alerts | Yes |
| Watchlist automation | Yes |
| Open trades / Trade Room | Yes |
| Position sizing | Yes |
| Portfolio correlation/factors | Yes |
| Decision journal | Yes |
| Shadow trading | Yes |
| Trading Coach | Deterministic |
| IBI order staging | Yes |
| Real broker execution | No |

## v2.1 Adaptive Expert additions
- Relative-strength scoring versus broad-market benchmarks and the mapped sector ETF.
- Abnormal-volume detection using relative volume and a rolling volume z-score.
- ATR-normalized price-expansion detection to reward healthy momentum and penalize extreme extension.
- Richer market-regime score with explicit reasons and breadth-thrust / weak-breadth diagnostics.
- New deterministic playbooks: Relative Strength Breakout, Trend Reclaim, Volatility Squeeze.
- Catalyst score combining classified headlines, gap/volume behavior, playbook and event-risk locks.
- Adaptive playbook learning from completed Shadow Trades and closed trades. Positive adjustments are capped at +0.35 score; negative adjustments are capped at -0.75 and require at least five completed samples.
- Learning Lab UI and API endpoint `/api/learning`.
- Expanded self-explaining navigation and descriptive tab headers.
