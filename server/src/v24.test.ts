import assert from "node:assert/strict";
import test from "node:test";

process.env.DATA_DIR=`/tmp/trader-os-v24-${process.pid}`;
process.env.ACCOUNT_VALUE_USD="12500";
process.env.MAX_PORTFOLIO_RISK_PCT="3";
process.env.FINNHUB_API_KEY="";
process.env.LIVE_PRICES_ENABLED="false";

const portfolio=await import("./portfolio.js");
const scanner=await import("./scanner-universe.js");
const live=await import("./live-prices.js");
const learning=await import("./learning.js");

test("scanner rotates through catalog instead of repeating only priority symbols",async()=>{
  const catalog=Array.from({length:80},(_,i)=>`T${String(i).padStart(3,"0")}`);
  const a=await scanner.prepareDiscoveryBatch({catalogLoader:async()=>catalog,staticUniverse:["AAPL"],prioritySymbols:["AAPL"],dynamicSymbols:[],quoteBudget:12,rotationBatchSize:10});
  const b=await scanner.prepareDiscoveryBatch({catalogLoader:async()=>catalog,staticUniverse:["AAPL"],prioritySymbols:["AAPL"],dynamicSymbols:[],quoteBudget:12,rotationBatchSize:10});
  assert.ok(a.rotatingSymbols.length>=8);
  assert.ok(b.rotatingSymbols.length>=8);
  assert.notDeepEqual(a.rotatingSymbols,b.rotatingSymbols);
  assert.ok(b.checkedToday>a.checkedToday);
});

test("manual trade validates direction targets and records local auto-close provenance",()=>{
  assert.throws(()=>portfolio.openTrade({symbol:"BADL",side:"LONG",entry:100,quantity:5,stop:98,tp1:99,executionState:"RECORDED"}),/long_tp1_must_be_above_entry/);
  assert.throws(()=>portfolio.openTrade({symbol:"BADS",side:"SHORT",entry:100,quantity:5,stop:102,tp1:101,executionState:"RECORDED"}),/short_tp1_must_be_below_entry/);
  const t=portfolio.openTrade({symbol:"LIVE1",side:"LONG",entry:100,quantity:10,stop:98,tp1:103,tp2:106,executionState:"RECORDED",autoLevelManagement:true});
  portfolio.recordTp1(t.id,103.1);
  const closed=portfolio.closeTradeFromLevel(t.id,106.2,"TP2_HIT",106);
  assert.equal(closed.closeReason,"TP2_HIT");
  assert.equal(closed.closureSource,"LEVEL_MONITOR");
  assert.equal(closed.brokerExecutionConfirmed,false);
  assert.equal(closed.triggerLevel,106);
  assert.ok(closed.tp1HitAt);
  assert.equal(learning.getAdaptiveLearningSnapshot().stats.NONE,undefined);
  const confirmed=portfolio.confirmClosedTradeExecution(t.id,106.05);
  assert.equal(confirmed.brokerExecutionConfirmed,true);
  assert.equal(learning.getAdaptiveLearningSnapshot().stats.NONE?.realSamples,1);
});

test("live-price cache exposes seeded quote with freshness metadata",()=>{
  live.seedLiveQuote({symbol:"AAPL",price:210,source:"TEST",timestamp:new Date().toISOString()});
  const p=live.getLivePrice("AAPL");
  assert.equal(p?.price,210);
  assert.ok(["LIVE","FRESH"].includes(p?.freshness??""));
});
