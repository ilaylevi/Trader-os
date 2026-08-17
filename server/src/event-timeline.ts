import { getSecCompanyIntelligence, getFundamentalTrend } from "./sec-intelligence.js";
import { getAlpacaCorporateActions } from "./alpaca-free.js";
import { getEarningsIntelligence } from "./earnings-intelligence.js";
import { getWarehouseBars } from "./market-warehouse.js";

function isoDay(x?:string){if(!x)return undefined;const d=new Date(x);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):undefined}
function pct(a:number,b:number){return b?Number(((a/b-1)*100).toFixed(2)):0}
export async function buildEventTimeline(symbol:string,force=false){
  const sym=symbol.trim().toUpperCase();
  const [sec,actions,earnings,trend]=await Promise.all([
    getSecCompanyIntelligence(sym,force),
    getAlpacaCorporateActions(sym,180,60).catch(()=>({configured:false,actions:[]} as any)),
    getEarningsIntelligence(sym).catch(()=>undefined),
    getFundamentalTrend(sym,force)
  ]);
  const events:any[]=[];
  for(const f of sec.filings)events.push({at:f.filingDate,type:`SEC_${f.form}`,label:f.label,severity:f.severity,tone:f.tone,source:"SEC EDGAR",details:f.details});
  for(const a of actions.actions??[])events.push({at:a.exDate??a.recordDate??a.processDate,type:`CORPORATE_${a.type}`,label:`Corporate Action: ${a.type}`,severity:"MEDIUM",tone:"NEUTRAL",source:"Alpaca corporate actions",details:a.ratio?`Ratio ${a.ratio}`:a.cash?`Cash ${a.cash}`:"אירוע תאגידי שדורש התאמת נתונים/רמות."});
  for(const e of earnings?.history??[])events.push({at:e.date,type:"EARNINGS",label:"דוחות כספיים",severity:"MEDIUM",tone:(e.epsSurprisePct??0)>0?"POSITIVE":(e.epsSurprisePct??0)<0?"RISK":"NEUTRAL",source:"Finnhub earnings",details:`EPS surprise ${e.epsSurprisePct??"—"}% · Revenue surprise ${e.revenueSurprisePct??"—"}%`});
  const next=(earnings as any)?.next;if(next?.date)events.push({at:next.date,type:"EARNINGS_UPCOMING",label:"דוחות קרובים",severity:"HIGH",tone:"NEUTRAL",source:"Finnhub earnings",details:`דוחות צפויים ${next.date}`});
  events.sort((a,b)=>Date.parse(String(a.at??0))-Date.parse(String(b.at??0)));
  const bars=getWarehouseBars(sym,"1d",5000),byDay=new Map(bars.map((b,i)=>[new Date(b.time*1000).toISOString().slice(0,10),i]));
  const reaction:any={};
  for(const ev of events){const day=isoDay(ev.at),i=day?byDay.get(day):undefined;if(i===undefined||i<0)continue;const b=bars[i],d1=bars[i+1],d2=bars[i+2];if(!b)continue;const key=String(ev.type).replace(/SEC_.*/,"SEC").replace(/CORPORATE_.*/,"CORPORATE"),r=reaction[key]??{n:0,d1:[],d2:[]};r.n++;if(d1)r.d1.push(pct(d1.close,b.close));if(d2)r.d2.push(pct(d2.close,b.close));reaction[key]=r}
  const med=(a:number[])=>{if(!a.length)return undefined;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return Number((s.length%2?s[m]:(s[m-1]+s[m])/2).toFixed(2))};
  const reactions=Object.fromEntries(Object.entries(reaction).map(([k,v]:any)=>[k,{n:v.n,medianDay1Pct:med(v.d1),medianDay2Pct:med(v.d2)}]));
  return{symbol:sym,generatedAt:new Date().toISOString(),events:events.slice(-80),fundamentalTrend:trend,reactions};
}
