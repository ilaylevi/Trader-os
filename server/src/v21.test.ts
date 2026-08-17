import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { analyzeLongSetup } from "./analytics.js";
import { assessCatalyst } from "./catalyst.js";

test("adaptive technical engine detects abnormal volume and classifies a playbook", () => {
  const candles:any[]=[]; let price=100;
  for(let i=0;i<120;i++){
    const open=price; price+=i<100?0.06:0.10;
    candles.push({time:1700000000+i*300,open,high:price+0.15,low:open-0.12,close:price,volume:i===119?420000:100000+(i%7)*5000});
  }
  const quote:any={symbol:"TEST",price:price+0.02,open:100,high:price+0.2,low:99.8,previousClose:price-0.35,changePct:2.1,timestamp:new Date().toISOString(),source:"test"};
  const plan=analyzeLongSetup("TEST",quote,candles,"OPEN");
  assert.equal(plan.technicals?.abnormalVolume,true);
  assert.ok((plan.technicals?.volumeZScore??0)>=2);
  assert.notEqual(plan.playbook,"NONE");
});

test("adaptive learning waits for evidence and caps positive reward", async () => {
  const dir=`/tmp/trader-os-v21-learning-${process.pid}`; mkdirSync(dir,{recursive:true}); process.env.DATA_DIR=dir;
  const mk=(id:string,r:number)=>({id,journalId:`j${id}`,symbol:`S${id}`,playbook:"BREAKOUT",openedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),entry:10,stop:9,status:r>0?"WIN":"LOSS",realizedR:r});
  writeFileSync(`${dir}/decision-journal.json`,JSON.stringify({entries:[],shadowTrades:[mk("1",2),mk("2",1.5),mk("3",-1),mk("4",2.5),mk("5",1),mk("6",1.2),mk("7",.8),mk("8",1.4)]}));
  const {getAdaptiveLearningSnapshot}=await import("./learning.js");
  const stat=getAdaptiveLearningSnapshot().stats.BREAKOUT;
  assert.equal(stat.sampleSize,8);
  assert.ok(stat.adjustment>0);
  assert.ok(stat.adjustment<=0.35);
});


test("catalyst engine blocks critical negative headline risk", () => {
  const plan:any={symbol:"TEST",playbook:"BREAKOUT",eventRiskLocked:false,technicals:{relativeVolume:2.1,volumeZScore:2.5,gapPct:1.2,priceExpansionAtr:1.1}};
  const news:any={tone:"NEGATIVE",criticalNegative:true};
  const c=assessCatalyst(plan,news);
  assert.equal(c.blocksEntry,true);
  assert.equal(c.label,"BLOCKED");
});
