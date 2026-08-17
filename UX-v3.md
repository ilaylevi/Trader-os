# Trader OS v3 — UX principles

## Three-second rule
Every primary screen should answer quickly:
1. What is happening?
2. Why does it matter?
3. What should I do next?

## Navigation
The sidebar is grouped into:
- **מסחר עכשיו** — Dashboard, Opportunities, Trades, Watchlist
- **מחקר והחלטה** — Market, Research/Data, Portfolio
- **מעקב ולמידה** — Decision Lab, Journal
- **מערכת** — Alerts, IBI, Trader Expert, Rules

## Decision Dossier
An opportunity opens a single decision dossier containing:
- Judge verdict
- calibrated probability and validity window
- data confidence
- historical Expected R / analog sample
- Bull Case
- Devil's Advocate
- Why Now
- What Changes My Mind
- expert committee
- contradictions
- ranking stability
- short/halt/options context
- stress scenarios
- evidence and raw gates only in advanced details

## Loading / empty / error states
- Normal GET navigation uses local skeletons where possible.
- Heavy actions use a clear blocking progress state.
- Errors are written in natural Hebrew and retain the last valid state where safe.
- Empty screens provide a next action rather than only “no data”.

## Safety language
The UI distinguishes:
- live vs fresh vs stale price
- tracker close vs verified broker fill
- official vs provider vs locally-derived data
- temporary ranking vs completed full-market discovery
- low confidence vs missing data vs true rejection
