import { alpacaFreeStatus, getAlpacaSnapshots } from "./alpaca-free.js";
import { getSecCompanyIntelligence, secStatus } from "./sec-intelligence.js";
import { getFreeMacroContext } from "./macro-free.js";
import { syncDailyHistoryFree, warehouseStatus, getWarehouseSymbols } from "./market-warehouse.js";
import { walkForwardBacktest } from "./backtest.js";
import type { PlaybookId } from "@trader-os/shared";
import { getEarningsIntelligence } from "./earnings-intelligence.js";
import { externalMarketContextStatus } from "./external-market-context.js";

export async function freeDataStatus(){return{generatedAt:new Date().toISOString(),costUsd:0,alpaca:alpacaFreeStatus(),sec:secStatus(),warehouse:warehouseStatus(),macro:await getFreeMacroContext(false),external:externalMarketContextStatus(),principles:["אין מקור יחיד שמקבל אמון מוחלט","IEX החינמי משמש אימות/האצה ולא תחליף ל-SIP מלא","SEC הוא מקור רשמי לזהות חברה, filings ו-XBRL","כל נתון נשמר עם מקור וזמן עדכון","כאשר ספקים חולקים בצורה מהותית — הכניסה נחסמת"]}}
export async function companyResearchFree(symbol:string,force=false){const sym=symbol.trim().toUpperCase();const [sec,alpaca,earnings]=await Promise.all([getSecCompanyIntelligence(sym,force),alpacaFreeStatus().configured?getAlpacaSnapshots([sym]).then(x=>x[sym]).catch(()=>undefined):Promise.resolve(undefined),getEarningsIntelligence(sym)]);return{symbol:sym,generatedAt:new Date().toISOString(),costUsd:0,identity:sec.identity,fundamentals:sec.fundamentals,filings:sec.filings,earnings,criticalFilingRisk:sec.criticalFilingRisk,filingRiskReason:sec.filingRiskReason,marketValidation:alpaca?{source:alpaca.source,price:alpaca.quote?.price,bid:alpaca.bid,ask:alpaca.ask,spreadPct:alpaca.spreadPct,asOf:alpaca.asOf,note:"Alpaca Basic משתמש ב-IEX בלבד; Bid/Ask הוא proxy חינמי ולא NBBO מלא."}:undefined}}
export async function syncFreeHistory(symbol:string,years=5,force=false){return syncDailyHistoryFree(symbol,years,force)}
export function warehouseOverview(){return{status:warehouseStatus(),series:getWarehouseSymbols().slice(0,500)}}
export async function backtestFree(symbol:string,playbook:PlaybookId,years=5){return walkForwardBacktest(symbol,playbook,{sync:true,years})}
