import type { MarketContext, TradePlan } from "@trader-os/shared";
import { dataPath, isoNow, readJsonFile, writeJsonFile } from "./store.js";

interface DeepCandidateCacheItem { plan: TradePlan; analyzedAt: string }
interface DeepCandidateCacheState { updatedAt: string; items: Record<string, DeepCandidateCacheItem> }

const cachePath=dataPath("deep-candidate-cache.json");
const ttlMs=Math.max(10*60_000,Number(process.env.DEEP_ANALYSIS_CACHE_MS??45*60_000));
const maxPool=Math.max(12,Math.min(120,Number(process.env.DEEP_ANALYSIS_FRESH_POOL_MAX??48)));

function load():DeepCandidateCacheState{return readJsonFile<DeepCandidateCacheState>(cachePath,{updatedAt:isoNow(),items:{}})}

export function mergeDeepCandidateCache(current:TradePlan[],market:MarketContext):TradePlan[]{
  const state=load(),now=Date.now(),currentSymbols=new Set(current.map(x=>x.symbol.toUpperCase()));
  for(const plan of current)state.items[plan.symbol.toUpperCase()]={plan,analyzedAt:isoNow()};
  const fresh=Object.entries(state.items).map(([symbol,item])=>({symbol,...item,at:Date.parse(item.analyzedAt)})).filter(x=>Number.isFinite(x.at)&&now-x.at<=ttlMs).sort((a,b)=>{const ac=a.plan.convictionScore??a.plan.setupScore*10,bc=b.plan.convictionScore??b.plan.setupScore*10;return bc-ac||b.at-a.at}).slice(0,maxPool);
  state.items=Object.fromEntries(fresh.map(x=>[x.symbol,{plan:x.plan,analyzedAt:x.analyzedAt}]));state.updatedAt=isoNow();writeJsonFile(cachePath,state);
  const reused=fresh.filter(x=>!currentSymbols.has(x.symbol)).map(x=>{const ageMinutes=Math.max(1,Math.round((now-x.at)/60_000)),flags=(x.plan.dataFlags??[]).filter(f=>!f.startsWith("DEEP_CACHE_"));return{...x.plan,dataFlags:[...flags,"DEEP_CACHE_REUSED",`DEEP_CACHE_AGE_MIN_${ageMinutes}`],context:{...x.plan.context,marketBias:market.bias,marketRegime:market.regime,breadth:market.breadth,marketQuotes:market.quotes,regimeScore:market.regimeScore,regimeReasons:market.regimeReasons}} as TradePlan});
  return[...current,...reused].slice(0,maxPool)
}

export function getDeepCandidateCacheStatus(){const state=load(),now=Date.now(),ages=Object.values(state.items).map(x=>Date.parse(x.analyzedAt)).filter(Number.isFinite).map(t=>Math.max(0,Math.round((now-t)/60_000)));return{enabled:true,freshCandidates:ages.length,ttlMinutes:Math.round(ttlMs/60_000),maxPool,oldestAgeMinutes:ages.length?Math.max(...ages):0,updatedAt:state.updatedAt}}
