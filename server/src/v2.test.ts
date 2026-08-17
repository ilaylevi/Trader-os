import assert from "node:assert/strict";
import test from "node:test";

process.env.DATA_DIR = `/tmp/trader-os-v2-test-${process.pid}`;
process.env.AUTOMATION_ENABLED = "false";

const strategy = await import("./strategy-engine.js");
const consoleEngine = await import("./strategy-console.js");

test("zero-ai engine reports zero model cost", () => {
  const s = strategy.getStrategyEngineStatus();
  assert.equal(s.externalAi, false);
  assert.equal(s.modelCostUsd, 0);
  assert.equal(s.engine, "DETERMINISTIC");
});

test("strategy console works without an API model", async () => {
  const r = await consoleEngine.executeStrategyCommand("עזרה");
  assert.equal(r.externalAi, false);
  assert.equal(r.costUsd, 0);
  assert.equal(r.engine, "DETERMINISTIC");
  assert.match(r.answer, /סריקת שוק/);
});
