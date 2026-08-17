# Trader OS v2.3.1 — Stability + Trade Management

## Accuracy
- Replaced pseudo-daily aggregation with independently fetched daily bars.
- Deepened intraday history for credible 1h/15m context.
- Added current-incomplete-bar filtering.
- Added regular-session VWAP.
- Added time-of-day normalized RVOL with rolling fallback.
- Added structural stop and structural resistance/target logic.
- Added room-to-resistance gate.
- Added true-MTF quality gate.

## Decision consistency
- Added one unified Pre-Trade Gate across manual checks, ranking, find-trade and background automation.
- Portfolio capacity, same-sector exposure and duplicate-symbol checks are now part of execution readiness.
- News/catalyst/event checks are consistently applied before executable opportunity status.

## Discovery / reliability
- Added dynamic market movers with static-universe fallback.
- Added quota-aware deep-analysis cap.
- Added separate intraday/daily/movers caches.
- Added scan/ranking single-flight coordination.
- Fixed AUTOMATION_ENABLED=false startup behavior.
- Added scan IDs and diagnostics to ranking UI.

## Trade management
- Rebuilt Trade Room.
- Added partial exits, break-even, guarded stop updates, trailing modes, notes and thesis updates.
- Added ATR/structure trailing-stop suggestions.
- Added MFE/MAE, current R, remaining risk and distance-to-levels.
- Corrected realized R after partial exits using initial total risk.
- Improved Shadow Trading: 50% at TP1, remainder continues.

## Portfolio / learning
- Real trades and Shadow trades use different statistical weights.
- Added recency decay and Wilson-style confidence signal.
- Increased minimum raw sample threshold to 8.
- Positive adaptation remains capped at +0.35; negative cap remains -0.75.

## Calendar / storage
- Added deterministic official BLS/Federal Reserve macro refresh with cache/manual fallback.
- SQLite/WAL is now default persistence with automatic JSON import and JSON fallback.

## UX
- Added global Hebrew loading overlay, elapsed seconds, explicit timeout errors and operation-specific messages.
- Ranking button is guarded against duplicate clicks and sends the user directly to fresh results.
- Expanded Hebrew Trade Room and learning diagnostics.

## Still intentionally not included
- Live IBI execution/synchronization.
- Remote browser Web Push service.
