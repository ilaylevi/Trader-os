# Trader OS v2.4 — Feature Matrix

## Discovery and analysis
- Finnhub US supported-symbol catalog
- Rotating discovery batches with persistent cursor
- Static priority + active trades + watchlist + recent leaders always retained
- Optional Twelve Data Market Movers only when explicitly enabled
- Exploration slot for fresh symbols
- Quote-budget and scan cooldown protection
- True intraday + daily OHLCV analysis
- 5m / 15m / 1h / 1d alignment
- Session VWAP
- Time-of-day RVOL with rolling fallback
- Volume Z-score
- ATR expansion / No-Chase
- Structural stop and structural targets
- 20-day average dollar-volume liquidity gate
- Market regime, scanner breadth, sector alignment and relative strength
- Deterministic news/catalyst and event-risk gates
- Unified Pre-Trade Gate

## Live trading state
- Finnhub WebSocket held on the server
- Live/Fresh/Stale price labels
- Live prices in opportunities, watchlist and open trades
- Current/MFE/MAE persistence for open trades
- LONG and SHORT level monitoring
- TP1 detection
- TP2 detection
- Stop detection
- Optional automatic local tracker close at TP2/Stop
- Explicit unverified-broker state for automatic closes
- Manual broker-fill confirmation and P&L/R correction

## Trade management
- Manual trade creation independent of scanner
- Planned vs recorded trade state
- Position sizing from risk budget
- Partial exits
- Break-even
- Stop tightening with widening protection
- ATR / structure trailing suggestions
- Thesis state and timeline notes
- IBI staged-order instructions
- Recent trade history and broker verification status

## Automation and learning
- Background scanner
- Trigger engine
- Live trade monitoring separated from scanner pause state
- Alerts / Telegram / webhook
- Shadow trading
- Decision journal
- Adaptive deterministic playbook learning
- Unverified automatic tracker exits excluded from real-trade learning

## Cost
- OpenAI / external model calls: none
- Model cost: $0
