import type { MarketQuote } from "@trader-os/shared";

export interface LivePricePoint {
  symbol: string;
  price: number;
  marketTimestamp: string;
  receivedAt: string;
  source: "FINNHUB_WS" | "REST_SEED";
  ageSeconds: number;
  freshness: "LIVE" | "FRESH" | "STALE";
}

type PriceListener = (point: LivePricePoint) => void | Promise<void>;

const key=(process.env.FINNHUB_API_KEY??"").trim();
const enabled=(process.env.LIVE_PRICES_ENABLED??"true").toLowerCase()!=="false"&&Boolean(key);
const maxSymbols=Math.max(5,Math.min(100,Number(process.env.LIVE_PRICE_MAX_SYMBOLS??40)));
const staleSeconds=Math.max(10,Number(process.env.LIVE_PRICE_STALE_SECONDS??45));
const reconnectMaxMs=Math.max(5_000,Number(process.env.LIVE_PRICE_RECONNECT_MAX_MS??60_000));
const points=new Map<string,Omit<LivePricePoint,"ageSeconds"|"freshness">>();
const desired=new Set<string>();
const subscribed=new Set<string>();
const listeners=new Set<PriceListener>();
let ws:WebSocket|undefined;
let reconnectTimer:NodeJS.Timeout|undefined;
let reconnectAttempt=0;
let lastError:string|undefined;
let openedAt:string|undefined;

function normalize(symbol:string){return symbol.trim().toUpperCase()}
function socketOpen(){return ws?.readyState===WebSocket.OPEN}
function publicPoint(raw:Omit<LivePricePoint,"ageSeconds"|"freshness">):LivePricePoint{
  const age=Math.max(0,Math.floor((Date.now()-Date.parse(raw.receivedAt))/1000));
  return{...raw,ageSeconds:age,freshness:raw.source==="FINNHUB_WS"&&age<=5?"LIVE":age<=staleSeconds?"FRESH":"STALE"};
}
function emit(raw:Omit<LivePricePoint,"ageSeconds"|"freshness">){
  points.set(raw.symbol,raw);const p=publicPoint(raw);
  for(const listener of listeners){try{void listener(p)}catch{}}
}
function send(action:"subscribe"|"unsubscribe",symbol:string){if(!socketOpen())return;try{ws!.send(JSON.stringify({type:action,symbol}))}catch{}}
function applyDesired(){
  if(!socketOpen())return;
  for(const symbol of [...subscribed])if(!desired.has(symbol)){send("unsubscribe",symbol);subscribed.delete(symbol)}
  for(const symbol of desired){if(subscribed.size>=maxSymbols)break;if(!subscribed.has(symbol)){send("subscribe",symbol);subscribed.add(symbol)}}
}
function scheduleReconnect(){
  if(!enabled||reconnectTimer)return;
  const delay=Math.min(reconnectMaxMs,1_500*Math.pow(2,Math.min(6,reconnectAttempt++)));
  reconnectTimer=setTimeout(()=>{reconnectTimer=undefined;connect()},delay);
}
function connect(){
  if(!enabled||ws&&(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING))return;
  try{
    ws=new WebSocket(`wss://ws.finnhub.io?token=${encodeURIComponent(key)}`);
    ws.onopen=()=>{openedAt=new Date().toISOString();lastError=undefined;reconnectAttempt=0;subscribed.clear();applyDesired()};
    ws.onmessage=(event)=>{
      try{
        const body=JSON.parse(typeof event.data==="string"?event.data:String(event.data)) as {type?:string;data?:Array<{s?:string;p?:number;t?:number}>;msg?:string};
        if(body.type==="error"){lastError=body.msg??"Finnhub WebSocket error";return}
        if(body.type!=="trade"||!Array.isArray(body.data))return;
        // One message may contain several trades for the same symbol. Keep the newest tick.
        const newest=new Map<string,{s:string;p:number;t:number}>();
        for(const item of body.data){const s=normalize(item.s??"");const p=Number(item.p),t=Number(item.t);if(!s||!(p>0)||!Number.isFinite(t))continue;const prev=newest.get(s);if(!prev||t>=prev.t)newest.set(s,{s,p,t})}
        const receivedAt=new Date().toISOString();
        for(const item of newest.values())emit({symbol:item.s,price:item.p,marketTimestamp:new Date(item.t).toISOString(),receivedAt,source:"FINNHUB_WS"});
      }catch{}
    };
    ws.onerror=()=>{lastError="Finnhub WebSocket connection error"};
    ws.onclose=()=>{subscribed.clear();scheduleReconnect()};
  }catch(error){lastError=error instanceof Error?error.message:String(error);scheduleReconnect()}
}

export function startLivePrices(){connect();return getLivePriceStatus()}
export function stopLivePrices(){if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=undefined}try{ws?.close()}catch{}ws=undefined;subscribed.clear()}
export function setLiveSymbols(symbols:string[]){
  desired.clear();for(const s of symbols.map(normalize).filter(Boolean).slice(0,maxSymbols))desired.add(s);
  connect();applyDesired();return getLivePriceStatus();
}
export function addLiveSymbols(symbols:string[]){
  for(const s of symbols.map(normalize).filter(Boolean)){if(desired.size>=maxSymbols)break;desired.add(s)}
  connect();applyDesired();return getLivePriceStatus();
}
export function removeLiveSymbols(symbols:string[]){for(const s of symbols.map(normalize)){desired.delete(s);if(subscribed.has(s)){send("unsubscribe",s);subscribed.delete(s)}}return getLivePriceStatus()}
export function seedLiveQuote(q:MarketQuote){if(!(q.price>0))return;const symbol=normalize(q.symbol);const receivedAt=new Date().toISOString();emit({symbol,price:q.price,marketTimestamp:q.timestamp||receivedAt,receivedAt,source:"REST_SEED"})}
export function getLivePrice(symbol:string){const p=points.get(normalize(symbol));return p?publicPoint(p):undefined}
export function getLivePrices(symbols?:string[]){
  const wanted=symbols?.length?new Set(symbols.map(normalize)):undefined;
  return[...points.values()].filter(p=>!wanted||wanted.has(p.symbol)).map(publicPoint).sort((a,b)=>a.symbol.localeCompare(b.symbol));
}
export function onLivePrice(listener:PriceListener){listeners.add(listener);return()=>listeners.delete(listener)}
export function getLivePriceStatus(){return{enabled,connected:socketOpen(),openedAt,lastError,maxSymbols,desired:[...desired],subscribed:[...subscribed],prices:getLivePrices()}}
