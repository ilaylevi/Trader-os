import type { StrategyOpportunity } from "@trader-os/shared";
import { dataPath, isoNow, readJsonFile, writeJsonFile } from "./store.js";

interface RankPoint {at:string;scanId?:string;ranks:Record<string,number>;scores:Record<string,number>}
const path=dataPath("ranking-history.json");
function load(){return readJsonFile<{rows:RankPoint[]}>(path,{rows:[]})}
export function recordRankingSnapshot(opps:StrategyOpportunity[],scanId?:string){const s=load(),ranks:Record<string,number>={},scores:Record<string,number>={};opps.forEach((x,i)=>{ranks[x.symbol]=i+1;scores[x.symbol]=x.confidence});s.rows.unshift({at:isoNow(),scanId,ranks,scores});s.rows=s.rows.slice(0,120);writeJsonFile(path,s);return s.rows[0]}
export function getRankingStability(symbol:string){const sym=symbol.toUpperCase(),rows=load().rows.slice(0,10),seen=rows.flatMap(r=>r.ranks[sym]?[r.ranks[sym]]:[]);if(!seen.length)return{rank:undefined,top5Persistence:0,stability:"UNKNOWN" as const,samples:0};const top5=seen.filter(x=>x<=5).length/rows.length,mean=seen.reduce((a,b)=>a+b,0)/seen.length,variance=seen.reduce((s,x)=>s+(x-mean)**2,0)/seen.length,std=Math.sqrt(variance),stability: "HIGH"|"MEDIUM"|"LOW" = top5>=.7&&std<=2?"HIGH":top5>=.4&&std<=4?"MEDIUM":"LOW";return{rank:seen[0],top5Persistence:Number((top5*100).toFixed(0)),stability,samples:seen.length,avgRank:Number(mean.toFixed(1)),rankStd:Number(std.toFixed(1))}}
export function getRankingHistory(limit=30){return load().rows.slice(0,limit)}
