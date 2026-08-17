import assert from "node:assert/strict";
import test from "node:test";
import { analyzeLongSetup } from "./analytics.js";
import type { Candle } from "./market-data.js";

test("v2.5 playbook planner creates usable structural/hybrid levels instead of one generic breakout stop",()=>{
  const intraday:Candle[]=Array.from({length:900},(_,i)=>({time:1_700_000_000+i*300,open:100+i*.02,high:100.45+i*.02,low:99.8+i*.02,close:100.25+i*.02,volume:i===899?2800:1000+(i%9)*35}));
  const daily:Candle[]=Array.from({length:90},(_,i)=>({time:1_690_000_000+i*86400,open:92+i*.28,high:93+i*.28,low:91.5+i*.28,close:92.7+i*.28,volume:1_000_000+i*5000}));
  const quote:any={symbol:"LEVELS",price:118.4,changePct:2,open:116,high:118.5,low:115.8,previousClose:116.1,timestamp:new Date().toISOString(),source:"test"};
  const plan=analyzeLongSetup("LEVELS",quote,intraday,"OPEN",daily);
  assert.notEqual(plan.playbook,"NONE");
  assert.ok(plan.entry&&plan.stop&&plan.tp1&&plan.tp2);
  assert.ok((plan.riskReward??0)>=2);
  assert.ok(["STRUCTURAL","HYBRID","ATR_FALLBACK"].includes(plan.levelQuality??""));
  assert.match(plan.stopLogic??"",/סטופ/);
  assert.match(plan.entryLogic??"",/כניסה/);
});

test("v2.5 full-market sweep progresses across the complete catalog and preserves finalists",async()=>{
  const dir=`/tmp/trader-os-v25-full-${process.pid}`;
  process.env.DATA_DIR=dir;
  process.env.FULL_MARKET_SWEEP_ENABLED="true";
  process.env.FULL_MARKET_SWEEP_BATCH_SIZE="4";
  process.env.FULL_MARKET_SWEEP_CONCURRENCY="2";
  const full=await import("./full-market-scan.js");
  full.resetFullMarketSweep();
  const catalog=Array.from({length:10},(_,i)=>`FM${i}`);
  const quoteLoader=async(symbol:string)=>{const i=Number(symbol.slice(2));return{symbol,price:20+i,changePct:i/2,open:20+i-.2,high:20+i+.4,low:20+i-.6,previousClose:20+i-.3,timestamp:new Date().toISOString(),source:"test"} as any};
  const args={catalogLoader:async()=>catalog,quoteLoader,score:(q:any)=>q.changePct??0};
  await full.advanceFullMarketSweep(args);await full.advanceFullMarketSweep(args);await full.advanceFullMarketSweep(args);
  const status=full.getFullMarketSweepStatus();
  assert.equal(status.catalogSize,10);
  assert.equal(status.coveragePct,100);
  assert.ok(status.completedSweeps>=1);
  const best=full.getFullMarketCandidates(3);
  assert.equal(best[0].symbol,"FM9");
  const rotatedA=full.takeFullMarketFinalists(2).map(x=>x.symbol);
  const rotatedB=full.takeFullMarketFinalists(2).map(x=>x.symbol);
  assert.notDeepEqual(rotatedA,rotatedB);
});
