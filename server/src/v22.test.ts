import assert from "node:assert/strict";
import test from "node:test";
import { explainEntryHe, gatesHe } from "./i18n-he.js";

test("Hebrew entry explanation hides backend gate names behind human labels",()=>{
  const gates={liveQuote:true,dataQuality:false,bullishTrend:false,multiTimeframe:false,relativeVolume:false,definedStop:false,riskReward:false,marketOpen:true,marketNotRiskOff:true,sectorNotHeadwind:true,eventRiskClear:true,headlineRiskClear:true,catalystNotBlocked:true,noChase:true};
  const e=explainEntryHe("RIOT","NO_ENTRY","Data-quality gate blocks execution.",gates,{symbol:"RIOT",side:"LONG",status:"WATCHING",verdict:"NO_ENTRY",setupScore:.6,convictionScore:16,holdingPeriod:"1-3d",thesis:"",dataQualityPct:32,context:{relativeStrengthGrade:"LEADER"}});
  assert.equal(e.verdictLabel,"לא נכנסים כרגע");
  assert.match(e.primaryReason,/איכות הנתונים/);
  assert.ok(e.blockers.some(x=>x.includes("נתוני נרות")));
  assert.ok(e.nextSteps.some(x=>x.includes("OHLCV")));
  assert.equal(gatesHe.dataQuality.title,"איכות נתונים");
});
