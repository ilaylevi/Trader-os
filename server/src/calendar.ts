import type { EventRisk } from "@trader-os/shared";
import { dataPath, isoNow, readJsonFile, uid, writeJsonFile } from "./store.js";

interface CalendarState { updatedAt?:string; earningsUpdatedAt?:string; officialMacroUpdatedAt?:string; earnings:EventRisk[]; macro:EventRisk[] }
const path=dataPath("event-calendar.json");
const empty:CalendarState={earnings:[],macro:[]};
const finnhubKey=(process.env.FINNHUB_API_KEY??"").trim();
const earningsTtlMs=Math.max(5*60_000,Number(process.env.EARNINGS_CALENDAR_CACHE_MS??30*60_000));
const macroTtlMs=Math.max(30*60_000,Number(process.env.OFFICIAL_MACRO_CALENDAR_CACHE_MS??6*60*60_000));
function state(){return readJsonFile<CalendarState>(path,empty)}
function daysFromNow(days:number){const d=new Date();d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function fresh(ts:string|undefined,ttl:number){return Boolean(ts&&Date.now()-Date.parse(ts)<ttl)}
function stripHtml(s:string){return s.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g," ").trim()}
async function fetchText(url:string){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),Number(process.env.OFFICIAL_CALENDAR_TIMEOUT_MS??10_000));try{const r=await fetch(url,{signal:ctl.signal,headers:{accept:"text/html,application/xhtml+xml","user-agent":"TraderOS/2.5 deterministic calendar"}});if(!r.ok)throw new Error(`calendar_http_${r.status}`);return await r.text()}finally{clearTimeout(timer)}}
function nyLocalToIso(dateText:string,timeText:string){const d=new Date(dateText);if(!Number.isFinite(d.getTime()))return undefined;const y=d.getUTCFullYear(),m=d.getUTCMonth()+1,day=d.getUTCDate();const mt=timeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);let hh=mt?Number(mt[1]):12,mm=mt?Number(mt[2]):0;if(mt){const ap=mt[3].toUpperCase();if(ap==="PM"&&hh<12)hh+=12;if(ap==="AM"&&hh===12)hh=0}let guess=Date.UTC(y,m-1,day,hh,mm);for(let i=0;i<2;i++){const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(guess));const val=(k:string)=>Number(parts.find(x=>x.type===k)?.value??0),shown=Date.UTC(val("year"),val("month")-1,val("day"),val("hour"),val("minute"));guess+=Date.UTC(y,m-1,day,hh,mm)-shown}return new Date(guess).toISOString()}

async function fetchFinnhubEarnings(from:string,to:string):Promise<EventRisk[]>{
  if(!finnhubKey)return[];
  const q=new URLSearchParams({from,to,token:finnhubKey});const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),10_000);
  try{const r=await fetch(`https://finnhub.io/api/v1/calendar/earnings?${q}`,{signal:ctl.signal,headers:{accept:"application/json"}});const text=await r.text();if(!r.ok)throw new Error(`Finnhub earnings ${r.status}: ${text.slice(0,240)}`);const body=JSON.parse(text) as {earningsCalendar?:Array<{date?:string;hour?:string;symbol?:string;epsEstimate?:number;revenueEstimate?:number;quarter?:number}>};
    return(body.earningsCalendar??[]).flatMap(x=>{if(!x.symbol||!x.date)return[];const hour=(x.hour??"").toLowerCase(),hhmm=hour.includes("bmo")?"08:00:00-04:00":hour.includes("amc")?"16:15:00-04:00":"12:00:00-04:00";return[{id:`earn_${x.symbol}_${x.date}`,type:"EARNINGS" as const,symbol:x.symbol.toUpperCase(),title:`${x.symbol.toUpperCase()} earnings${x.quarter?` Q${x.quarter}`:""}`,at:`${x.date}T${hhmm}`,impact:"HIGH" as const,source:"Finnhub earnings calendar",verified:true,details:[x.epsEstimate!=null?`EPS est ${x.epsEstimate}`:"",x.revenueEstimate!=null?`Revenue est ${x.revenueEstimate}`:"",hour||"time approximate"].filter(Boolean).join(" · ")}]} );
  }finally{clearTimeout(timer)}
}

async function fetchBlsMacro(year:number):Promise<EventRisk[]>{
  const html=await fetchText(`https://www.bls.gov/schedule/${year}/home.htm`),rows=[...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)],out:EventRisk[]=[];
  for(const row of rows){const cells=[...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>stripHtml(m[1]));if(cells.length<3)continue;const [date,time,...rest]=cells,release=rest.join(" ");const matched=[
    [/Consumer Price Index/i,"CPI — מדד המחירים לצרכן","HIGH"],
    [/Producer Price Index/i,"PPI — מדד המחירים ליצרן","HIGH"],
    [/Employment Situation/i,"NFP — דוח התעסוקה","HIGH"],
    [/Job Openings and Labor Turnover Survey/i,"JOLTS — משרות פתוחות","MEDIUM"],
  ].find(([re])=>(re as RegExp).test(release)) as [RegExp,string,"HIGH"|"MEDIUM"]|undefined;if(!matched)continue;const at=nyLocalToIso(date,time||"08:30 AM");if(!at)continue;out.push({id:`bls_${matched[1].split(" ")[0].toLowerCase()}_${at.slice(0,10)}`,type:"MACRO",title:matched[1],at,impact:matched[2],source:"U.S. Bureau of Labor Statistics — official release calendar",verified:true,details:release});
  }
  return out;
}

const months:Record<string,number>={January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12};
async function fetchFomcMacro(year:number):Promise<EventRisk[]>{
  const html=await fetchText("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"),plain=stripHtml(html),start=plain.indexOf(`${year} FOMC Meetings`),end=plain.indexOf(`${year+1} FOMC Meetings`,start+1),section=start>=0?plain.slice(start,end>start?end:start+15000):"",out:EventRisk[]=[];if(!section)return out;
  for(const [month,monthNo] of Object.entries(months)){const re=new RegExp(`${month}\\s+(\\d{1,2})(?:\\s*[-–]\\s*(\\d{1,2}))?`,'i'),m=section.match(re);if(!m)continue;const day=Number(m[2]??m[1]),dateText=`${month} ${day}, ${year}`,at=nyLocalToIso(dateText,"2:00 PM");if(!at)continue;out.push({id:`fomc_${year}_${String(monthNo).padStart(2,"0")}_${String(day).padStart(2,"0")}`,type:"MACRO",title:"FOMC — החלטת ריבית",at,impact:"HIGH",source:"Federal Reserve — official FOMC calendar",verified:true,details:`ישיבת FOMC ${m[1]}${m[2]?`-${m[2]}`:""} ${month} ${year}; החלטה משוערת ל-14:00 שעון ניו-יורק ביום האחרון.`})}
  return out;
}

export async function refreshEarningsCalendar(force=false){const s=state();if(!force&&fresh(s.earningsUpdatedAt,earningsTtlMs))return s;try{s.earnings=await fetchFinnhubEarnings(daysFromNow(-1),daysFromNow(7));s.earningsUpdatedAt=isoNow();s.updatedAt=isoNow();writeJsonFile(path,s)}catch(error){if(!s.earningsUpdatedAt)throw error}return s}
export async function refreshOfficialMacroCalendar(force=false){const s=state();if(!force&&fresh(s.officialMacroUpdatedAt,macroTtlMs))return s;const year=new Date().getUTCFullYear(),official:EventRisk[]=[];const errors:string[]=[];for(const fn of [()=>fetchBlsMacro(year),()=>fetchFomcMacro(year)]){try{official.push(...await fn())}catch(e){errors.push(e instanceof Error?e.message:String(e))}}if(official.length){const manual=s.macro.filter(x=>!x.source.includes("official release calendar")&&!x.source.includes("official FOMC calendar"));s.macro=[...manual,...official].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));s.officialMacroUpdatedAt=isoNow();s.updatedAt=isoNow();writeJsonFile(path,s)}else if(!s.officialMacroUpdatedAt&&errors.length)throw new Error(`official_macro_calendar_unavailable: ${errors.join(" | ")}`);return s}
export async function refreshAllCalendars(force=false){await Promise.allSettled([refreshEarningsCalendar(force),refreshOfficialMacroCalendar(force)]);return getCachedCalendar()}
export function addMacroEvent(input:{title:string;at:string;impact?:"LOW"|"MEDIUM"|"HIGH";details?:string}){if(!input.title?.trim())throw new Error("title_required");if(!Number.isFinite(Date.parse(input.at)))throw new Error("valid_event_timestamp_required");const s=state(),e:EventRisk={id:uid("macro"),type:"MACRO",title:input.title.trim(),at:new Date(input.at).toISOString(),impact:input.impact??"HIGH",source:"manual/configured calendar",verified:true,details:input.details};s.macro.push(e);s.macro.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));s.updatedAt=isoNow();writeJsonFile(path,s);return e}
export function removeMacroEvent(id:string){const s=state();s.macro=s.macro.filter(x=>x.id!==id);s.updatedAt=isoNow();writeJsonFile(path,s);return{ok:true}}
export async function getEventCalendar(options:{refreshEarnings?:boolean;refreshMacro?:boolean}={}){if(options.refreshEarnings)await refreshEarningsCalendar(true);else await refreshEarningsCalendar(false);if(options.refreshMacro)await refreshOfficialMacroCalendar(true).catch(()=>{});else await refreshOfficialMacroCalendar(false).catch(()=>{});const s=state(),now=Date.now(),decorate=(e:EventRisk):EventRisk=>({...e,minutesAway:Math.round((Date.parse(e.at)-now)/60000)});return{...s,earnings:s.earnings.map(decorate),macro:s.macro.map(decorate),externalAi:false}}
export function getCachedCalendar(){const s=state(),now=Date.now(),decorate=(e:EventRisk):EventRisk=>({...e,minutesAway:Math.round((Date.parse(e.at)-now)/60000)});return{...s,earnings:s.earnings.map(decorate),macro:s.macro.map(decorate)}}
export function eventRisksFor(symbol:string,now=new Date()):EventRisk[]{const s=getCachedCalendar(),sym=symbol.toUpperCase(),t=now.getTime(),earningsLockH=Math.max(1,Number(process.env.EVENT_LOCK_EARNINGS_HOURS??24)),macroLockM=Math.max(15,Number(process.env.EVENT_LOCK_MACRO_MINUTES??90));return[...s.earnings.filter(e=>e.symbol===sym),...s.macro].map(e=>{const mins=Math.round((Date.parse(e.at)-t)/60000),future=mins>=0,blocks=e.type==="EARNINGS"?future&&mins<=earningsLockH*60:e.type==="MACRO"?future&&e.impact==="HIGH"&&mins<=macroLockM:false;return{...e,minutesAway:mins,blocksEntry:blocks}}).filter(e=>(e.minutesAway??0)>=-180&&(e.minutesAway??0)<=7*24*60).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))}
