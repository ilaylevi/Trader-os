import type { PlaybookId } from "@trader-os/shared";
import { getClosedTrades } from "./portfolio.js";
import { getShadowTrades } from "./journal.js";

export interface PlaybookLearningStat {
  playbook: PlaybookId | string;
  sampleSize: number;
  realSamples: number;
  shadowSamples: number;
  effectiveSamples: number;
  wins: number;
  losses: number;
  winRate: number;
  avgR: number;
  wilsonLowerPct: number;
  adjustment: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  note: string;
}
interface Obs { r:number; weight:number; at?:string; real:boolean }
function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,n))}
function round(n:number,d=2){return Number(n.toFixed(d))}
function recencyWeight(at:string|undefined,base:number){if(!at)return base;const ageDays=Math.max(0,(Date.now()-Date.parse(at))/86400000);return base*Math.pow(.5,ageDays/120)}
function wilsonLower(successes:number,n:number,z=1.64){if(n<=0)return 0;const phat=successes/n,z2=z*z,den=1+z2/n,center=phat+z2/(2*n),margin=z*Math.sqrt((phat*(1-phat)+z2/(4*n))/n);return Math.max(0,(center-margin)/den)}

export function getAdaptiveLearningSnapshot(){
  const rows = new Map<string, Obs[]>();
  // Shadow trades are useful evidence, but deliberately count only half as much as real trades.
  for (const t of getShadowTrades()) {
    if ((t.purpose??"STRATEGY")!=="STRATEGY") continue;
    if (!['WIN','LOSS','EXPIRED'].includes(t.status) || typeof t.realizedR !== 'number') continue;
    const k=t.playbook??'NONE',a=rows.get(k)??[];a.push({r:t.realizedR,weight:recencyWeight(t.closedAt??t.openedAt,.5),at:t.closedAt??t.openedAt,real:false});rows.set(k,a);
  }
  for (const t of getClosedTrades()) {
    if (typeof t.realizedR !== 'number') continue;
    if(t.closureSource==="LEVEL_MONITOR"&&t.brokerExecutionConfirmed===false) continue;
    const k=t.playbook??'NONE',a=rows.get(k)??[];a.push({r:t.realizedR,weight:recencyWeight(t.closedAt??t.openedAt,1),at:t.closedAt??t.openedAt,real:true});rows.set(k,a);
  }
  const stats:Record<string,PlaybookLearningStat>={};
  for (const [playbook,obs] of rows) {
    const sampleSize=obs.length,realSamples=obs.filter(x=>x.real).length,shadowSamples=sampleSize-realSamples,w=obs.reduce((s,x)=>s+x.weight,0),weightedWins=obs.filter(x=>x.r>0).reduce((s,x)=>s+x.weight,0),weightedR=obs.reduce((s,x)=>s+x.r*x.weight,0);
    const wins=obs.filter(x=>x.r>0).length,losses=obs.filter(x=>x.r<0).length,winRate=w?weightedWins/w*100:0,avgR=w?weightedR/w:0,wilson=wilsonLower(wins,sampleSize)*100;
    let adjustment=0;
    // Adapt only after a meaningful sample. Positive adaptation needs stronger evidence than a penalty.
    if(sampleSize>=8&&w>=3.5){
      const raw=(avgR*.22)+((winRate-50)/50)*.22;
      if(raw>0&&avgR>0&&wilson>=42)adjustment=clamp(raw,0,.35);
      else if(raw<0||avgR<0||winRate<45)adjustment=clamp(Math.min(raw,-.08),-.75,0);
    }
    const confidence=sampleSize>=25&&realSamples>=8?'HIGH':sampleSize>=12&&realSamples>=3?'MEDIUM':'LOW';
    const note=sampleSize<8?'המדגם עדיין קטן; אין שינוי בדירוג.':adjustment>0?'יתרון שנמדד לאורך זמן מוסיף בונוס קטן ומוגבל.':adjustment<0?'חולשה שנמדדה מחמירה את הדירוג.':'אין כרגע התאמה סטטיסטית לציון.';
    stats[playbook]={playbook,sampleSize,realSamples,shadowSamples,effectiveSamples:round(w,1),wins,losses,winRate:round(winRate,1),avgR:round(avgR),wilsonLowerPct:round(wilson,1),adjustment:round(adjustment),confidence,note};
  }
  return {generatedAt:new Date().toISOString(),engine:'ADAPTIVE_DETERMINISTIC',minimumSamples:8,shadowWeight:.5,recencyHalfLifeDays:120,rewardCap:.35,penaltyCap:-.75,stats};
}
export function learningAdjustmentFor(playbook?:PlaybookId){if(!playbook||playbook==='NONE')return{adjustment:0,sampleSize:0};const s=getAdaptiveLearningSnapshot().stats[playbook];return s?{adjustment:s.adjustment,sampleSize:s.sampleSize}:{adjustment:0,sampleSize:0}}
