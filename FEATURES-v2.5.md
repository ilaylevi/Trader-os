# Trader OS v2.5 — Full Market + Quality Engine

## Core goals

v2.5 focuses on two problems discovered in real use:

1. The scanner could repeatedly surface the same volatile names instead of searching broadly enough.
2. Too many deeply analyzed names reached the Opportunities screen without a usable Entry / Stop / TP plan.

## Full-market progressive sweep

- Loads the supported US common-stock catalog from Finnhub.
- Excludes OTC/Pink Sheet securities, warrants, units, rights, preferred shares, ETNs, ETFs and funds from the stock-opportunity universe by default.
- Progressively checks every eligible symbol through the lightweight quote/discovery layer.
- Persists sweep progress, coverage percentage, failures, rate-limit pause state and the strongest candidates found so far.
- Never skips a symbol because of a rate-limit response: the cursor pauses and retries it later.
- Keeps the strongest candidates from the last completed sweep while the next sweep is in progress.
- Rotates full-market finalists through deep OHLCV analysis so the same three symbols do not monopolize every scan.

### Important quota reality

Full-market coverage means every eligible catalog symbol is passed through the lightweight discovery stage during a completed sweep. Deep OHLCV / multi-timeframe / news / risk validation is intentionally reserved for finalists because free Twelve Data quotas cannot economically run two OHLCV requests on thousands of symbols at once.

The UI explicitly shows whether the current full-market sweep is complete. Until coverage reaches 100%, a strategy ranking is labeled temporary.

## Opportunity Quality Floor

A stock no longer becomes an “opportunity” simply because it was selected for deep analysis.

By default it must have:

- Data quality >= 75%
- A recognized playbook
- Defined Entry, Stop, TP1 and TP2
- Usable structural/hybrid/fallback level quality
- R:R >= 1:2
- Setup score >= 6.5
- Enough liquidity
- No hard Pre-Trade Gate blocker

Rejected stocks remain available in a collapsed “נפסלו בסריקה” section for transparency but are not mixed with executable opportunities.

## Playbook-specific Trade Planner

Each playbook now builds levels differently instead of using one breakout formula for everything.

- Breakout / Relative Strength Breakout / Volatility Squeeze
- Momentum / Gap Continuation
- Pullback
- Support Bounce
- Trend Reclaim

Stops use structural candidates such as recent swing lows, support, session VWAP and SMA20 with a small ATR buffer. ATR-only fallback is allowed only for strong, liquid, high-quality setups and is clearly labeled as fallback.

Targets first inspect 1H/Daily overhead structure. A setup can be rejected when nearby resistance leaves insufficient reward room.

## Better scanner memory

- Rejected / level-less names no longer become recurring discovery leaders.
- Previous opportunities are only recycled when they still have usable levels and are not rejected.
- Full-market finalist rotation gives deeper analysis to more than the same top few symbols.

## Detailed Hebrew alerts

Alerts now explain:

- What happened
- Why it matters
- Relevant Entry / Stop / TP levels
- The setup context
- The next recommended action

This applies to entry triggers, armed setups, TP1, TP2, Stop hits and custom watch/trigger rules.

## Preserved v2.4 features

- Zero external AI / $0 model cost
- Finnhub live WebSocket prices
- Manual trade creation for any symbol
- Trade Room
- Stop/TP live tracker
- Broker-fill verification before real-trade learning
- Partial exits
- Break-even and trailing suggestions
- Portfolio risk gate
- Decision Journal
- Shadow Trading
- Adaptive Expert learning
- SQLite/WAL storage
- Hebrew-first UI
