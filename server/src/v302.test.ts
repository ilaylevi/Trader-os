import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePreTradeGate } from "./pretrade-gate.js";

const validSetup:any={symbol:"TEST",side:"LONG",status:"ARMED",verdict:"ENTER",setupScore:8,entry:100,stop:98,tp1:104,tp2:106,riskReward:2.5,levelQuality:"STRUCTURAL",quote:{symbol:"TEST",price:100,timestamp:new Date().toISOString()},dataQualityPct:95,dataConfidenceScore:90,spreadPct:.2,secCriticalRisk:false,eventRiskLocked:false,notes:[],technicals:{mtfQualityPct:90,averageDollarVolume20d:50_000_000,trend:"BULLISH",timeframeAlignmentPct:85,relativeVolume:1.5,roomToResistanceR:3},context:{marketRegime:"TREND_UP",sectorAlignment:"TAILWIND"}};
test("v3.0.2 closed market waits instead of rejecting setup",()=>{const r=evaluatePreTradeGate(validSetup,"CLOSED");assert.equal(r.gates.marketOpen,false);assert.equal(r.verdict,"WAIT");assert.ok(!r.blockers.some(x=>x.includes("אינו פתוח")))});
test("v3.0.2 unverified premarket waits",()=>{const r=evaluatePreTradeGate({...validSetup,preMarketVerified:false},"PRE");assert.equal(r.gates.sessionPriceVerified,false);assert.equal(r.verdict,"WAIT")});
