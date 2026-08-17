import type { StrategyOpportunity, DecisionJournalEntry, MarketQuote, PlaybookId, ShadowTrade, TradePlan } from "@trader-os/shared";
import { dataPath, isoNow, readJsonFile, uid, writeJsonFile } from "./store.js";

interface JournalState { entries: DecisionJournalEntry[]; shadowTrades: ShadowTrade[] }
const path=dataPath("decision-journal.json");
const empty:JournalState={entries:[],shadowTrades:[]};
const shadowEnabled=(process.env.SHADOW_TRADING_ENABLED??"true").toLowerCase()!=="false";
const shadowDays=Math.max(1,Math.min(5,Number(process.env.SHADOW_TRADE_MAX_DAYS??3)));
function load(){return readJsonFile<JournalState>(path,empty)}
function save(s:JournalState){s.entries=s.entries.slice(0,5000);s.shadowTrades=s.shadowTrades.slice(0,2000);return writeJsonFile(path,s)}

export function recordTradePlanDecision(plan:TradePlan,source:DecisionJournalEntry["source"]="SCAN",extra:Partial<DecisionJournalEntry>={}){
  const s=load(); const e:DecisionJournalEntry={id:uid("dec"),at:isoNow(),symbol:plan.symbol,source,verdict:plan.verdict,playbook:plan.playbook,setupScore:plan.setupScore,marketRegime:plan.context?.marketRegime,marketBias:plan.context?.marketBias,sectorAlignment:plan.context?.sectorAlignment,dataQualityPct:plan.dataQualityPct,entry:plan.entry,stop:plan.stop,tp1:plan.tp1,tp2:plan.tp2,outcome:"PENDING",snapshot:{status:plan.status,quote:plan.quote,technicals:plan.technicals,eventRisks:plan.eventRisks,thesis:plan.thesis},...extra};s.entries.unshift(e);save(s);return e;
}

export function recordStrategyOpportunityDecision(opp:StrategyOpportunity,marketBias?:string,marketRegime?:any){
  const s=load();const e:DecisionJournalEntry={id:uid("dec"),at:isoNow(),symbol:opp.symbol,source:"STRATEGY_RANKING",verdict:opp.verdict,confidence:opp.confidence,grade:opp.grade,playbook:opp.playbook,setupScore:opp.setupScore,marketBias,marketRegime,dataQualityPct:opp.dataQualityPct,entry:opp.entry,stop:opp.stop,tp1:opp.tp1,tp2:opp.tp2,outcome:"PENDING",snapshot:{headline:opp.headline,rationale:opp.rationale,catalyst:opp.catalyst,keyRisk:opp.keyRisk,eventRiskLocked:opp.eventRiskLocked,rejectionReasons:opp.rejectionReasons,advancedDecision:opp.advancedDecision}};s.entries.unshift(e);save(s);if(shadowEnabled&&opp.entry&&opp.stop){if(["READY","ARMED"].includes(opp.verdict)){createShadowTrade(e,opp,"STRATEGY");if((process.env.SHADOW_AB_ENABLED??"true").toLowerCase()!=="false"){createShadowTrade(e,opp,"AB_TEST","A_BASE");const tightened={...opp,stop:opp.entry&&opp.stop?opp.entry-(opp.entry-opp.stop)*.9:opp.stop};createShadowTrade(e,tightened,"AB_TEST","B_TIGHTER_STOP")}}else if(opp.verdict==="REJECT"&&(opp.setupScore??0)>=5.5&&opp.dataQualityPct!==undefined&&(opp.dataQualityPct??0)>=70)createShadowTrade(e,opp,"COUNTERFACTUAL")}return e;
}

function createShadowTrade(entry:DecisionJournalEntry,opp:StrategyOpportunity,purpose:ShadowTrade["purpose"]="STRATEGY",abVariant?:ShadowTrade["abVariant"]){const s=load();if(s.shadowTrades.some(x=>x.journalId===entry.id&&x.purpose===purpose&&x.abVariant===abVariant))return null;const expires=new Date(Date.now()+shadowDays*86400000).toISOString();const st:ShadowTrade={id:uid("shadow"),journalId:entry.id,symbol:entry.symbol,playbook:entry.playbook,openedAt:isoNow(),expiresAt:expires,entry:opp.entry!,stop:opp.stop!,tp1:opp.tp1,tp2:opp.tp2,status:"PENDING_TRIGGER",remainingFraction:1,managementModel:"TP1_HALF_THEN_TP2_OR_STOP",purpose,abVariant};s.shadowTrades.unshift(st);save(s);return st}

function finalizeJournal(s:JournalState,shadow:ShadowTrade,outcome:DecisionJournalEntry["outcome"]){const e=s.entries.find(x=>x.id===shadow.journalId);if(e){e.outcome=outcome;e.realizedR=shadow.realizedR}}
export function updateShadowWithQuote(quote:MarketQuote){const s=load();let changed=false;for(const t of s.shadowTrades.filter(x=>x.symbol===quote.symbol&&["PENDING_TRIGGER","OPEN"].includes(x.status))){const now=Date.now(),risk=Math.max(.0001,t.entry-t.stop);if(now>Date.parse(t.expiresAt)){const wasOpen=t.status==="OPEN";t.status="EXPIRED";t.closedAt=isoNow();t.exitPrice=quote.price;const remaining=t.remainingFraction??1,base=t.tp1RealizedR??0;t.realizedR=wasOpen?Number((base+((quote.price-t.entry)/risk)*remaining).toFixed(2)):0;finalizeJournal(s,t,"EXPIRED");changed=true;continue}
    if(t.status==="PENDING_TRIGGER"&&quote.price>=t.entry){t.status="OPEN";t.triggeredAt=isoNow();changed=true}
    if(t.status==="OPEN"){const fav=(quote.price/t.entry-1)*100,adv=(quote.price/t.entry-1)*100;t.maxFavorablePct=Math.max(t.maxFavorablePct??-999,fav);t.maxAdversePct=Math.min(t.maxAdversePct??999,adv);
      if(!t.tp1HitAt&&t.tp1&&quote.price>=t.tp1){t.tp1HitAt=isoNow();t.tp1RealizedR=Number((((t.tp1-t.entry)/risk)*.5).toFixed(2));t.remainingFraction=.5;changed=true}
      const remaining=t.remainingFraction??1,base=t.tp1RealizedR??0;if(t.tp2&&t.tp1HitAt&&quote.price>=t.tp2){t.status="WIN";t.closedAt=isoNow();t.exitPrice=t.tp2;t.realizedR=Number((base+((t.tp2-t.entry)/risk)*remaining).toFixed(2));finalizeJournal(s,t,"WIN");changed=true}
      else if(quote.price<=t.stop){t.status=(base+(-1*remaining))>0?"WIN":"LOSS";t.closedAt=isoNow();t.exitPrice=t.stop;t.realizedR=Number((base-remaining).toFixed(2));finalizeJournal(s,t,t.status==="WIN"?"WIN":"LOSS");changed=true}
      else if(t.tp1&&!t.tp2&&t.tp1HitAt){t.status="WIN";t.closedAt=isoNow();t.exitPrice=t.tp1;t.realizedR=Number((base+((t.tp1-t.entry)/risk)*remaining).toFixed(2));finalizeJournal(s,t,"WIN");changed=true}
    }}if(changed)save(s);return s.shadowTrades.filter(x=>x.symbol===quote.symbol)}

export function getDecisionJournal(limit=500){return load().entries.slice(0,limit)}
export function getShadowTrades(){return load().shadowTrades}
export function journalMetrics(){const s=load(),done=s.shadowTrades.filter(x=>["WIN","LOSS","EXPIRED"].includes(x.status));const wins=done.filter(x=>x.status==="WIN").length,losses=done.filter(x=>x.status==="LOSS").length;const rs=done.map(x=>x.realizedR).filter((x):x is number=>typeof x==="number");const byPlaybook:Record<string,{count:number;wins:number;avgR:number;sumR:number}>={};for(const t of done){const p=t.playbook??"NONE";const v=byPlaybook[p]??{count:0,wins:0,avgR:0,sumR:0};v.count++;if(t.status==="WIN")v.wins++;v.sumR+=t.realizedR??0;v.avgR=Number((v.sumR/v.count).toFixed(2));byPlaybook[p]=v}return{decisions:s.entries.length,shadowTotal:s.shadowTrades.length,shadowCompleted:done.length,wins,losses,winRate:done.length?Number((wins/done.length*100).toFixed(1)):0,avgR:rs.length?Number((rs.reduce((a,b)=>a+b,0)/rs.length).toFixed(2)):0,byPlaybook}}
export function getPlaybookStats(playbook?:PlaybookId){const m=journalMetrics();return playbook?{playbook,stats:m.byPlaybook[playbook]??{count:0,wins:0,avgR:0,sumR:0}}:m.byPlaybook}
