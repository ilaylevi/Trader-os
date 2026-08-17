# Trader OS v2.4 Architecture

## Discovery
Finnhub US symbol catalog → persistent rotating scanner cursor → must-watch symbols + rotating batch → quote discovery score → protected exploration slot → deep Twelve Data OHLCV → unified Pre-Trade Gate.

The scanner does **not** claim to quote every US stock simultaneously. It progressively covers the catalog while always refreshing active trades, watchlist symbols, priorities and recent leaders.

## Live price plane
A single server-side Finnhub WebSocket owns subscriptions. The browser polls Trader OS locally for the latest cached points every ~2 seconds, so the Finnhub key never enters browser JavaScript. REST quotes may seed a symbol but are labeled `FRESH`, never `LIVE`.

## Trade state plane
Manual or scanner-created trades share the same portfolio state. Recorded trades can be watched by the live level monitor. TP1 is marked; Stop/TP2 can close the local tracker. Automatic tracker exits are stored with `brokerExecutionConfirmed=false` until the user enters the real broker exit price.

## Learning boundary
Shadow trades remain weighted evidence. Real closed trades are stronger evidence. Tracker-level exits that are still unverified are excluded from adaptive learning and coaching metrics until broker execution is confirmed.

## Safety
No live IBI order execution is performed. Staged IBI instructions remain manual. Risk widening is blocked by default.
