import type { PlaybookId } from "@trader-os/shared";
import { getWarehouseBars } from "./market-warehouse.js";
import { runDailyBacktest } from "./backtest.js";
function metric(a:any[]){const n=a.length,w=a.filter(x=>x.r>0).length,avg=n?a.reduce((s,x)=>s+x.r,0)/n:0;return{samples:n,winRatePct:n?Number((w/n*100).toFixed(1)):0,avgR:Number(avg.toFixed(2))}}
export function compareRuleVariants(symbol:string,playbook:PlaybookId){const sym=symbol.trim().toUpperCase(),bars=getWarehouseBars(sym,"1d",5000),base=runDailyBacktest(sym,bars,playbook),strict=base.filter(x=>Math.abs(x.entry-x.stop)/x.entry<=0.04),patient=base.filter((_,i)=>i%2===0||base[i]?.r>0);return{symbol:sym,playbook,generatedAt:new Date().toISOString(),variants:{BASE:metric(base),STRICT_RISK_PROXY:metric(strict),PATIENCE_PROXY:metric(patient)},warning:"הווריאנטים ב-Rule Lab הם proxies דטרמיניסטיים להשוואה, לא שינוי production אוטומטי. שינוי חוק מחייב Shadow A/B לפני קידום."}}
