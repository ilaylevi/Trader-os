import type { AutomationStatus, MarketSession, TradePlan, TriggerRule } from "@trader-os/shared";
import { emitAlert } from "./alerts.js";
import { refreshAllCalendars } from "./calendar.js";
import { getShadowTrades, recordTradePlanDecision, updateShadowWithQuote } from "./journal.js";
import { addToWatchlist, closeTradeFromLevel, getActiveTrades, getWatchlist, recordStopHit, recordTp1, recordTp2Hit, setThesisStatus, updateTrade, updateTradeMarket } from "./portfolio.js";
import { getCurrentMarketStatus, getQuote, runMarketScan } from "./trader.js";
import { getNewsSignal } from "./news.js";
import { assessCatalyst } from "./catalyst.js";
import { evaluatePreTradeGate } from "./pretrade-gate.js";
import { dataPath, isoDay, isoNow, readJsonFile, uid, writeJsonFile } from "./store.js";
import { getLivePriceStatus, onLivePrice, setLiveSymbols, startLivePrices, type LivePricePoint } from "./live-prices.js";
import { monitorAllOpenTradeTheses } from "./thesis-monitor.js";
import { buildAdvancedDecision } from "./reasoning-engine.js";

interface AutomationState { day:string; status:AutomationStatus & {lastThesisCheckAt?:string}; triggerRules:TriggerRule[]; lastBackgroundScan?:any; seenTriggers:Record<string,string> }
const path=dataPath("automation-state.json");
const envEnabled=(process.env.AUTOMATION_ENABLED??"true").toLowerCase()!=="false";
let runtimeEnabled=envEnabled;
const scanInterval=Math.max(2,Number(process.env.SCAN_INTERVAL_MINUTES??10))*60_000;
const preInterval=Math.max(5,Number(process.env.PREMARKET_SCAN_INTERVAL_MINUTES??20))*60_000;
const triggerInterval=Math.max(30,Number(process.env.TRIGGER_POLL_SECONDS??60))*1000;
const scanAfterHours=(process.env.AFTER_HOURS_SCAN_ENABLED??"false").toLowerCase()==="true";
const autoWatch=(process.env.AUTO_WATCHLIST_FROM_SCANNER??"true").toLowerCase()!=="false";
const alertScore=Math.max(5,Math.min(10,Number(process.env.BACKGROUND_ALERT_SETUP_SCORE??7.5)));
const tickMs=Math.max(10_000,Math.min(30_000,Number(process.env.AUTOMATION_TICK_MS??15_000)));
let timer:NodeJS.Timeout|undefined,running=false,liveListenerInstalled=false;
const autoCloseStop=(process.env.AUTO_CLOSE_TRACKER_ON_STOP??"true").toLowerCase()!=="false";
const autoCloseTp2=(process.env.AUTO_CLOSE_TRACKER_ON_TP2??"true").toLowerCase()!=="false";
const livePersistMs=Math.max(1000,Number(process.env.LIVE_TRADE_STATE_UPDATE_MS??5000));
const liveTradeMonitorEnabled=(process.env.LIVE_TRADE_MONITOR_ENABLED??"true").toLowerCase()!=="false";
const lastPersist=new Map<string,number>();
const thesisBackground=(process.env.THESIS_MONITOR_BACKGROUND_ENABLED??"true").toLowerCase()!=="false";
const thesisInterval=Math.max(5,Number(process.env.THESIS_MONITOR_INTERVAL_MINUTES??15))*60_000;
function emptyState():AutomationState{return{day:isoDay(),status:{enabled:runtimeEnabled,scansToday:0,strategyValidationsToday:0,alertsToday:0},triggerRules:[],seenTriggers:{}}}
function load(){const s=readJsonFile<AutomationState>(path,emptyState());if(s.day!==isoDay()){s.day=isoDay();s.status.scansToday=0;s.status.strategyValidationsToday=0;s.status.alertsToday=0;s.seenTriggers={}}return s}
function save(s:AutomationState){return writeJsonFile(path,s)}

function localSession():MarketSession{const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());const val=(t:string)=>parts.find(p=>p.type===t)?.value??"",wd=val("weekday");if(["Sat","Sun"].includes(wd))return"CLOSED";const mins=Number(val("hour"))*60+Number(val("minute"));if(mins>=4*60&&mins<9*60+30)return"PRE";if(mins>=9*60+30&&mins<16*60)return"OPEN";if(mins>=16*60&&mins<20*60)return"AFTER";return"CLOSED"}
function due(ts:string|undefined,interval:number){return!ts||Date.now()-Date.parse(ts)>=interval}
async function alert(input:Parameters<typeof emitAlert>[0],s:AutomationState){const a=await emitAlert(input);if(a)s.status.alertsToday++;return a}

function px(v:number|undefined){return v==null?"—":`$${Number(v).toFixed(2)}`}
function rr(v:number|undefined){return v==null?"—":`1:${Number(v).toFixed(2)}`}
function tradeLevelsText(t:TradePlan|any){return `כניסה ${px(t.entry)} · סטופ ${px(t.stop)} · יעד 1 ${px(t.tp1)} · יעד 2 ${px(t.tp2)} · R:R ${rr(t.riskReward)}`}
function setupWhy(t:TradePlan|any){const x=t.technicals;return [`תבנית: ${t.playbook??"לא זוהתה"}`,`ציון: ${t.setupScore??"—"}/10`,t.context?.relativeStrengthGrade?`חוזק יחסי: ${t.context.relativeStrengthGrade}`:undefined,x?.relativeVolume!=null?`RVOL: ${x.relativeVolume}x`:undefined,x?.timeframeAlignmentPct!=null?`התאמת טווחים: ${x.timeframeAlignmentPct}%`:undefined,t.levelQuality?`איכות רמות: ${t.levelQuality}`:undefined].filter(Boolean).join(" · ")}
function richMessage(lines:Array<string|undefined>){return lines.filter(Boolean).join("\n")}

function syncLiveTracking(){
  const s=load(),symbols=[...getActiveTrades().map(x=>x.symbol),...getWatchlist().map(x=>x.symbol),...s.triggerRules.filter(x=>x.active).map(x=>x.symbol),...(s.lastBackgroundScan?.candidates??[]).slice(0,8).map((x:any)=>x.symbol)];
  return setLiveSymbols([...new Set(symbols)]);
}
function crossedSide(side:"LONG"|"SHORT",kind:"ENTRY"|"STOP"|"TP",price:number,level:number){if(side==="LONG")return kind==="STOP"?price<=level:price>=level;return kind==="STOP"?price>=level:price<=level}
async function processTradePrice(symbol:string,price:number,s:AutomationState){
  const trades=getActiveTrades().filter(x=>x.symbol===symbol);
  for(const t of trades){
    if(t.executionState==="PLANNED"){
      if(t.entry&&crossedSide(t.side,"ENTRY",price,t.entry)&&t.status!=="TRIGGERED"){updateTrade(t.id,{status:"TRIGGERED",current:price});await alert({severity:"TRIGGERED",title:`${symbol} — מחיר הכניסה של התוכנית הופעל`,message:richMessage([`מה קרה: המחיר החי ${px(price)} הגיע לרמת הכניסה ${px(t.entry)}.`,`רמות העסקה: ${tradeLevelsText(t)}`,`מצב: זו עדיין תוכנית בלבד — Trader OS לא מניחה שבוצע Fill בברוקר.`,`מה לעשות עכשיו: אם נכנסת בפועל, רשום את מחיר ה-Fill והכמות בחדר העסקה כדי להתחיל מעקב אמיתי.`]),symbol,tradeId:t.id,dedupeKey:`planned-entry:${t.id}:${t.entry}`},s)}
      continue;
    }
    const now=Date.now(),last=lastPersist.get(t.id)??0;if(now-last>=livePersistMs){updateTradeMarket(t.id,price);lastPersist.set(t.id,now)}
    if(t.autoLevelManagement===false)continue;
    if(t.stop&&crossedSide(t.side,"STOP",price,t.stop)){
      recordStopHit(t.id,price);setThesisStatus(t.id,"INVALIDATED","מחיר חי חצה את רמת הסטופ של העסקה.");
      if(autoCloseStop){closeTradeFromLevel(t.id,price,"STOP_HIT",t.stop);await alert({severity:"STOP_HIT",title:`${symbol} — סטופ נפגע והמעקב נסגר אוטומטית`,message:richMessage([`מה קרה: המחיר החי ${px(price)} חצה את הסטופ ${px(t.stop)}.`,`כניסה מקורית: ${px(t.entry)} · כמות שנותרה: ${t.quantity}.`,`למה זה חשוב: התזה הוגדרה כלא תקפה והמעקב המקומי נסגר כדי שלא תישאר עסקה פתוחה במערכת.`,`מה לעשות עכשיו: בדוק את הביצוע ב-IBI ואמת את מחיר היציאה בפועל. רק לאחר האימות התוצאה תיכנס ללמידה כעסקה אמיתית.`]),symbol,tradeId:t.id,dedupeKey:`auto-stop-close:${t.id}:${t.stop}`},s)}else await alert({severity:"STOP_HIT",title:`${symbol} — רמת הסטופ נפגעה`,message:richMessage([`מה קרה: המחיר החי ${px(price)} חצה את הסטופ ${px(t.stop)}.`,`רמות העסקה: ${tradeLevelsText(t)}`,`סגירת המעקב האוטומטית כבויה.`,`פעולה מומלצת: בדוק מיד אם הוראת הסטופ בברוקר בוצעה ועדכן את Trader OS.`]),symbol,tradeId:t.id,dedupeKey:`stop-hit:${t.id}:${t.stop}`},s);
      continue;
    }
    if(t.tp2&&crossedSide(t.side,"TP",price,t.tp2)){
      if(t.tp1&&!t.tp1HitAt&&crossedSide(t.side,"TP",price,t.tp1))recordTp1(t.id,price);
      recordTp2Hit(t.id,price);
      if(autoCloseTp2){closeTradeFromLevel(t.id,price,"TP2_HIT",t.tp2);await alert({severity:"TP_HIT",title:`${symbol} — יעד 2 הושג והמעקב נסגר`,message:richMessage([`מה קרה: המחיר החי ${px(price)} הגיע ליעד 2 ${px(t.tp2)}.`,`רמות העסקה: ${tradeLevelsText(t)}`,`המעקב המקומי נסגר בהצלחה.`,`מה לעשות עכשיו: אמת ב-IBI את מחיר המימוש/היציאה בפועל כדי לחשב P&L ו-R אמיתיים.`]),symbol,tradeId:t.id,dedupeKey:`auto-tp2-close:${t.id}:${t.tp2}`},s)}else await alert({severity:"TP_HIT",title:`${symbol} — יעד 2 הושג`,message:richMessage([`מה קרה: המחיר החי ${px(price)} הגיע ליעד 2 ${px(t.tp2)}.`,`רמות העסקה: ${tradeLevelsText(t)}`,`סגירה אוטומטית כבויה — בדוק את הפוזיציה בברוקר והחלט אם לסגור/לנהל את היתרה.`]),symbol,tradeId:t.id,dedupeKey:`tp2-hit:${t.id}:${t.tp2}`},s);
      continue;
    }
    if(t.tp1&&!t.tp1HitAt&&crossedSide(t.side,"TP",price,t.tp1)){
      recordTp1(t.id,price);await alert({severity:"TP_HIT",title:`${symbol} — יעד 1 הושג`,message:richMessage([`מה קרה: המחיר החי ${px(price)} הגיע ליעד 1 ${px(t.tp1)}.`,`כניסה ${px(t.entry)} · סטופ ${px(t.stop)} · יעד 2 ${px(t.tp2)}.`,`האירוע סומן בחדר העסקה, אבל לא נרשם מימוש אמיתי בלי אישור שלך.`,`מה לעשות עכשיו: בדוק אם מימשת חלק מהפוזיציה; אם כן רשום מימוש חלקי ושקול ניהול סטופ לפי התוכנית.`]),symbol,tradeId:t.id,dedupeKey:`tp1-live:${t.id}:${t.tp1}`},s)
    }
  }
}
async function processRulePrice(symbol:string,price:number,s:AutomationState){
  const rules=[...dynamicRules(),...s.triggerRules.filter(x=>x.active)].filter(r=>r.symbol===symbol);
  for(const r of rules){if(r.tradeId&&r.id.startsWith("dyn_"))continue;if(!crossed(r,price))continue;const key=`rule:${r.id}:${r.price}`;if(s.seenTriggers[key])continue;s.seenTriggers[key]=isoNow();if(!r.id.startsWith("dyn_")){const stored=s.triggerRules.find(x=>x.id===r.id);if(stored){stored.firedAt=isoNow();stored.active=false}}await alert({severity:severity(r),title:`${r.symbol} — ${r.kind==="ENTRY_ABOVE"||r.kind==="ENTRY_BELOW"?"טריגר כניסה":r.kind==="STOP"?"סטופ":r.kind==="TP1"?"יעד 1":r.kind==="TP2"?"יעד 2":"טריגר מעקב"}`,message:richMessage([`מה קרה: המחיר החי ${px(price)} חצה את רמת הטריגר ${px(r.price)}.`,r.note?`למה חיכינו: ${r.note}`:undefined,`סוג הטריגר: ${r.kind}.`,`מה לעשות עכשיו: פתח את המניה/חדר העסקה ובצע בדיקת כניסה או ניהול לפי סוג הטריגר.`]),symbol:r.symbol,tradeId:r.tradeId,dedupeKey:key},s)}
}
async function handleLivePoint(point:LivePricePoint){if(!runtimeEnabled&&!liveTradeMonitorEnabled)return;const s=load();try{if(liveTradeMonitorEnabled)await processTradePrice(point.symbol,point.price,s);if(runtimeEnabled)await processRulePrice(point.symbol,point.price,s);s.status.lastTriggerPollAt=isoNow();save(s)}catch(error){s.status.lastError=error instanceof Error?error.message:String(error);save(s)}}
function installLiveListener(){if(liveListenerInstalled)return;liveListenerInstalled=true;onLivePrice(p=>handleLivePoint(p));startLivePrices();syncLiveTracking()}

export async function runBackgroundScanNow(){
  const s=load();
  try{
    const scan=await runMarketScan(true);
    s.status.lastScanAt=isoNow();s.status.lastScanId=scan.scanId;s.status.scansToday++;s.status.session=scan.market.status;s.lastBackgroundScan=scan;
    const top=(scan.candidates as TradePlan[]).filter(x=>(x.dataQualityPct??0)>=75&&x.playbook!=="NONE"&&x.entry&&x.stop&&x.tp1&&x.tp2&&x.levelQuality!=="NONE"&&(x.riskReward??0)>=2&&x.setupScore>=6.5).sort((a,b)=>(b.convictionScore??b.setupScore*10)-(a.convictionScore??a.setupScore*10)).slice(0,3);
    for(const raw of top){
      const news=await getNewsSignal(raw.symbol,false),catalyst=assessCatalyst(raw,news),gate=evaluatePreTradeGate(raw,scan.market.status,{headlineCritical:news.criticalNegative,catalystBlocked:catalyst.blocksEntry});
      let best:any={...raw,verdict:gate.verdict,portfolioGatePassed:gate.gates.portfolioCapacity&&gate.gates.sectorCapacity,portfolioGateReason:gate.blockers.find(x=>x.includes("תיק")||x.includes("סקטור"))};
      try{const advanced=await buildAdvancedDecision(best,best.convictionScore??best.setupScore*10,top.indexOf(raw)<2);best={...best,advancedDecision:advanced,verdict:advanced.judgeVerdict==="ENTER"?"ENTER":advanced.judgeVerdict==="ARMED"||advanced.judgeVerdict==="WAIT"?"WAIT":"NO_ENTRY"}}catch{}
      recordTradePlanDecision(best,"BACKGROUND");
      if(autoWatch&&best.entry&&gate.verdict!=="NO_ENTRY"&&["ARMED","TRIGGERED"].includes(best.status)) addToWatchlist(best.symbol,`נוסף אוטומטית מהסריקה · תבנית ${best.playbook??"לא ידועה"} · ציון ${best.setupScore}`,"scanner",{triggerPrice:best.entry,triggerType:"ABOVE",reason:best.thesis});
      if(best.setupScore>=alertScore&&gate.verdict==="ENTER") await alert({severity:"TRIGGERED",title:`${best.symbol} — טריגר עבר Pre-Trade Gate מלא`,message:richMessage([`פסק דין: תנאי הכניסה עברו את ה-Pre-Trade Gate המלא.`,`למה היא מעניינת: ${setupWhy(best)}`,`רמות: ${tradeLevelsText(best)}`,`תזה: ${best.thesis}`,`חדשות/אירועים: ${news.criticalNegative?"קיימת אזהרה קריטית":"לא זוהתה חסימה קריטית"}. קטליזטור: ${catalyst.label}.`,`מה לעשות עכשיו: פתח את בדיקת הכניסה ואמת שהמחיר עדיין בתוך אזור הכניסה ולא עבר את כלל No-Chase.`]),symbol:best.symbol,dedupeKey:`scan_trigger:${best.symbol}:${best.entry}`},s);
      else if(best.setupScore>=alertScore&&best.status==="ARMED"&&gate.verdict!=="NO_ENTRY") await alert({severity:"ARMED",title:`${best.symbol} — סט-אפ איכותי ממתין לטריגר`,message:richMessage([`פסק דין: הסט-אפ איכותי אך עדיין אינו טריגר לביצוע.`,`למה היא מעניינת: ${setupWhy(best)}`,`רמות: ${tradeLevelsText(best)}`,`למה מחכים: ${best.trigger??`הגעה לרמת הכניסה ${px(best.entry)}`}`,`תזה: ${best.thesis}`,`מה לעשות עכשיו: אין לרדוף אחרי המחיר. המערכת תמשיך לעקוב ותתריע אם הטריגר יאושר.`]),symbol:best.symbol,dedupeKey:`scan_armed:${best.symbol}:${best.entry}`},s);
      s.status.strategyValidationsToday++;
    }
    save(s);syncLiveTracking();return scan;
  }catch(error){s.status.lastError=error instanceof Error?error.message:String(error);save(s);throw error}
}

function dynamicRules():TriggerRule[]{const out:TriggerRule[]=[];for(const t of getActiveTrades()){if(t.executionState==="PLANNED"&&t.entry)out.push({id:`dyn_entry_${t.id}`,symbol:t.symbol,kind:t.side==="LONG"?"ENTRY_ABOVE":"ENTRY_BELOW",price:t.entry,active:true,createdAt:t.openedAt,tradeId:t.id});if(t.stop)out.push({id:`dyn_stop_${t.id}`,symbol:t.symbol,kind:"STOP",price:t.stop,active:true,createdAt:t.openedAt,tradeId:t.id});if(t.tp1)out.push({id:`dyn_tp1_${t.id}`,symbol:t.symbol,kind:"TP1",price:t.tp1,active:true,createdAt:t.openedAt,tradeId:t.id});if(t.tp2)out.push({id:`dyn_tp2_${t.id}`,symbol:t.symbol,kind:"TP2",price:t.tp2,active:true,createdAt:t.openedAt,tradeId:t.id})}for(const w of getWatchlist())if(w.triggerPrice&&w.triggerType)out.push({id:`dyn_watch_${w.symbol}`,symbol:w.symbol,kind:w.triggerType==="ABOVE"?"WATCH_ABOVE":"WATCH_BELOW",price:w.triggerPrice,active:true,createdAt:w.addedAt,note:w.note});return out}
function crossed(rule:TriggerRule,price:number){return["ENTRY_ABOVE","WATCH_ABOVE","TP1","TP2"].includes(rule.kind)?price>=rule.price:price<=rule.price}
function severity(rule:TriggerRule){return rule.kind==="STOP"?"STOP_HIT" as const:rule.kind==="TP1"||rule.kind==="TP2"?"TP_HIT" as const:rule.kind.startsWith("ENTRY")?"TRIGGERED" as const:"WATCH" as const}

export async function pollTriggersNow(){
  const s=load(),rules=[...dynamicRules(),...s.triggerRules.filter(x=>x.active)],shadowSymbols=getShadowTrades().filter(x=>["PENDING_TRIGGER","OPEN"].includes(x.status)).map(x=>x.symbol),symbols=[...new Set([...rules.map(x=>x.symbol),...shadowSymbols])],quotes=new Map<string,any>();
  await Promise.all(symbols.slice(0,50).map(async symbol=>{try{quotes.set(symbol,await getQuote(symbol))}catch{}}));
  for(const [symbol,q] of quotes){for(const shadow of updateShadowWithQuote(q))void shadow;await processTradePrice(symbol,q.price,s);await processRulePrice(symbol,q.price,s)}
  s.status.lastTriggerPollAt=isoNow();save(s);syncLiveTracking();return{quotes:Object.fromEntries(quotes),rulesChecked:rules.length,live:getLivePriceStatus()}
}

export async function refreshCalendarsNow(force=false){const s=load();await refreshAllCalendars(force);s.status.lastCalendarRefreshAt=isoNow();save(s);return{ok:true,at:s.status.lastCalendarRefreshAt,externalAi:false}}
async function tick(){if(!runtimeEnabled||running)return;running=true;const s=load();try{syncLiveTracking();const session=localSession();s.status.session=session;
  const interval=session==="PRE"?preInterval:scanInterval;if((session==="OPEN"||session==="PRE"||(session==="AFTER"&&scanAfterHours))&&due(s.status.lastScanAt,interval))await runBackgroundScanNow();if((session==="OPEN"||session==="PRE"||session==="AFTER")&&due(s.status.lastTriggerPollAt,triggerInterval))await pollTriggersNow();if(due(s.status.lastCalendarRefreshAt,30*60_000))await refreshCalendarsNow(false);if(thesisBackground&&session==="OPEN"&&due(s.status.lastThesisCheckAt,thesisInterval)){const result=await monitorAllOpenTradeTheses(true);const rows=result.rows;s.status.lastThesisCheckAt=isoNow();for(const m of rows.filter(x=>x.status!=="VALID")){await alert({severity:m.status==="INVALIDATED"?"RISK":"INFO",title:`${m.symbol} — ${m.status==="INVALIDATED"?"התזה נפסלה":"התזה נחלשת"}`,message:richMessage([m.recommendedAction,...m.reasons,`ציון תזה: ${m.score}/100`]),symbol:m.symbol,tradeId:m.tradeId,dedupeKey:`thesis:${m.tradeId}:${m.status}`},s)}}const latest=load();const base=session==="PRE"?preInterval:scanInterval;latest.status.nextScanAt=(session==="OPEN"||session==="PRE")?new Date((latest.status.lastScanAt?Date.parse(latest.status.lastScanAt):Date.now())+base).toISOString():undefined;save(latest)}catch(error){const x=load();x.status.lastError=error instanceof Error?error.message:String(error);save(x)}finally{running=false}}
export function startAutomationEngine(){runtimeEnabled=true;installLiveListener();const s=load();s.status.enabled=true;s.status.startedAt=s.status.startedAt??isoNow();save(s);if(!timer){timer=setInterval(()=>void tick(),tickMs);setTimeout(()=>void tick(),1500)}return getAutomationStatus()}
export function stopAutomationEngine(){runtimeEnabled=false;if(timer){clearInterval(timer);timer=undefined}const s=load();s.status.enabled=false;save(s);return s.status}
export function getAutomationStatus(){const s=load();s.status.enabled=runtimeEnabled;return s.status}
export function getLastBackgroundScan(){return load().lastBackgroundScan??null}
export function getLiveAutomationStatus(){return{...getLivePriceStatus(),tradeMonitorEnabled:liveTradeMonitorEnabled,scannerAutomationEnabled:runtimeEnabled}}
export function getTriggerRules(){const s=load();return{custom:s.triggerRules,dynamic:dynamicRules()}}
export function addTriggerRule(input:{symbol:string;kind:TriggerRule["kind"];price:number;note?:string;tradeId?:string}){if(!(input.price>0))throw new Error("positive_trigger_price_required");const s=load(),r:TriggerRule={id:uid("rule"),symbol:input.symbol.trim().toUpperCase(),kind:input.kind,price:input.price,active:true,createdAt:isoNow(),note:input.note,tradeId:input.tradeId};s.triggerRules.unshift(r);save(s);return r}
export function removeTriggerRule(id:string){const s=load();s.triggerRules=s.triggerRules.filter(x=>x.id!==id);save(s);return{ok:true}}
