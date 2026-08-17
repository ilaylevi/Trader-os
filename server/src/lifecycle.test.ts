import assert from "node:assert/strict";
import test from "node:test";

process.env.DATA_DIR = `/tmp/trader-os-v1-test-${process.pid}`;
process.env.ACCOUNT_VALUE_USD = "12500";
process.env.MAX_PORTFOLIO_RISK_PCT = "3";
process.env.AUTOMATION_ENABLED = "true";

const portfolio = await import("./portfolio.js");
const broker = await import("./broker.js");
const journal = await import("./journal.js");
const automation = await import("./automation.js");

function cleanupOpenTrades(){
  for (const t of portfolio.getActiveTrades()) {
    if (t.executionState === "RECORDED" && t.quantity > 0) portfolio.closeTrade(t.id, t.entry ?? 1, "test cleanup", true);
  }
}

test("v2 trade lifecycle preserves fill integrity and stages orders only", () => {
  cleanupOpenTrades();
  const plan=portfolio.openTrade({symbol:"TST",entry:100,quantity:40,stop:98,tp1:104,tp2:106,executionState:"PLANNED",thesis:"test",createdBy:"engine"});
  assert.equal(plan.executionState,"PLANNED");
  const fill=portfolio.recordActualFill(plan.id,{entry:100.1,quantity:30});
  assert.equal(fill.executionState,"RECORDED");
  assert.ok(portfolio.portfolioRiskSummary().openRiskUsd>0);
  const orders=broker.stageOrdersByTradeId(plan.id);
  assert.ok(orders.length>=3);
  assert.ok(orders.every(x=>x.status==="STAGED"));
  const closed=portfolio.closeTrade(plan.id,104.2,"test",true);
  assert.ok(closed.realizedPnlUsd>0);
});

test("shadow journal follows a triggered paper setup", () => {
  journal.recordStrategyOpportunityDecision({symbol:"SHDW",grade:"A",confidence:88,verdict:"ARMED",setupScore:8.4,convictionScore:86,playbook:"BREAKOUT",dataQualityPct:95,entry:50,stop:48,tp1:54,tp2:56,headline:"test",rationale:"test",catalyst:"test",keyRisk:"test",dataAsOf:new Date().toISOString()},"BULLISH","RISK_ON");
  journal.updateShadowWithQuote({symbol:"SHDW",price:50.1,timestamp:new Date().toISOString(),source:"test"});
  assert.equal(journal.getShadowTrades().find(x=>x.symbol==="SHDW")?.status,"OPEN");
});

test("automation can be paused and resumed at runtime", () => {
  assert.equal(automation.startAutomationEngine().enabled,true);
  assert.equal(automation.stopAutomationEngine().enabled,false);
  assert.equal(automation.getAutomationStatus().enabled,false);
});
