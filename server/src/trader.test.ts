import assert from "node:assert/strict";
import test from "node:test";
import { analyzeLongSetup, atr, rsi, sma } from "./analytics.js";
import { calculatePositionSize } from "./trader.js";
import type { Candle } from "./market-data.js";

test("position sizing never exceeds risk budget", () => {
  const result = calculatePositionSize({ accountValueIls: 100_000, riskPct: 0.5, entry: 100, stop: 98, usdIls: 3.7 });
  assert.ok(result.estimatedRiskIls <= result.riskBudgetIls);
  assert.equal(result.quantity, 67);
});

test("basic indicators are calculated", () => {
  const values = Array.from({ length: 60 }, (_, i) => 100 + i * 0.2);
  assert.ok((sma(values, 20) ?? 0) > 0);
  assert.ok((rsi(values, 14) ?? 0) > 50);
});

test("true multi-timeframe setup uses deep intraday plus real daily history", () => {
  const intraday:Candle[]=Array.from({length:900},(_,i)=>({time:1_700_000_000+i*300,open:100+i*.02,high:100.45+i*.02,low:99.8+i*.02,close:100.25+i*.02,volume:i===899?2800:1000+(i%9)*35}));
  const daily:Candle[]=Array.from({length:90},(_,i)=>({time:1_690_000_000+i*86400,open:92+i*.28,high:93+i*.28,low:91.5+i*.28,close:92.7+i*.28,volume:1_000_000+i*5000}));
  assert.ok((atr(intraday,14)??0)>0);
  const quote={symbol:"TEST",price:118.4,changePct:2,timestamp:new Date().toISOString(),source:"test"};
  const result=analyzeLongSetup("TEST",quote,intraday,"OPEN",daily);
  assert.equal(result.technicals?.trend,"BULLISH");
  assert.ok((result.technicals?.mtfQualityPct??0)>=70);
  assert.ok((result.technicals?.multiTimeframe?.find(x=>x.timeframe==="1d")?.bars??0)>=60);
  assert.ok(result.trigger);
});
