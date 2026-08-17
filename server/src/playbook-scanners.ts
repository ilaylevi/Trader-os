import type { MarketQuote, PlaybookId, TechnicalSnapshot } from "@trader-os/shared";

export interface PlaybookSignal {
  playbook: PlaybookId;
  score: number;
  label: string;
  reason: string;
}

function clamp(x: number) {
  return Math.max(0, Math.min(10, Number(x.toFixed(1))));
}

export function scorePlaybookSignals(q: MarketQuote, t?: TechnicalSnapshot): PlaybookSignal[] {
  if (!t) return [];

  const out: PlaybookSignal[] = [];
  const rvol = t.relativeVolume ?? 0;
  const align = t.timeframeAlignmentPct ?? 0;
  const dist = t.distanceToTriggerPct ?? 99;
  const rs = t.rs5dPct ?? 0;
  const compression = t.compressionPct ?? 0;
  const expansionAtr = t.priceExpansionAtr ?? 0;

  const add = (playbook: PlaybookId, score: number, label: string, reason: string) => {
    out.push({ playbook, score: clamp(score), label, reason });
  };

  add(
    "BREAKOUT",
    (t.trend === "BULLISH" ? 2.5 : 0) +
      (align / 100) * 2 +
      (dist <= 1.5 ? 2 : 0) +
      (rvol >= 1.2 ? 1.5 : 0) +
      (compression >= 25 ? 1 : 0),
    "פריצה",
    `מרחק מטריגר ${dist.toFixed(1)}% · התאמת טווחים ${align}% · RVOL ${rvol.toFixed(2)}x`,
  );

  add(
    "PULLBACK",
    (t.trend === "BULLISH" ? 3 : 0) +
      (t.sma20 && Math.abs(q.price / t.sma20 - 1) * 100 <= 1.2 ? 2.5 : 0) +
      (t.rsi14 && t.rsi14 >= 42 && t.rsi14 <= 64 ? 1.5 : 0) +
      (rvol <= 1.4 ? 1 : 0) +
      (align >= 50 ? 1 : 0),
    "תיקון בתוך מגמה",
    `קרבה ל-SMA20 ומבנה מגמה · RSI ${t.rsi14 ?? "—"}`,
  );

  add(
    "RELATIVE_STRENGTH_BREAKOUT",
    (t.trend === "BULLISH" ? 2 : 0) +
      (align >= 75 ? 2 : 0) +
      (rvol >= 1.3 ? 1.5 : 0) +
      (rs >= 1 ? 2 : rs >= 0.35 ? 1 : 0) +
      (dist <= 1.2 ? 1.5 : 0),
    "פריצה עם חוזק יחסי",
    `RS 5D ${rs >= 0 ? "+" : ""}${rs.toFixed(2)}% · RVOL ${rvol.toFixed(2)}x`,
  );

  add(
    "VOLATILITY_SQUEEZE",
    (t.trend !== "BEARISH" ? 2 : 0) +
      (compression >= 35 ? 3 : 0) +
      (dist <= 2 ? 1.5 : 0) +
      (align >= 50 ? 1.5 : 0),
    "כיווץ תנודתיות",
    `Compression ${compression}% · מרחק פריצה ${dist.toFixed(1)}%`,
  );

  add(
    "TREND_RECLAIM",
    (t.trend !== "BEARISH" ? 2 : 0) +
      (t.sessionVwap && q.price >= t.sessionVwap ? 2 : 0) +
      (t.sma20 && q.price >= t.sma20 ? 2 : 0) +
      (align >= 50 ? 1.5 : 0) +
      (rvol >= 1 ? 1 : 0),
    "חזרה למגמה",
    `מחיר מול VWAP/SMA20 · התאמת טווחים ${align}%`,
  );

  add(
    "MOMENTUM_CONTINUATION",
    ((q.changePct ?? 0) >= 2 ? 2.5 : 0) +
      (rvol >= 1.5 ? 2.5 : 0) +
      (t.abnormalVolume ? 1.5 : 0) +
      (expansionAtr < 2.5 ? 1.5 : 0),
    "המשך מומנטום",
    `שינוי ${q.changePct?.toFixed(2) ?? "—"}% · RVOL ${rvol.toFixed(2)}x`,
  );

  return out.filter((x) => x.score >= 4).sort((a, b) => b.score - a.score).slice(0, 5);
}
