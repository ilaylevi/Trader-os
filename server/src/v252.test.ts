import assert from "node:assert/strict";
import test from "node:test";

test("v2.5.2 full scan distinguishes attempted coverage from successful coverage", async () => {
  const dir = `/tmp/trader-os-v252-full-${process.pid}`;
  process.env.DATA_DIR = dir;
  process.env.STORAGE_BACKEND = "json";
  process.env.FULL_MARKET_SWEEP_ENABLED = "true";
  process.env.FULL_MARKET_SWEEP_BATCH_SIZE = "4";
  process.env.FULL_MARKET_SWEEP_CONCURRENCY = "2";
  const full = await import("./full-market-scan.js");
  full.resetFullMarketSweep();
  const catalog = ["GOOD1", "GOOD2", "BAD", "GOOD3"];
  const quoteLoader = async (symbol: string) => {
    if (symbol === "BAD") throw new Error("permanent quote failure");
    return { symbol, price: 25, changePct: 1, open: 24, high: 26, low: 23, previousClose: 24, timestamp: new Date().toISOString(), source: "test" } as any;
  };
  const args = { catalogLoader: async () => catalog, quoteLoader, score: (q: any) => q.changePct ?? 0 };
  // Permanent failures only become permanent after the bounded retry budget.
  await full.advanceFullMarketSweep(args);
  await full.advanceFullMarketSweep(args);
  await full.advanceFullMarketSweep(args);
  await full.advanceFullMarketSweep(args);
  const status = full.getFullMarketSweepStatus();
  assert.equal(status.attemptedCoveragePct, 100);
  assert.equal(status.successCoveragePct, 75);
  assert.equal(status.successes, 3);
  assert.equal(status.failures, 1);
  assert.equal(status.completedWithErrors, true);
  assert.match(status.completionLabel, /כשלים/);
});

test("v2.5.2 invalid zero price is not counted as a successful scan", async () => {
  const dir = `/tmp/trader-os-v252-price-${process.pid}`;
  process.env.DATA_DIR = dir;
  process.env.STORAGE_BACKEND = "json";
  process.env.FULL_MARKET_SWEEP_ENABLED = "true";
  process.env.FULL_MARKET_SWEEP_BATCH_SIZE = "2";
  const full = await import("./full-market-scan.js");
  full.resetFullMarketSweep();
  const args = {
    catalogLoader: async () => ["OK", "ZERO"],
    quoteLoader: async (symbol: string) => ({ symbol, price: symbol === "ZERO" ? 0 : 20, changePct: 1, timestamp: new Date().toISOString(), source: "test" } as any),
    score: (q: any) => q.changePct ?? 0,
  };
  await full.advanceFullMarketSweep(args);
  const status = full.getFullMarketSweepStatus();
  assert.equal(status.attemptedCoveragePct, 100);
  assert.equal(status.successCoveragePct, 50);
  assert.equal(status.failures, 1);
});
