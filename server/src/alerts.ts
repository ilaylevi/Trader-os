import type { AlertRecord, AlertSeverity } from "@trader-os/shared";
import { dataPath, isoNow, readJsonFile, uid, writeJsonFile } from "./store.js";

interface AlertState { alerts: AlertRecord[]; dedupe: Record<string, string> }
const path = dataPath("alerts.json");
const empty: AlertState = { alerts: [], dedupe: {} };
const webhook = (process.env.ALERT_WEBHOOK_URL ?? "").trim();
const telegramToken = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
const telegramChat = (process.env.TELEGRAM_CHAT_ID ?? "").trim();
const dedupeMinutes = Math.max(1, Number(process.env.ALERT_DEDUPE_MINUTES ?? 20));

function load(){ return readJsonFile<AlertState>(path, empty); }
function save(s: AlertState){ s.alerts=s.alerts.slice(0,1000); return writeJsonFile(path,s); }

async function sendWebhook(alert: AlertRecord) {
  if (!webhook) return false;
  const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),6000);
  try { const r=await fetch(webhook,{method:"POST",signal:ctl.signal,headers:{"content-type":"application/json"},body:JSON.stringify({source:"Trader OS",...alert})}); return r.ok; }
  catch{return false} finally{clearTimeout(timer)}
}
async function sendTelegram(alert: AlertRecord) {
  if (!telegramToken || !telegramChat) return false;
  const icon:Record<AlertSeverity,string>={INFO:"ℹ️",WATCH:"👀",ARMED:"🟡",TRIGGERED:"🚨",RISK:"⚠️",TP_HIT:"✅",STOP_HIT:"🛑",INVALIDATED:"❌",SYSTEM:"⚙️"};
  const text=`${icon[alert.severity]} Trader OS — ${alert.title}\n${alert.message}${alert.symbol?`\n${alert.symbol}`:""}`;
  const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),6000);
  try { const r=await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`,{method:"POST",signal:ctl.signal,headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:telegramChat,text})}); return r.ok; }
  catch{return false} finally{clearTimeout(timer)}
}

export async function emitAlert(input:{severity:AlertSeverity;title:string;message:string;symbol?:string;tradeId?:string;dedupeKey?:string;metadata?:Record<string,unknown>;force?:boolean}) {
  const s=load(); const now=Date.now();
  if(input.dedupeKey&&!input.force){const last=s.dedupe[input.dedupeKey];if(last&&now-Date.parse(last)<dedupeMinutes*60000)return null}
  const alert:AlertRecord={id:uid("alert"),at:isoNow(),severity:input.severity,title:input.title,message:input.message,symbol:input.symbol,tradeId:input.tradeId,read:false,channels:["in_app"],dedupeKey:input.dedupeKey,metadata:input.metadata};
  s.alerts.unshift(alert); if(input.dedupeKey)s.dedupe[input.dedupeKey]=alert.at; save(s);
  const [wh,tg]=await Promise.all([sendWebhook(alert),sendTelegram(alert)]); if(wh)alert.channels.push("webhook");if(tg)alert.channels.push("telegram");
  if(wh||tg){const latest=load();const x=latest.alerts.find(a=>a.id===alert.id);if(x)x.channels=alert.channels;save(latest)}
  return alert;
}
export function getAlerts(limit=200){return load().alerts.slice(0,Math.max(1,Math.min(1000,limit)))}
export function unreadAlertCount(){return load().alerts.filter(x=>!x.read).length}
export function markAlertRead(id:string){const s=load(),a=s.alerts.find(x=>x.id===id);if(a)a.read=true;save(s);return a??null}
export function markAllAlertsRead(){const s=load();s.alerts.forEach(x=>x.read=true);save(s);return {ok:true}}
export function alertChannelStatus(){return{inApp:true,webhook:Boolean(webhook),telegram:Boolean(telegramToken&&telegramChat)}}
