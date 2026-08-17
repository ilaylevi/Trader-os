import type { MarketQuote, StrategyOpportunitySnapshot } from "@trader-os/shared";
import { getActiveTrades, getWatchlist } from "./portfolio.js";
import { dataPath, isoDay, isoNow, readJsonFile, writeJsonFile } from "./store.js";

interface Leader { symbol:string; score:number; seenAt:string; price:number; changePct?:number }
interface ScannerState { day:string; cursor:number; checkedToday:string[]; leaders:Leader[]; catalogSize:number; catalogUpdatedAt?:string; lastBatch?:string[] }
const statePath=dataPath("scanner-universe-state.json");
const oppPath=dataPath("strategy-opportunities.json");
function empty():ScannerState{return{day:isoDay(),cursor:0,checkedToday:[],leaders:[],catalogSize:0}}
function load(){const s=readJsonFile<ScannerState>(statePath,empty());if(s.day!==isoDay()){s.day=isoDay();s.checkedToday=[]}return s}
function save(s:ScannerState){writeJsonFile(statePath,s);return s}
function normalize(s:string){return s.trim().toUpperCase()}
function unique(items:string[]){return[...new Set(items.map(normalize).filter(Boolean))]}
function opportunitySymbols(){const x=readJsonFile<StrategyOpportunitySnapshot|null>(oppPath,null);return x?.opportunities?.filter(o=>o.verdict!=="REJECT"&&o.entry&&o.stop&&o.tp1).slice(0,8).map(o=>o.symbol)??[]}

export async function prepareDiscoveryBatch(input:{
  catalogLoader?:()=>Promise<string[]>;
  staticUniverse:string[];
  prioritySymbols:string[];
  dynamicSymbols:string[];
  quoteBudget:number;
  rotationBatchSize:number;
}){
  const s=load();let catalog:string[]=[];let catalogError:string|undefined;
  if(input.catalogLoader){try{catalog=unique(await input.catalogLoader())}catch(e){catalogError=e instanceof Error?e.message:String(e)}}
  if(!catalog.length)catalog=unique(input.staticUniverse);
  s.catalogSize=catalog.length;s.catalogUpdatedAt=isoNow();
  const active=getActiveTrades().map(t=>t.symbol),watch=getWatchlist().map(w=>w.symbol),recent=opportunitySymbols(),leaders=s.leaders.slice(0,12).map(x=>x.symbol);
  // Critical symbols are always refreshed. Everything else rotates through the full US catalog.
  const must=unique([...active,...watch,...input.prioritySymbols,...input.dynamicSymbols,...recent,...leaders]);
  const room=Math.max(0,input.quoteBudget-Math.min(input.quoteBudget,must.length));
  const rotateCount=Math.min(Math.max(0,input.rotationBatchSize),room||Math.max(0,input.quoteBudget-must.length));
  const rotating:string[]=[];
  if(catalog.length&&rotateCount>0){
    let attempts=0;while(rotating.length<rotateCount&&attempts<catalog.length*2){const symbol=catalog[s.cursor%catalog.length];s.cursor=(s.cursor+1)%catalog.length;attempts++;if(!must.includes(symbol)&&!rotating.includes(symbol))rotating.push(symbol)}
  }
  const symbols=unique([...must,...rotating]).slice(0,input.quoteBudget);
  const checked=new Set(s.checkedToday);for(const x of symbols)checked.add(x);s.checkedToday=[...checked].slice(-10000);s.lastBatch=symbols;save(s);
  return{symbols,mustSymbols:must.filter(x=>symbols.includes(x)),rotatingSymbols:rotating.filter(x=>symbols.includes(x)),catalogSize:catalog.length,checkedToday:s.checkedToday.length,coveragePct:catalog.length?Number((Math.min(catalog.length,s.checkedToday.length)/catalog.length*100).toFixed(1)):0,cursor:s.cursor,catalogError};
}

export function recordDiscoveryLeaders(rows:Array<{symbol:string;score:number;quote:MarketQuote}>){
  const s=load(),by=new Map(s.leaders.map(x=>[x.symbol,x]));
  for(const row of rows){const symbol=normalize(row.symbol);const prev=by.get(symbol);if(!prev||row.score>=prev.score||Date.now()-Date.parse(prev.seenAt)>60*60_000)by.set(symbol,{symbol,score:row.score,seenAt:isoNow(),price:row.quote.price,changePct:row.quote.changePct})}
  const cutoff=Date.now()-6*60*60_000;s.leaders=[...by.values()].filter(x=>Date.parse(x.seenAt)>=cutoff).sort((a,b)=>b.score-a.score).slice(0,40);save(s);return s.leaders;
}
export function getScannerCoverage(){const s=load();return{day:s.day,cursor:s.cursor,checkedToday:s.checkedToday.length,catalogSize:s.catalogSize,coveragePct:s.catalogSize?Number((Math.min(s.catalogSize,s.checkedToday.length)/s.catalogSize*100).toFixed(1)):0,leaders:s.leaders.slice(0,15),lastBatch:s.lastBatch??[]}}
