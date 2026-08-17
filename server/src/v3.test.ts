import assert from "node:assert/strict";
import test from "node:test";
import type { StrategyOpportunity, TradePlan } from "@trader-os/shared";

process.env.DATA_DIR=`/tmp/trader-os-v3-${process.pid}`;
process.env.STORAGE_BACKEND="json";
process.env.SHADOW_TRADING_ENABLED="true";
process.env.SHADOW_AB_ENABLED="true";

function plan():TradePlan{return {
  symbol:"V3T",side:"LONG",holdingPeriod:"1-3d",status:"TRIGGERED",verdict:"ENTER",setupScore:8.4,convictionScore:84,
  quote:{symbol:"V3T",price:101,open:99.5,high:101.2,low:99.2,previousClose:99,changePct:2.02,timestamp:new Date().toISOString(),source:"Finnhub"},
  dataQualityPct:96,dataConfidenceScore:92,dataSource:"Twelve Data",dataAsOf:new Date().toISOString(),spreadPct:.12,
  entry:101.1,stop:99.8,tp1:103.7,tp2:105.2,riskReward:3.15,playbook:"BREAKOUT",
  technicals:{trend:"BULLISH",relativeVolume:1.8,volumeZScore:2.1,timeframeAlignmentPct:88,distanceToTriggerPct:.1,priceExpansionAtr:1.1,gapPct:1.2,atr14:1.25,mtfQualityPct:94,averageDollarVolume20d:55_000_000,roomToResistanceR:3.5} as any,
  context:{marketRegime:"RISK_ON",regimeScore:62,sectorAlignment:"TAILWIND",sectorEtf:"XLK",relativeStrengthGrade:"LEADER"} as any,
  fundamentalHealthScore:74,securitySector:"Technology",portfolioGatePassed:true,notes:[],thesis:"פריצה עם נפח וחוזק יחסי"
} as TradePlan}

test("v3 advanced decision decomposes independent evidence and source authority",async()=>{
  const {buildAdvancedDecision}=await import("./reasoning-engine.js");
  const d=await buildAdvancedDecision(plan(),84,false);
  assert.ok((d.independentEvidence?.groups??0)>=5);
  assert.ok((d.independentEvidence?.bullPct??0)>50);
  assert.ok(d.sourceAuthority?.some(x=>x.level==="OFFICIAL"));
  assert.ok(d.executionReality?.stressedRiskPct!==undefined);
  assert.ok(["ENTER","ARMED","WAIT","UNCERTAIN","REJECT"].includes(d.judgeVerdict));
});

test("v3 decision can admit high uncertainty when analog evidence is thin",async()=>{
  const {buildAdvancedDecision}=await import("./reasoning-engine.js");
  const p=plan();p.dataConfidenceScore=73;
  const d=await buildAdvancedDecision(p,86,false);
  assert.ok(["HIGH","OUT_OF_DISTRIBUTION"].includes(d.uncertainty));
});

test("v3 shadow A/B creates separate variants and keeps them out of strategy learning",async()=>{
  const {recordStrategyOpportunityDecision,getShadowTrades}=await import("./journal.js");
  const {getAdaptiveLearningSnapshot}=await import("./learning.js");
  const opp:StrategyOpportunity={symbol:"ABV3",confidence:82,grade:"A",verdict:"READY",setupScore:8.2,playbook:"BREAKOUT",headline:"test",rationale:"test",catalyst:"test",keyRisk:"test",entry:100,stop:98,tp1:104,tp2:106,riskReward:3,dataQualityPct:95,dataAsOf:new Date().toISOString()};
  recordStrategyOpportunityDecision(opp,"BULLISH","RISK_ON");
  const rows=getShadowTrades().filter(x=>x.symbol==="ABV3");
  assert.ok(rows.some(x=>x.purpose==="STRATEGY"));
  assert.ok(rows.some(x=>x.purpose==="AB_TEST"&&x.abVariant==="A_BASE"));
  assert.ok(rows.some(x=>x.purpose==="AB_TEST"&&x.abVariant==="B_TIGHTER_STOP"));
  const learning=getAdaptiveLearningSnapshot();
  const stat=(learning.stats as any)?.BREAKOUT;
  assert.ok(!stat||stat.shadowSamples<=1,"A/B rows must not inflate adaptive shadow samples");
});

test("v3 market state machine exposes explicit time-of-day phase",async()=>{
  const {deriveMarketPhase}=await import("./market-state-machine.js");
  const x=deriveMarketPhase({regime:"RISK_ON",breadthAdvancePct:65,avgChangePct:.8});
  assert.ok(x.phase);
  assert.ok(x.labelHe.length>3);
  assert.ok(x.confidence>=0&&x.confidence<=100);
});
