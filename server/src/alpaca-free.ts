import type { MarketQuote } from "@trader-os/shared";
import type { Candle } from "./market-data.js";

export interface AlpacaAsset {
  id?: string;
  symbol: string;
  name?: string;
  exchange?: string;
  status?: string;
  tradable?: boolean;
  shortable?: boolean;
  easy_to_borrow?: boolean;
  fractionable?: boolean;
  class?: string;
}

export interface AlpacaSnapshot {
  symbol: string;
  quote?: MarketQuote;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
  spreadPct?: number;
  minuteBar?: Candle;
  dailyBar?: Candle;
  previousDailyBar?: Candle;
  source: "Alpaca IEX";
  asOf?: string;
}

const keyId=(process.env.ALPACA_API_KEY_ID??"").trim();
const secret=(process.env.ALPACA_API_SECRET_KEY??"").trim();
const timeoutMs=Math.max(3000,Number(process.env.MARKET_DATA_TIMEOUT_MS??8000));
const feed=(process.env.ALPACA_DATA_FEED??"iex").trim()||"iex";
const dataBase=(process.env.ALPACA_DATA_BASE_URL??"https://data.alpaca.markets").replace(/\/$/,"");
const tradingBase=(process.env.ALPACA_TRADING_BASE_URL??"https://paper-api.alpaca.markets").replace(/\/$/,"");

export function alpacaFreeStatus(){return{configured:Boolean(keyId&&secret),feed,pricing:"FREE_BASIC",coverage:feed==="iex"?"IEX_ONLY":"CONFIGURED_FEED",latest15MinutesHistoricalRestricted:true}}
function headers(){return{"APCA-API-KEY-ID":keyId,"APCA-API-SECRET-KEY":secret,accept:"application/json"}}
async function fetchJson<T>(url:string):Promise<T>{
  if(!keyId||!secret)throw new Error("Alpaca Basic אינו מוגדר");
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);
  try{const r=await fetch(url,{headers:headers(),signal:ctl.signal});const text=await r.text();if(!r.ok)throw new Error(`Alpaca ${r.status}: ${text.slice(0,240)}`);return JSON.parse(text) as T}finally{clearTimeout(timer)}
}
function bar(x:any):Candle|undefined{if(!x)return undefined;const t=Date.parse(String(x.t??""));const row={time:Number.isFinite(t)?Math.floor(t/1000):0,open:Number(x.o),high:Number(x.h),low:Number(x.l),close:Number(x.c),volume:Number(x.v??0)};return row.time>0&&[row.open,row.high,row.low,row.close,row.volume].every(Number.isFinite)?row:undefined}

export async function getAlpacaSnapshots(symbols:string[]):Promise<Record<string,AlpacaSnapshot>>{
  const list=[...new Set(symbols.map(x=>x.trim().toUpperCase()).filter(Boolean))];
  if(!list.length)return{};
  const q=new URLSearchParams({symbols:list.join(","),feed});
  const body=await fetchJson<Record<string,any>>(`${dataBase}/v2/stocks/snapshots?${q}`);
  const out:Record<string,AlpacaSnapshot>={};
  for(const symbol of list){const x=body?.[symbol];if(!x)continue;const lt=x.latestTrade,lq=x.latestQuote,db=bar(x.dailyBar),pb=bar(x.prevDailyBar),mb=bar(x.minuteBar),price=Number(lt?.p??mb?.close??db?.close),bid=Number(lq?.bp),ask=Number(lq?.ap),ts=String(lt?.t??lq?.t??x.minuteBar?.t??x.dailyBar?.t??"");const asOf=Number.isFinite(Date.parse(ts))?new Date(ts).toISOString():undefined;let quote:MarketQuote|undefined;if(Number.isFinite(price)&&price>0){const prev=pb?.close,open=db?.open,high=db?.high,low=db?.low;quote={symbol,price,open,high,low,previousClose:prev,change:prev?price-prev:undefined,changePct:prev?((price-prev)/prev)*100:undefined,timestamp:asOf??new Date().toISOString(),source:"Alpaca IEX"}}
    const spreadPct=Number.isFinite(bid)&&Number.isFinite(ask)&&bid>0&&ask>=bid?((ask-bid)/((ask+bid)/2))*100:undefined;
    out[symbol]={symbol,quote,bid:Number.isFinite(bid)&&bid>0?bid:undefined,ask:Number.isFinite(ask)&&ask>0?ask:undefined,bidSize:Number(lq?.bs)||undefined,askSize:Number(lq?.as)||undefined,spreadPct,minuteBar:mb,dailyBar:db,previousDailyBar:pb,source:"Alpaca IEX",asOf};
  }
  return out;
}

export async function getAlpacaLatestQuotes(symbols:string[]){
  const list=[...new Set(symbols.map(x=>x.trim().toUpperCase()).filter(Boolean))];if(!list.length)return{};
  const q=new URLSearchParams({symbols:list.join(","),feed});
  return fetchJson<Record<string,{t?:string;bp?:number;ap?:number;bs?:number;as?:number}>>(`${dataBase}/v2/stocks/quotes/latest?${q}`);
}

export async function getAlpacaAssets():Promise<AlpacaAsset[]>{
  const q=new URLSearchParams({status:"active",asset_class:"us_equity"});
  const rows=await fetchJson<any[]>(`${tradingBase}/v2/assets?${q}`);
  return (Array.isArray(rows)?rows:[]).flatMap(x=>{const symbol=String(x.symbol??"").trim().toUpperCase();if(!symbol)return[];return[{id:x.id,symbol,name:x.name,exchange:x.exchange,status:x.status,tradable:Boolean(x.tradable),shortable:Boolean(x.shortable),easy_to_borrow:Boolean(x.easy_to_borrow),fractionable:Boolean(x.fractionable),class:x.class}]});
}

export async function getAlpacaBars(symbol:string,timeframe:"5Min"|"15Min"|"1Hour"|"1Day",start:string,end?:string,maxBars=5000):Promise<Candle[]>{
  const normalized=symbol.trim().toUpperCase();const rows:Candle[]=[];let token:string|undefined;
  do{const q=new URLSearchParams({timeframe,start,feed,limit:String(Math.min(10000,Math.max(100,maxBars-rows.length))),sort:"asc"});if(end)q.set("end",end);if(token)q.set("page_token",token);const body=await fetchJson<{bars?:any[];next_page_token?:string|null}>(`${dataBase}/v2/stocks/${encodeURIComponent(normalized)}/bars?${q}`);for(const x of body.bars??[]){const b=bar(x);if(b)rows.push(b)}token=body.next_page_token??undefined;if(rows.length>=maxBars)break}while(token);
  return rows.slice(0,maxBars);
}

export interface AlpacaCorporateActionContext {symbol:string;asOf:string;actions:Array<{type:string;processDate?:string;exDate?:string;recordDate?:string;payableDate?:string;ratio?:number;cash?:number;raw?:any}>;warning?:string;source:"Alpaca Market Data"}
export interface AlpacaOptionsContext {symbol:string;asOf:string;feed:"indicative";contracts:number;atmIv?:number;callIv?:number;putIv?:number;ivSkew?:number;avgDeltaAbs?:number;expectedMovePct?:number;confidence:"LOW"|"MEDIUM";note:string;source:"Alpaca Options Indicative"}

export async function getAlpacaCorporateActions(symbol:string,daysBack=120,daysForward=30):Promise<AlpacaCorporateActionContext>{
  const sym=symbol.trim().toUpperCase(),start=new Date(Date.now()-Math.max(1,daysBack)*86400_000).toISOString().slice(0,10),end=new Date(Date.now()+Math.max(1,daysForward)*86400_000).toISOString().slice(0,10);let token:string|undefined;const actions:AlpacaCorporateActionContext["actions"]=[];
  try{do{const q=new URLSearchParams({symbols:sym,start,end,limit:"1000",sort:"desc"});if(token)q.set("page_token",token);const body=await fetchJson<any>(`${dataBase}/v1/corporate-actions?${q}`);for(const [type,rows] of Object.entries(body?.corporate_actions??body??{})){if(!Array.isArray(rows))continue;for(const x of rows){const s=String((x as any).symbol??(x as any).old_symbol??(x as any).new_symbol??"").toUpperCase();if(s&&s!==sym)continue;actions.push({type,processDate:(x as any).process_date,exDate:(x as any).ex_date,recordDate:(x as any).record_date,payableDate:(x as any).payable_date,ratio:Number((x as any).rate??(x as any).ratio)||undefined,cash:Number((x as any).cash)||undefined,raw:x})}}token=body?.next_page_token??undefined}while(token&&actions.length<1000);return{symbol:sym,asOf:new Date().toISOString(),actions,source:"Alpaca Market Data"}}catch(e){return{symbol:sym,asOf:new Date().toISOString(),actions:[],warning:e instanceof Error?e.message:String(e),source:"Alpaca Market Data"}}
}

function optionParts(contract:string){const m=contract.match(/^(.+?)(\d{6})([CP])(\d{8})$/);if(!m)return undefined;const yy=2000+Number(m[2].slice(0,2)),mm=Number(m[2].slice(2,4)),dd=Number(m[2].slice(4,6));return{underlying:m[1],expiration:new Date(Date.UTC(yy,mm-1,dd)),kind:m[3] as "C"|"P",strike:Number(m[4])/1000}}
function median(a:number[]){if(!a.length)return undefined;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2}
export async function getAlpacaOptionsContext(symbol:string,underlyingPrice?:number):Promise<AlpacaOptionsContext>{
  const sym=symbol.trim().toUpperCase(),q=new URLSearchParams({feed:"indicative",limit:"1000"});let token:string|undefined;const rows:Array<{kind:"C"|"P";strike:number;days:number;iv?:number;delta?:number}>=[];let page=0;
  do{if(token)q.set("page_token",token);const body=await fetchJson<any>(`${dataBase}/v1beta1/options/snapshots/${encodeURIComponent(sym)}?${q}`);const snaps=body?.snapshots??body?.data??{};for(const [contract,x] of Object.entries(snaps)){const p=optionParts(contract);if(!p)continue;const days=(p.expiration.getTime()-Date.now())/86400_000;if(days<1||days>60)continue;const g=(x as any).greeks??{},iv=Number(g.implied_volatility??g.impliedVolatility),delta=Number(g.delta);rows.push({kind:p.kind,strike:p.strike,days,iv:Number.isFinite(iv)&&iv>0?iv:undefined,delta:Number.isFinite(delta)?delta:undefined})}token=body?.next_page_token??undefined;page++}while(token&&page<3&&rows.length<2500);
  const px=underlyingPrice??0,near=rows.filter(x=>!px||Math.abs(x.strike-px)/px<=.12).sort((a,b)=>a.days-b.days).slice(0,600),calls=near.filter(x=>x.kind==="C"&&x.iv),puts=near.filter(x=>x.kind==="P"&&x.iv),callIv=median(calls.map(x=>x.iv!)),putIv=median(puts.map(x=>x.iv!)),atmIv=median(near.map(x=>x.iv).filter((x):x is number=>Boolean(x))),ivSkew=callIv&&putIv?Number(((putIv-callIv)*100).toFixed(1)):undefined,avgDeltaAbs=median(near.map(x=>x.delta).filter((x):x is number=>x!==undefined).map(Math.abs)),expectedMovePct=atmIv?Number((atmIv*Math.sqrt(7/365)*100).toFixed(1)):undefined;return{symbol:sym,asOf:new Date().toISOString(),feed:"indicative",contracts:near.length,atmIv:atmIv?Number((atmIv*100).toFixed(1)):undefined,callIv:callIv?Number((callIv*100).toFixed(1)):undefined,putIv:putIv?Number((putIv*100).toFixed(1)):undefined,ivSkew,avgDeltaAbs,expectedMovePct,confidence:near.length>=30?"MEDIUM":"LOW",note:"Alpaca Basic מספק Indicative options feed: trades עשויים להיות מושהים וה-quotes מותאמים. הנתון משמש הקשר בלבד, לא לביצוע או NBBO.",source:"Alpaca Options Indicative"}
}
