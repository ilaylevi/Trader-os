# Trader OS v2.5.2 — Tab-by-tab UX audit

## סקירה
One source of truth for quality-gated opportunities; explicit quick/full/refresh actions; health and attention strip.

## הזדמנויות
Separates full-catalog discovery progress from deep OHLCV validation and rejected candidates.

## עסקאות
Urgent positions float upward. Trade actions use in-app Hebrew forms. Broker execution remains explicitly unverified until confirmed.

## מעקב וטריגרים
Manual watchlist and custom trigger management added, including distance-to-trigger.

## שוק ואירועים
Clarifies that scanner breadth is a sample rather than official exchange breadth; events are marked when relevant to open/watch symbols.

## סיכון התיק
Shows per-trade risk, factors, correlations and explicit unknown classifications.

## יומן החלטות
Coach recommendations and Shadow Trades are visible without browser alerts.

## התראות ואוטומציה
Unread filtering, read-all, channel status and rich Hebrew alert detail.

## פקודות IBI
Shows quantity, order type, actionable price and reconciliation state; staging still does not transmit orders.

## הסוחר שלי
Uses the same strategy ranking/check-entry engine as the opportunities view and supports dotted tickers such as BRK.B.

## חוקת המסחר
Displays current risk and opportunity-quality settings from runtime configuration.

## מעבדת למידה
Separates real/shadow evidence and clearly marks when the sample is too small to affect scores.

## Known limitations
- Deep OHLCV analysis is quota-aware and therefore not run on every US symbol simultaneously.
- Some newly discovered symbols may have no verified sector mapping; they are explicitly shown as unclassified.
- No live IBI execution sync; tracker closures are not broker fills until confirmed.
