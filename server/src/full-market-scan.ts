import type { MarketQuote } from "@trader-os/shared";
import { dataPath, isoDay, isoNow, readJsonFile, writeJsonFile } from "./store.js";

export interface FullMarketCandidate {
  symbol: string;
  score: number;
  price: number;
  changePct?: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  quoteTimestamp: string;
  scannedAt: string;
}

interface FullMarketState {
  day: string;
  sweepId: string;
  cursor: number;
  catalogSize: number;
  checked: number;
  successes: number;
  failures: number;
  startedAt?: string;
  completedAt?: string;
  completedSweeps: number;
  running: boolean;
  lastAdvanceAt?: string;
  lastError?: string;
  rateLimitedUntil?: string;
  top: FullMarketCandidate[];
  lastCompletedTop: FullMarketCandidate[];
  finalistCursor?: number;
  retryCounts?: Record<string, number>;
  successfulSymbols?: string[];
  failedSymbols?: Record<string, string>;
}

const statePath = dataPath("full-market-scan.json");
const enabled = (process.env.FULL_MARKET_SWEEP_ENABLED ?? "true").toLowerCase() !== "false";
const batchSize = Math.max(1, Math.min(250, Number(process.env.FULL_MARKET_SWEEP_BATCH_SIZE ?? 12)));
const concurrency = Math.max(1, Math.min(6, Number(process.env.FULL_MARKET_SWEEP_CONCURRENCY ?? 2)));
const repeatMinutes = Math.max(5, Number(process.env.FULL_MARKET_SWEEP_REPEAT_MINUTES ?? 30));
const topLimit = Math.max(50, Math.min(1000, Number(process.env.FULL_MARKET_TOP_CACHE_SIZE ?? 300)));
const minPrice = Math.max(0, Number(process.env.SCAN_MIN_PRICE ?? 5));
const maxPrice = Math.max(minPrice, Number(process.env.SCAN_MAX_PRICE ?? 1000));
let inFlight: Promise<any> | null = null;

function emptyState(): FullMarketState {
  return {
    day: isoDay(),
    sweepId: `full_${Date.now().toString(36)}`,
    cursor: 0,
    catalogSize: 0,
    checked: 0,
    successes: 0,
    failures: 0,
    completedSweeps: 0,
    running: false,
    top: [],
    lastCompletedTop: [],
    finalistCursor: 0,
    retryCounts: {},
    successfulSymbols: [],
    failedSymbols: {},
  };
}

function loadState(): FullMarketState {
  const s = readJsonFile<FullMarketState>(statePath, emptyState());
  if (s.day !== isoDay()) {
    const previousTop = s.lastCompletedTop?.length ? s.lastCompletedTop : s.top;
    s.day = isoDay();
    s.sweepId = `full_${Date.now().toString(36)}`;
    s.cursor = 0;
    s.checked = 0;
    s.successes = 0;
    s.failures = 0;
    s.startedAt = undefined;
    s.completedAt = undefined;
    s.running = false;
    s.lastError = undefined;
    s.rateLimitedUntil = undefined;
    s.top = [];
    s.lastCompletedTop = previousTop ?? [];
    s.successfulSymbols = [];
    s.failedSymbols = {};
  }
  return s;
}

function saveState(s: FullMarketState) {
  writeJsonFile(statePath, s);
  return s;
}

function mergeTop(current: FullMarketCandidate[], rows: FullMarketCandidate[]) {
  const by = new Map<string, FullMarketCandidate>();
  for (const x of [...current, ...rows]) {
    const prev = by.get(x.symbol);
    if (!prev || x.score > prev.score || Date.parse(x.scannedAt) > Date.parse(prev.scannedAt)) by.set(x.symbol, x);
  }
  return [...by.values()].sort((a, b) => b.score - a.score).slice(0, topLimit);
}

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: Array<PromiseSettledResult<R>> = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        out[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        out[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function isRateLimitError(error: unknown) {
  return /429|rate.?limit|too many/i.test(error instanceof Error ? error.message : String(error));
}
function isTransientError(error: unknown) {
  return /429|rate.?limit|too many|abort|timeout|timed out|fetch|network|econn|http_5\d\d/i.test(error instanceof Error ? error.message : String(error));
}

export function getFullMarketSweepStatus() {
  const s = loadState();
  const successCount = new Set(s.successfulSymbols ?? []).size;
  const permanentFailures = Object.keys(s.failedSymbols ?? {}).length;
  const attempted = Math.min(s.catalogSize || Number.MAX_SAFE_INTEGER, Math.max(s.cursor, successCount + permanentFailures));
  const attemptedCoveragePct = s.catalogSize ? Math.min(100, Number(((attempted / s.catalogSize) * 100).toFixed(1))) : 0;
  const successCoveragePct = s.catalogSize ? Math.min(100, Number(((successCount / s.catalogSize) * 100).toFixed(1))) : 0;
  const completedWithErrors = Boolean(s.completedAt && permanentFailures > 0);
  return {
    enabled,
    sweepId: s.sweepId,
    running: s.running,
    catalogSize: s.catalogSize,
    checked: attempted,
    attempted,
    successes: successCount,
    failures: permanentFailures,
    coveragePct: attemptedCoveragePct,
    attemptedCoveragePct,
    successCoveragePct,
    completedWithErrors,
    completionLabel: s.completedAt ? (completedWithErrors ? "הסבב הסתיים עם כשלים שדורשים בדיקה חוזרת" : "הסבב הושלם בהצלחה") : "הסריקה בתהליך",
    failedSample: Object.entries(s.failedSymbols ?? {}).slice(0, 8).map(([symbol, reason]) => ({ symbol, reason })),
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    completedSweeps: s.completedSweeps,
    lastAdvanceAt: s.lastAdvanceAt,
    lastError: s.lastError,
    rateLimitedUntil: s.rateLimitedUntil,
    topCount: s.top.length,
    batchSize,
    batchMode: batchSize > 30 ? "BULK_WHEN_AVAILABLE" : "PER_SYMBOL",
    concurrency,
    repeatMinutes,
  };
}

export function getFullMarketCandidates(limit = 80) {
  const s = loadState();
  const rows = mergeTop(s.lastCompletedTop ?? [], s.top ?? []);
  return rows.slice(0, Math.max(1, Math.min(topLimit, limit)));
}

export function takeFullMarketFinalists(limit = 2) {
  const s = loadState();
  const poolLimit = Math.max(10, Math.min(topLimit, Number(process.env.FULL_MARKET_DEEP_FINALIST_POOL ?? 60)));
  const pool = mergeTop(s.lastCompletedTop ?? [], s.top ?? []).slice(0, poolLimit);
  if (!pool.length) return [] as FullMarketCandidate[];
  const count = Math.max(1, Math.min(pool.length, limit));
  const start = (s.finalistCursor ?? 0) % pool.length;
  const out: FullMarketCandidate[] = [];
  for (let i = 0; i < count; i++) out.push(pool[(start + i) % pool.length]);
  s.finalistCursor = (start + count) % pool.length;
  saveState(s);
  return out;
}

export function resetFullMarketSweep() {
  const old = loadState();
  const next = emptyState();
  next.lastCompletedTop = old.top.length ? old.top : old.lastCompletedTop;
  next.completedSweeps = old.completedSweeps;
  saveState(next);
  return getFullMarketSweepStatus();
}

export async function advanceFullMarketSweep(input: {
  catalogLoader: () => Promise<string[]>;
  quoteLoader: (symbol: string) => Promise<MarketQuote>;
  batchQuoteLoader?: (symbols: string[]) => Promise<Record<string, MarketQuote>>;
  score: (quote: MarketQuote) => number;
}) {
  if (!enabled) return getFullMarketSweepStatus();
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const s = loadState();
    const now = Date.now();
    if (s.rateLimitedUntil && Date.parse(s.rateLimitedUntil) > now) return getFullMarketSweepStatus();

    let catalog: string[];
    try {
      catalog = [...new Set((await input.catalogLoader()).map((x) => x.trim().toUpperCase()).filter(Boolean))];
    } catch (error) {
      s.lastError = `טעינת קטלוג המניות נכשלה: ${error instanceof Error ? error.message : String(error)}`;
      saveState(s);
      return getFullMarketSweepStatus();
    }

    s.catalogSize = catalog.length;
    if (!catalog.length) {
      s.lastError = "קטלוג המניות ריק";
      saveState(s);
      return getFullMarketSweepStatus();
    }

    if (s.completedAt && s.checked >= catalog.length) {
      if (now - Date.parse(s.completedAt) < repeatMinutes * 60_000) return getFullMarketSweepStatus();
      s.lastCompletedTop = s.top;
      s.sweepId = `full_${Date.now().toString(36)}`;
      s.cursor = 0;
      s.checked = 0;
      s.successes = 0;
      s.failures = 0;
      s.startedAt = isoNow();
      s.completedAt = undefined;
      s.top = [];
      s.successfulSymbols = [];
      s.failedSymbols = {};
      s.retryCounts = {};
      s.lastError = undefined;
    }

    if (!s.startedAt) s.startedAt = isoNow();
    s.running = true;
    saveState(s);

    const start = s.cursor;
    const remaining = Math.max(0, catalog.length - start);
    const effectiveBatch = input.batchQuoteLoader ? batchSize : Math.min(batchSize, 30);
    const take = Math.min(effectiveBatch, remaining);
    const symbols = catalog.slice(start, start + take);

    if (!symbols.length) {
      s.completedAt = isoNow();
      s.running = false;
      s.completedSweeps++;
      s.lastCompletedTop = s.top;
      saveState(s);
      return getFullMarketSweepStatus();
    }

    let settled: Array<PromiseSettledResult<MarketQuote>>;
    if (input.batchQuoteLoader) {
      try {
        const batch = await input.batchQuoteLoader(symbols);
        settled = symbols.map((symbol) => batch[symbol]
          ? ({ status: "fulfilled", value: batch[symbol] } as PromiseFulfilledResult<MarketQuote>)
          : ({ status: "rejected", reason: new Error("לא התקבל Snapshot עבור הסימבול") } as PromiseRejectedResult));
      } catch (error) {
        settled = symbols.map(() => ({ status: "rejected", reason: error } as PromiseRejectedResult));
      }
    } else settled = await mapConcurrent(symbols, concurrency, input.quoteLoader);
    const rows: FullMarketCandidate[] = [];
    let rateLimited = false;
    let retryNeeded = false;
    let firstRetryIndex: number | undefined;
    s.retryCounts = s.retryCounts ?? {};
    s.successfulSymbols = s.successfulSymbols ?? [];
    s.failedSymbols = s.failedSymbols ?? {};
    const successful = new Set(s.successfulSymbols);

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      const symbol = symbols[i];
      if (result.status === "fulfilled") {
        const q = result.value;
        delete s.retryCounts[symbol];
        if (!Number.isFinite(q.price) || q.price <= 0) {
          successful.delete(symbol);
          s.failedSymbols[symbol] = "לא התקבל מחיר שוק תקין";
          s.lastError = `${symbol}: לא התקבל מחיר שוק תקין ולכן המניה אינה נספרת כנסרקה בהצלחה.`;
          continue;
        }
        successful.add(symbol);
        delete s.failedSymbols[symbol];
        if (q.price >= minPrice && q.price <= maxPrice) {
          rows.push({
            symbol: q.symbol,
            score: input.score(q),
            price: q.price,
            changePct: q.changePct,
            open: q.open,
            high: q.high,
            low: q.low,
            previousClose: q.previousClose,
            quoteTimestamp: q.timestamp,
            scannedAt: isoNow(),
          });
        }
      } else {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        const transient = isTransientError(result.reason);
        const attempts = (s.retryCounts[symbol] ?? 0) + 1;
        if (transient && attempts <= 3) {
          s.retryCounts[symbol] = attempts;
          retryNeeded = true;
          if (firstRetryIndex === undefined) firstRetryIndex = i;
          if (isRateLimitError(result.reason)) rateLimited = true;
          s.lastError = `${symbol}: שגיאה זמנית (${attempts}/3) — המניה לא תידלג ותיבדק שוב. ${reason}`;
        } else {
          delete s.retryCounts[symbol];
          s.failedSymbols[symbol] = reason;
          successful.delete(symbol);
          s.lastError = `${symbol}: הבדיקה נכשלה לאחר ניסיונות חוזרים או הוחזרה שגיאה קבועה. ${reason}`;
        }
      }
    }

    // Never silently skip transient failures. Rewind to the first retryable symbol.
    s.cursor = Math.min(catalog.length, start + (retryNeeded ? firstRetryIndex ?? 0 : symbols.length));
    s.successfulSymbols = [...successful];
    s.successes = successful.size;
    s.failures = Object.keys(s.failedSymbols).length;
    s.checked = Math.max(s.checked, s.cursor);
    s.top = mergeTop(s.top, rows);
    s.lastAdvanceAt = isoNow();

    if (rateLimited) {
      s.rateLimitedUntil = new Date(Date.now() + 65_000).toISOString();
      s.lastError = "ספק הנתונים החזיר Rate Limit; הסריקה המלאה הושהתה זמנית ותמשיך אוטומטית בלי לדלג על המניות שנכשלו.";
    } else {
      s.rateLimitedUntil = undefined;
      if (retryNeeded) s.lastError = s.lastError ?? "אירעה שגיאת רשת זמנית; הסימבול ייבדק שוב בסבב הבא ולא יידלג.";
    }

    if (s.cursor >= catalog.length) {
      s.completedAt = isoNow();
      s.running = false;
      s.completedSweeps++;
      s.lastCompletedTop = s.top;
    } else {
      s.running = true;
    }

    saveState(s);
    return getFullMarketSweepStatus();
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
