import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePreTradeGate } from "./pretrade-gate.js";

process.env.DATA_DIR=`/tmp/trader-os-v23-${process.pid}`;
process.env.ACCOUNT_VALUE_USD="12500";
process.env.MAX_PORTFOLIO_RISK_PCT="3";

const portfolio=await import("./portfolio.js");

test("unified pre-trade gate blocks weak MTF/structural room",()=>{
  const plan:any={symbol:"TEST",side:"LONG",status:"ARMED",verdict:"ENTER",setupScore:8,holdingPeriod:"1-3d",thesis:"x",entry:100,stop:98,tp1:104,tp2:106,riskReward:3,dataQualityPct:98,technicals:{trend:"BULLISH",mtfQualityPct:40,timeframeAlignmentPct:80,relativeVolume:1.5,roomToResistanceR:1.2},context:{marketRegime:"RISK_ON",sectorAlignment:"TAILWIND"},notes:[]};
  const g=evaluatePreTradeGate(plan,"OPEN");
  assert.equal(g.verdict,"NO_ENTRY");
  assert.equal(g.gates.trueMtf,false);
  assert.equal(g.gates.structuralRoom,false);
});

test("trade management supports partial exits and blocks stop widening",()=>{
  for(const t of portfolio.getActiveTrades())if(t.executionState==="RECORDED"&&t.quantity>0)portfolio.closeTrade(t.id,t.entry??1,"cleanup",true);
  const t=portfolio.openTrade({symbol:"V23",entry:100,quantity:20,stop:98,tp1:104,tp2:106,executionState:"RECORDED",thesis:"test"});
  const p=portfolio.recordPartialExit(t.id,{quantity:5,price:104,note:"TP1"});
  assert.equal(p.quantity,15);assert.ok((p.partialRealizedPnlUsd??0)>0);
  assert.throws(()=>portfolio.moveStop(t.id,97),/stop_widening_blocked/);
  const b=portfolio.moveStopToBreakeven(t.id);assert.equal(b.stop,100);
  const c=portfolio.closeTrade(t.id,106,"done",true);assert.ok((c.realizedR??0)>0);assert.ok((c.realizedPnlUsd??0)>0);
});
