import type { TradePlan } from "@trader-os/shared";
import type { NewsSignal } from "./news.js";

export interface CatalystAssessment {
  score: number;
  label: "STRONG_POSITIVE" | "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "BLOCKED";
  blocksEntry: boolean;
  drivers: string[];
}
function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,n))}

export function assessCatalyst(plan:TradePlan, news?:NewsSignal):CatalystAssessment {
  let score=0; const drivers:string[]=[];
  if(news?.tone==="POSITIVE"){score+=2;drivers.push("כותרת חברה חיובית שזוהתה");}
  if(news?.tone==="NEGATIVE"){score-=2;drivers.push("כותרת חברה שלילית שזוהתה");}
  if(news?.criticalNegative){score-=6;drivers.push("כותרת שלילית קריטית");}
  if((plan.technicals?.volumeZScore??0)>=2){score+=2;drivers.push(`נפח חריג, Z=${plan.technicals?.volumeZScore}`);}
  else if((plan.technicals?.relativeVolume??0)>=1.5){score+=1;drivers.push(`נפח יחסי ${plan.technicals?.relativeVolume}x`);}
  if((plan.technicals?.gapPct??0)>=2){score+=1;drivers.push(`גאפ חיובי ${plan.technicals?.gapPct}%`);}
  if((plan.technicals?.priceExpansionAtr??0)>=3){score-=2;drivers.push(`מחיר מורחב ${plan.technicals?.priceExpansionAtr} ATR`);}
  if(plan.playbook&&plan.playbook!=="NONE"){score+=1;drivers.push(`תבנית ${plan.playbook}`);}
  if(plan.eventRiskLocked){score-=5;drivers.push("חסימת סיכון אירוע");}
  const blocksEntry=Boolean(news?.criticalNegative||plan.eventRiskLocked);
  score=clamp(score,-10,10);
  const label:CatalystAssessment["label"]=blocksEntry?"BLOCKED":score>=4?"STRONG_POSITIVE":score>=2?"POSITIVE":score<=-2?"NEGATIVE":"NEUTRAL";
  return{score,label,blocksEntry,drivers};
}
