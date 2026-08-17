# Trader OS v2.4.0 — Scanner + Live Trading

### Added
- Full-US rotating discovery catalog via Finnhub supported symbols.
- Persistent scanner cursor and daily coverage statistics.
- Deep-analysis exploration slots.
- Live-price service using one server-side Finnhub WebSocket.
- Live/Fresh/Stale price freshness model.
- Manual LONG/SHORT trade creation and risk preview.
- Automatic TP1/TP2/Stop level monitor for recorded trades.
- Automatic local tracker close for Stop/TP2 with explicit broker-unverified provenance.
- Broker exit confirmation flow for tracker-closed trades.
- 20-day average dollar-volume liquidity gate.
- Trade-history table in the Trades tab.

### Fixed
- Repeated-opportunity behavior caused by a mostly static universe.
- Manual ranking button ambiguity: cooldown/reuse is now explicit.
- Read-only dashboard loads consuming unnecessary full scans.
- Twelve Data premium Market Movers attempts are now opt-in.
- Scanner cursor no longer resets to the beginning of the catalog every day.
- TP2 gap events now preserve TP1 hit history when appropriate.
- REST prices no longer masquerade as WebSocket-live ticks.
- Open-trade level monitoring can remain active when background scanning is paused.
- Unverified tracker exits no longer contaminate adaptive learning.
- Missing Hebrew labels for newer Pre-Trade Gates.

### Validation
- Strict TypeScript check: shared + server core + HTTP/MCP entrypoint (MCP declarations stubbed locally because registry install was unavailable).
- 33 TypeScript/TSX files transpile-syntax checked.
- UI JavaScript and service worker syntax checked.
- 17/17 deterministic trading tests passed.
