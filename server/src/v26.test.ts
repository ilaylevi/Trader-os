import assert from "node:assert/strict";
import test from "node:test";
import { analyzeLongSetup } from "./analytics.js";
import { evaluatePreTradeGate } from "./pretrade-gate.js";
import { scorePlaybookSignals } from "./playbook-scanners.js";
import { runDailyBacktest } from "./backtest.js";
import type { Candle } from "./market-data.js";

function dailyBars(n=260): Candle[] {
  return Array.from({length:n},(_,i)=>{
    const base=70+i*.18+Math.sin(i/8)*1.2;
    return {time:1_680_000_000+i*86400,open:base-.25,high:base+.75,low:base-.8,close:base+.3,volume:1_200_000+(i%12)*55_000};
  });
}
function intradayBars(n=900): Candle[] {
  return Array.from({length:n},(_,i)=>{
    const base=110+i*.012+Math.sin(i/16)*.25;
    return {time:1_700_000_000+i*300,open:base-.06,high:base+.18,low:base-.16,close:base+.08,volume:9000+(i%20)*380};
  });
}

test("v2.6 structural level engine exposes previous/weekly/monthly/anchored references",()=>{
  const intraday=intradayBars(),daily=dailyBars(120),last=intraday.at(-1)!;
  const quote:any={symbol:"REFS",price:last.close,open:last.open,high:last.high,low:last.low,previousClose:last.close-.5,changePct:1.4,timestamp:new Date().toISOString(),source:"test"};
  const plan=analyzeLongSetup("REFS",quote,intraday,"OPEN",daily);
  assert.ok(plan.technicals?.weeklyHigh);
  assert.ok(plan.technicals?.monthlyHigh);
  assert.ok(plan.technicals?.anchoredVwap);
  assert.ok(plan.technicals?.volumeProfilePoc);
});

test("v2.6 parallel playbook scanners return transparent ranked signals",()=>{
  const technicals:any={trend:"BULLISH",relativeVolume:1.8,timeframeAlignmentPct:80,distanceToTriggerPct:.6,rs5dPct:1.3,compressionPct:40,priceExpansionAtr:1.4,abnormalVolume:true,sessionVwap:100,sma20:100,rsi14:58};
  const q:any={symbol:"SCAN",price:103,changePct:2.6,timestamp:new Date().toISOString(),source:"test"};
  const signals=scorePlaybookSignals(q,technicals);
  assert.ok(signals.length>=2);
  assert.ok(signals[0].score>=signals.at(-1)!.score);
  assert.ok(signals.some(x=>x.playbook==="RELATIVE_STRENGTH_BREAKOUT"));
});

test("v2.6 pre-trade gate blocks low data confidence, wide spread and SEC critical risk",()=>{
  process.env.MIN_DATA_CONFIDENCE_SCORE="70";
  process.env.MAX_EXECUTION_SPREAD_PCT="0.8";
  process.env.MIN_AVG_DOLLAR_VOLUME_20D="5000000";
  const plan:any={symbol:"RISK",quote:{price:100},dataQualityPct:95,dataConfidenceScore:52,spreadPct:1.4,secCriticalRisk:true,entry:101,stop:99,tp1:105,tp2:108,riskReward:3.5,eventRiskLocked:false,notes:[],verdict:"ENTER",technicals:{mtfQualityPct:95,averageDollarVolume20d:50_000_000,trend:"BULLISH",timeframeAlignmentPct:90,relativeVolume:1.8,roomToResistanceR:4},context:{marketRegime:"RISK_ON",sectorAlignment:"TAILWIND"}};
  const gate=evaluatePreTradeGate(plan,"OPEN");
  assert.equal(gate.verdict,"NO_ENTRY");
  assert.equal(gate.gates.dataConfidence,false);
  assert.equal(gate.gates.spreadAcceptable,false);
  assert.equal(gate.gates.secRiskClear,false);
});

test("v2.6 historical backtest produces deterministic metrics from local bars",()=>{
  const bars=dailyBars(320);
  // Force several breakout impulses into an otherwise rising series.
  for(let i=80;i<bars.length;i+=35){bars[i].high+=4;bars[i].close=bars[i].high-.1;bars[i].volume*=2.3; if(bars[i+1]) bars[i+1].open=bars[i].close+.15;}
  const trades=runDailyBacktest("BT",bars,"BREAKOUT");
  assert.ok(Array.isArray(trades));
  for(const t of trades){assert.ok(Number.isFinite(t.r));assert.ok(t.entry>t.stop);assert.ok(t.target>t.entry)}
});
