import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { alertChannelStatus, getAlerts, markAlertRead, markAllAlertsRead, unreadAlertCount } from "./alerts.js";
import { addTriggerRule, getAutomationStatus, getLastBackgroundScan, getLiveAutomationStatus, getTriggerRules, pollTriggersNow, refreshCalendarsNow, removeTriggerRule, runBackgroundScanNow, startAutomationEngine, stopAutomationEngine } from "./automation.js";
import { strategyRulesSummary } from "./brain.js";
import { brokerReconciliation, clearBrokerSnapshot, formatIbiInstructions, getBrokerState, getStagedOrders, importBrokerSnapshot, stageOrdersByTradeId, updateStagedOrder } from "./broker.js";
import { addMacroEvent, getEventCalendar, removeMacroEvent } from "./calendar.js";
import { getDecisionJournal, getShadowTrades, journalMetrics } from "./journal.js";
import { getAdaptiveLearningSnapshot } from "./learning.js";
import { addMemoryNote, getTraderMemory } from "./memory.js";
import { getPortfolioIntelligence } from "./portfolio-intelligence.js";
import { addToWatchlist, addTradeNote, closeTrade, confirmClosedTradeExecution, getActiveTrades, getClosedTrades, getWatchlist, moveStop, moveStopToBreakeven, openTrade, portfolioRiskSummary, recordActualFill, recordPartialExit, removeFromWatchlist, setThesisStatus, setTrailingMode, updateTrade } from "./portfolio.js";
import { clearStrategyConsoleHistory, executeStrategyCommand, getStrategyConsoleHistory } from "./strategy-console.js";
import { buildDeterministicMarketBrief, deterministicCoachReview, getCachedMarketBrief, getCachedStrategyOpportunities, getStrategyEngineStatus, rankStrategyOpportunities } from "./strategy-engine.js";
import { advanceFullMarketDiscovery, calculatePositionSize, checkEntry, findTradeNow, getCandles, getDashboard, getFullMarketStatus, getQuote, getRuntimeConfig, getScannerStatus, resetFullMarketDiscovery, runMarketScan, startFullMarketDiscoveryWorker, stopFullMarketDiscoveryWorker, traderProfile } from "./trader.js";
import { getTradeManagementPlan } from "./trade-manager.js";
import { addLiveSymbols, getLivePrice, getLivePrices, getLivePriceStatus, seedLiveQuote, setLiveSymbols, startLivePrices } from "./live-prices.js";
import { backtestFree, companyResearchFree, freeDataStatus, syncFreeHistory, warehouseOverview } from "./free-intelligence.js";
import { getFreeMacroContext } from "./macro-free.js";
import { buildAdvancedDecision, calibrationSnapshot, counterfactualMetrics, decisionReplay, abShadowSummary, regimePlaybookStats, opportunityCost } from "./reasoning-engine.js";
import { getShortContext, getCurrentHalts, getHaltForSymbol, externalMarketContextStatus } from "./external-market-context.js";
import { getAlpacaCorporateActions, getAlpacaOptionsContext } from "./alpaca-free.js";
import { monitorAllOpenTradeTheses, monitorTradeThesis, getThesisMonitorCache } from "./thesis-monitor.js";
import { buildEventTimeline } from "./event-timeline.js";
import { getFundamentalTrend } from "./sec-intelligence.js";
import { getPeerIntelligence } from "./peer-intelligence.js";
import { deriveMarketPhase } from "./market-state-machine.js";
import { compareRuleVariants } from "./rule-lab.js";

const __dirname=fileURLToPath(new URL(".",import.meta.url));
const widgetPath=resolve(__dirname,"../../web/dist/component.js"),standaloneAppPath=resolve(__dirname,"../../preview/index.html"),manifestPath=resolve(__dirname,"../../preview/manifest.webmanifest"),swPath=resolve(__dirname,"../../preview/sw.js");
const PORT=Number(process.env.PORT??8787),MCP_PATH="/mcp",RESOURCE_URI="ui://trader-os/dashboard-v302.html",VERSION="3.0.2",APP_ACCESS_TOKEN=(process.env.APP_ACCESS_TOKEN??"").trim();
function purgeLegacyAiState(){const dir=resolve(process.env.DATA_DIR??"/app/data");for(const f of ["ai-session.json","ai-usage.json","ai-opportunities.json","chat-history.json"]){const p=resolve(dir,f);try{if(existsSync(p))rmSync(p)}catch{}}}
function isAuthorized(req:IncomingMessage){if(!APP_ACCESS_TOKEN)return true;const auth=req.headers.authorization??"",h=req.headers["x-trader-token"],token=auth.startsWith("Bearer ")?auth.slice(7).trim():Array.isArray(h)?h[0]:h;return token===APP_ACCESS_TOKEN}
function json(res:ServerResponse,status:number,payload:unknown){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(payload))}
async function readJsonBody(req:IncomingMessage){const chunks:Buffer[]=[];let size=0;for await(const chunk of req){const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=b.length;if(size>2_000_000)throw new Error("request_body_too_large");chunks.push(b)}return chunks.length?JSON.parse(Buffer.concat(chunks).toString("utf8")): {}}
async function fullDashboard(){
  const base=await getDashboard();
  const strategy=getCachedStrategyOpportunities();
  const actionable=(strategy?.opportunities??[]).filter(x=>x.verdict!=="REJECT");
  return{...base,opportunities:actionable,opportunitySnapshot:strategy,runtime:getRuntimeConfig(),automation:getAutomationStatus(),unreadAlerts:unreadAlertCount(),livePrices:getLivePriceStatus(),scanner:getScannerStatus()};
}
function systemStatus(){return{version:VERSION,runtime:getRuntimeConfig(),engine:getStrategyEngineStatus(),automation:getAutomationStatus(),livePrices:getLivePriceStatus(),scanner:getScannerStatus(),alerts:{unread:unreadAlertCount(),channels:alertChannelStatus()},risk:portfolioRiskSummary(),broker:{...getBrokerState(),reconciliation:brokerReconciliation()},journal:journalMetrics()}}

function createTraderServer(){const server=new McpServer({name:"trader-os",version:VERSION},{instructions:["Trader OS v3 Evidence-Driven Zero-AI is a deterministic conservative 1–3 day US-equities trading operating system.","Capital preservation comes before profit maximization.","Never fabricate prices, fills, events or broker execution.","Market → Regime/Phase → Sector/Peers → Stock → Evidence Committee → Stress/Portfolio → Judge.","Every verdict is produced from explicit measurable rules; external generative AI is disabled."].join(" ")});
  registerAppResource(server,"trader-dashboard",RESOURCE_URI,{},async()=>{const component=readFileSync(widgetPath,"utf8");return{contents:[{uri:RESOURCE_URI,mimeType:RESOURCE_MIME_TYPE,text:`<div id=\"root\"></div><script type=\"module\">${component}</script>`,_meta:{ui:{prefersBorder:true}}}]}});
  registerAppTool(server,"get_trader_dashboard",{title:"פתח Trader OS",description:"הצג את לוח הבקרה של Trader OS.",inputSchema:{},outputSchema:{dashboard:z.any()},_meta:{ui:{resourceUri:RESOURCE_URI}},annotations:{readOnlyHint:true}},async()=>({structuredContent:{dashboard:await fullDashboard()},content:[{type:"text",text:"לוח הבקרה של Trader OS נטען."}]}));
  const readTool=(name:string,title:string,description:string,fn:()=>any|Promise<any>)=>server.registerTool(name,{title,description,inputSchema:{},outputSchema:{result:z.any()},annotations:{readOnlyHint:true}},async()=>{const result=await fn();return{structuredContent:{result},content:[{type:"text",text:JSON.stringify(result)}]}});
  readTool("market_scan","סריקת שוק","הרץ סריקת Market → Sector → Stock חדשה.",()=>runMarketScan(true));
  readTool("find_trade_now","מצא עסקה עכשיו","מצא את הסט-אפ החזק ביותר לטווח של 1–3 ימים.",findTradeNow);
  readTool("get_strategy_opportunities","הזדמנויות מסחר","דרג סט-אפים באמצעות מנוע החוקים הדטרמיניסטי.",()=>rankStrategyOpportunities(true,false));
  readTool("get_open_trades","עסקאות פתוחות","קרא תוכניות ופוזיציות פתוחות.",()=>({trades:getActiveTrades()}));
  readTool("get_portfolio_intelligence","סיכון התיק","קרא סיכון, ריכוז וקורלציות בתיק.",()=>getPortfolioIntelligence(false));
  readTool("get_event_calendar","לוח אירועים","קרא דוחות ואירועי מאקרו מוגדרים.",()=>getEventCalendar());
  server.registerTool("check_entry",{title:"בדיקת כניסה",description:"הרץ את כל תנאי הכניסה הדטרמיניסטיים.",inputSchema:{symbol:z.string().min(1).max(10)},outputSchema:{result:z.any()},annotations:{readOnlyHint:true}},async({symbol}:{symbol:string})=>{const result=await checkEntry(symbol);return{structuredContent:{result},content:[{type:"text",text:JSON.stringify(result)}]}});
  server.registerTool("strategy_console",{title:"הסוחר שלי",description:"הפעל פקודות מסחר בעברית דרך מנוע החוקים, ללא AI חיצוני.",inputSchema:{message:z.string().min(1).max(4000)},outputSchema:{result:z.any()},annotations:{readOnlyHint:false}},async({message}:{message:string})=>{const result=await executeStrategyCommand(message);return{structuredContent:{result},content:[{type:"text",text:result.answer}]}});
  return server}

const httpServer=createServer(async(req,res)=>{if(!req.url)return json(res,400,{error:"missing_url"});const url=new URL(req.url,`http://${req.headers.host??"localhost"}`);try{
  if((url.pathname.startsWith("/api/")||url.pathname===MCP_PATH)&&!isAuthorized(req)){res.setHeader("WWW-Authenticate","Bearer realm=trader-os");return json(res,401,{error:"unauthorized",message:"Trader OS access token required"})}
  if(req.method==="GET"&&url.pathname==="/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(readFileSync(standaloneAppPath,"utf8"));return}
  if(req.method==="GET"&&url.pathname==="/manifest.webmanifest"){res.writeHead(200,{"content-type":"application/manifest+json"});res.end(readFileSync(manifestPath,"utf8"));return}
  if(req.method==="GET"&&url.pathname==="/sw.js"){res.writeHead(200,{"content-type":"application/javascript","cache-control":"no-cache"});res.end(readFileSync(swPath,"utf8"));return}
  if(req.method==="GET"&&url.pathname==="/health")return json(res,200,{ok:true,service:"trader-os",version:VERSION,...getRuntimeConfig()});
  if(req.method==="GET"&&["/api/config","/api/runtime-config"].includes(url.pathname))return json(res,200,getRuntimeConfig());
  if(req.method==="GET"&&url.pathname==="/api/scanner/status")return json(res,200,getScannerStatus());
  if(req.method==="GET"&&url.pathname==="/api/scanner/full-market")return json(res,200,getFullMarketStatus());
  if(req.method==="POST"&&url.pathname==="/api/scanner/full-market/advance")return json(res,200,await advanceFullMarketDiscovery());
  if(req.method==="POST"&&url.pathname==="/api/scanner/full-market/reset")return json(res,200,resetFullMarketDiscovery());
  if(req.method==="POST"&&url.pathname==="/api/scanner/full-market/start"){const current=getFullMarketStatus();if((current.checked??0)>0&&!current.completedAt){startFullMarketDiscoveryWorker();return json(res,200,{...getFullMarketStatus(),sessionStarted:true,resumedExisting:true,message:"הסריקה המלאה הקיימת חודשה מהמקום שבו נעצרה."})}const state=resetFullMarketDiscovery();startFullMarketDiscoveryWorker();return json(res,200,{...state,sessionStarted:true,message:"סריקת השוק המלאה התחילה ותמשיך אוטומטית עד סוף הקטלוג."})}
  if(req.method==="POST"&&url.pathname==="/api/scanner/full-market/restart"){const state=resetFullMarketDiscovery();startFullMarketDiscoveryWorker();return json(res,200,{...state,sessionStarted:true,restarted:true,message:"התחיל סבב שוק מלא חדש מאפס."})}
  if(req.method==="POST"&&url.pathname==="/api/scanner/full-market/pause")return json(res,200,{...stopFullMarketDiscoveryWorker(),paused:true,message:"סריקת השוק המלאה הושהתה."});
  if(req.method==="POST"&&url.pathname==="/api/scanner/full-market/resume"){startFullMarketDiscoveryWorker();return json(res,200,{...getFullMarketStatus(),paused:false,message:"סריקת השוק המלאה חודשה."})}
  if(req.method==="GET"&&url.pathname==="/api/live-prices"){const symbols=(url.searchParams.get("symbols")??"").split(",").map(x=>x.trim().toUpperCase()).filter(Boolean);return json(res,200,{status:getLivePriceStatus(),prices:getLivePrices(symbols.length?symbols:undefined)})}
  if(req.method==="POST"&&url.pathname==="/api/live-prices/subscribe"){const b=await readJsonBody(req),symbols=Array.isArray(b.symbols)?b.symbols.map((x:any)=>String(x)):[];return json(res,200,addLiveSymbols(symbols))}
  if(req.method==="GET"&&url.pathname==="/api/intelligence/free-status")return json(res,200,await freeDataStatus());
  if(req.method==="GET"&&url.pathname==="/api/intelligence/company"){const symbol=url.searchParams.get("symbol");if(!symbol)return json(res,400,{error:"symbol_required"});return json(res,200,await companyResearchFree(symbol,url.searchParams.get("force")==="1"))}
  if(req.method==="GET"&&url.pathname==="/api/intelligence/macro")return json(res,200,await getFreeMacroContext(url.searchParams.get("force")==="1"));
  if(req.method==="GET"&&url.pathname==="/api/intelligence/decision"){const symbol=url.searchParams.get("symbol");if(!symbol)return json(res,400,{error:"symbol_required"});const checked=await checkEntry(symbol);const setup=(checked as any).setup;if(!setup)return json(res,200,checked);return json(res,200,{...checked,advancedDecision:await buildAdvancedDecision(setup,setup.convictionScore,true)})}
  if(req.method==="GET"&&url.pathname==="/api/intelligence/short"){const symbol=url.searchParams.get("symbol");if(!symbol)return json(res,400,{error:"symbol_required"});return json(res,200,await getShortContext(symbol,url.searchParams.get("force")==="1"))}
  if(req.method==="GET"&&url.pathname==="/api/intelligence/halts")return json(res,200,{halts:await getCurrentHalts(url.searchParams.get("force")==="1"),status:externalMarketContextStatus()});
  if(req.method==="GET"&&url.pathname==="/api/intelligence/halt"){const symbol=url.searchParams.get("symbol");if(!symbol)return json(res,400,{error:"symbol_required"});return json(res,200,{symbol,halt:await getHaltForSymbol(symbol,url.searchParams.get("force")==="1")})}
  if(req.method==="GET"&&url.pathname==="/api/intelligence/corporate-actions"){const symbol=url.searchParams.get("symbol");if(!symbol)return json(res,400,{error:"symbol_required"});return json(res,200,await getAlpacaCorporateActions(symbol))}
  if(req.method==="GET"&&url.pathname==="/api/intelligence/options"){const symbol=url.searchParams.get("symbol");if(!symbol)return json(res,400,{error:"symbol_required"});const lp=getLivePrice(symbol);return json(res,200,await getAlpacaOptionsContext(symbol,lp?.price))}
  if(req.method==="GET"&&url.pathname==="/api/intelligence/calibration")return json(res,200,calibrationSnapshot());
  if(req.method==="GET"&&url.pathname==="/api/intelligence/regime-stats")return json(res,200,regimePlaybookStats(url.searchParams.get("playbook")??undefined));
  if(req.method==="GET"&&url.pathname==="/api/intelligence/counterfactual")return json(res,200,counterfactualMetrics());
  if(req.method==="GET"&&url.pathname==="/api/intelligence/ab")return json(res,200,abShadowSummary());
  if(req.method==="GET"&&url.pathname==="/api/intelligence/replay"){const id=url.searchParams.get("id");if(!id)return json(res,400,{error:"id_required"});return json(res,200,decisionReplay(id))}
  if(req.method==="GET"&&url.pathname==="/api/intelligence/timeline"){const symbol=url.searchParams.get("symbol");if(!symbol)return json(res,400,{error:"symbol_required"});return json(res,200,await buildEventTimeline(symbol,url.searchParams.get("force")==="1"))}
  if(req.method==="GET"&&url.pathname==="/api/intelligence/fundamental-trend"){const symbol=url.searchParams.get("symbol");if(!symbol)return json(res,400,{error:"symbol_required"});return json(res,200,await getFundamentalTrend(symbol,url.searchParams.get("force")==="1"))}
  if(req.method==="GET"&&url.pathname==="/api/intelligence/peers"){const symbol=url.searchParams.get("symbol");if(!symbol)return json(res,400,{error:"symbol_required"});return json(res,200,await getPeerIntelligence(symbol))}
  if(req.method==="GET"&&url.pathname==="/api/intelligence/market-phase"){const brief:any=getCachedMarketBrief();return json(res,200,deriveMarketPhase({regime:brief?.marketRegime,breadthAdvancePct:brief?.breadth?.advancePct,avgChangePct:brief?.breadth?.avgChangePct}))}
  if(req.method==="GET"&&url.pathname==="/api/warehouse")return json(res,200,warehouseOverview());
  if(req.method==="POST"&&url.pathname==="/api/warehouse/sync"){const b=await readJsonBody(req);if(!b.symbol)return json(res,400,{error:"symbol_required"});return json(res,200,await syncFreeHistory(String(b.symbol),Number(b.years??5),Boolean(b.force)))}
  if(req.method==="POST"&&url.pathname==="/api/backtest"){const b=await readJsonBody(req);if(!b.symbol||!b.playbook)return json(res,400,{error:"symbol_and_playbook_required"});return json(res,200,await backtestFree(String(b.symbol),String(b.playbook) as any,Number(b.years??5)))}
  if(req.method==="GET"&&url.pathname==="/api/system/status")return json(res,200,systemStatus());
  if(req.method==="GET"&&url.pathname==="/api/dashboard")return json(res,200,await fullDashboard());
  if(req.method==="POST"&&url.pathname==="/api/market-scan")return json(res,200,await runMarketScan(true));
  if(req.method==="POST"&&url.pathname==="/api/find-trade")return json(res,200,await findTradeNow());
  if(req.method==="POST"&&url.pathname==="/api/check-entry"){const b=await readJsonBody(req);if(!b.symbol)return json(res,400,{error:"symbol_required"});return json(res,200,await checkEntry(b.symbol))}
  if(req.method==="GET"&&url.pathname==="/api/quote"){const symbol=url.searchParams.get("symbol");if(!symbol)return json(res,400,{error:"symbol_required"});return json(res,200,await getQuote(symbol))}
  if(req.method==="GET"&&url.pathname==="/api/candles"){const symbol=url.searchParams.get("symbol");if(!symbol)return json(res,400,{error:"symbol_required"});return json(res,200,await getCandles(symbol,false))}
  if(req.method==="GET"&&url.pathname==="/api/profile")return json(res,200,traderProfile);
  if(req.method==="GET"&&url.pathname==="/api/brain")return json(res,200,strategyRulesSummary());
  if(req.method==="POST"&&url.pathname==="/api/position-size")return json(res,200,calculatePositionSize(await readJsonBody(req)));

  if(req.method==="GET"&&url.pathname==="/api/console/history")return json(res,200,{messages:getStrategyConsoleHistory()});
  if(req.method==="DELETE"&&url.pathname==="/api/console/history")return json(res,200,clearStrategyConsoleHistory());
  if(req.method==="POST"&&url.pathname==="/api/console"){const b=await readJsonBody(req);if(!b.message||typeof b.message!=="string")return json(res,400,{error:"message_required"});return json(res,200,await executeStrategyCommand(b.message))}
  if(req.method==="GET"&&url.pathname==="/api/strategy/status")return json(res,200,getStrategyEngineStatus());
  if(req.method==="POST"&&url.pathname==="/api/strategy/coach")return json(res,200,deterministicCoachReview());
  if(req.method==="GET"&&url.pathname==="/api/opportunities/strategy")return json(res,200,getCachedStrategyOpportunities()??{generatedAt:null,engine:"DETERMINISTIC",opportunities:[],summary:"Run deterministic ranking."});
  if(req.method==="POST"&&url.pathname==="/api/opportunities/strategy/refresh")return json(res,200,await rankStrategyOpportunities(true,true));
  if(req.method==="GET"&&url.pathname==="/api/memory")return json(res,200,getTraderMemory());
  if(req.method==="POST"&&url.pathname==="/api/memory/note"){const b=await readJsonBody(req);if(!b.note)return json(res,400,{error:"note_required"});return json(res,200,addMemoryNote(b.note))}

  if(req.method==="POST"&&url.pathname==="/api/trades/manual/preview"){const b=await readJsonBody(req);if(!b.symbol)return json(res,400,{error:"symbol_required"});const symbol=String(b.symbol).trim().toUpperCase(),side=b.side==="SHORT"?"SHORT":"LONG",quote=await getQuote(symbol);seedLiveQuote(quote);const entry=Number(b.entry)>0?Number(b.entry):quote.price,stop=Number(b.stop),riskPct=Number(b.riskPct)>0?Number(b.riskPct):Number(process.env.DEFAULT_TRADE_RISK_PCT??0.5),account=Number(process.env.ACCOUNT_VALUE_USD??0),riskPerShare=stop>0?Math.abs(entry-stop):0,suggestedQuantity=riskPerShare>0&&account>0?Math.max(0,Math.floor((account*riskPct/100)/riskPerShare)):0,risk=portfolioRiskSummary();let analysis:any=undefined;if(b.analyze===true){try{analysis=await checkEntry(symbol)}catch{}}addLiveSymbols([symbol]);return json(res,200,{symbol,side,quote,entry,stop:stop>0?stop:undefined,riskPct,riskBudgetUsd:Number((account*riskPct/100).toFixed(2)),riskPerShareUsd:riskPerShare||undefined,suggestedQuantity,estimatedPositionValueUsd:Number((suggestedQuantity*entry).toFixed(2)),portfolio:risk,analysis})}

  if(req.method==="GET"&&url.pathname==="/api/portfolio")return json(res,200,{activeTrades:getActiveTrades(),watchlist:getWatchlist(),closedTrades:getClosedTrades(),risk:portfolioRiskSummary()});
  if(req.method==="GET"&&url.pathname==="/api/portfolio/intelligence")return json(res,200,await getPortfolioIntelligence(url.searchParams.get("fresh")==="1"));
  if(req.method==="GET"&&url.pathname==="/api/trades/open")return json(res,200,{trades:getActiveTrades()});
  if(req.method==="GET"&&url.pathname==="/api/trades/ledger")return json(res,200,{trades:getClosedTrades()});
  const confirmClosed=url.pathname.match(/^\/api\/trades\/closed\/([^/]+)\/confirm-exit$/);if(req.method==="POST"&&confirmClosed){const b=await readJsonBody(req);return json(res,200,confirmClosedTradeExecution(decodeURIComponent(confirmClosed[1]),Number(b.exitPrice)))}
  if(req.method==="POST"&&url.pathname==="/api/trades/open"){const b=await readJsonBody(req);let setup;if(b.analyze===true){try{const checked=b.symbol?await checkEntry(b.symbol):undefined;setup=checked&&"setup" in checked?checked.setup:undefined}catch{}}const trade=openTrade({symbol:b.symbol,side:b.side==="SHORT"?"SHORT":"LONG",entry:Number(b.entry),quantity:Number(b.quantity),stop:Number(b.stop),tp1:b.tp1==null||b.tp1===""?undefined:Number(b.tp1),tp2:b.tp2==null||b.tp2===""?undefined:Number(b.tp2),thesis:b.thesis,setup,executionState:b.executionState==="PLANNED"?"PLANNED":"RECORDED",entrySource:"manual",createdBy:"manual",allowRiskOverride:Boolean(b.allowRiskOverride),autoLevelManagement:b.autoLevelManagement!==false});addLiveSymbols([trade.symbol]);return json(res,200,trade)}
  const fill=url.pathname.match(/^\/api\/trades\/open\/([^/]+)\/fill$/);if(req.method==="POST"&&fill){const b=await readJsonBody(req);return json(res,200,recordActualFill(decodeURIComponent(fill[1]),{entry:Number(b.entry),quantity:Number(b.quantity)}))}
  const close=url.pathname.match(/^\/api\/trades\/open\/([^/]+)\/close$/);if(req.method==="POST"&&close){const b=await readJsonBody(req);return json(res,200,closeTrade(decodeURIComponent(close[1]),Number(b.exitPrice),b.notes??"",b.followedPlan))}
  const thesis=url.pathname.match(/^\/api\/trades\/open\/([^/]+)\/thesis$/);if(req.method==="POST"&&thesis){const b=await readJsonBody(req);return json(res,200,setThesisStatus(decodeURIComponent(thesis[1]),b.status,b.message??"manual update"))}
  const manage=url.pathname.match(/^\/api\/trades\/open\/([^/]+)\/management$/);if(req.method==="GET"&&manage)return json(res,200,await getTradeManagementPlan(decodeURIComponent(manage[1])));
  if(req.method==="GET"&&url.pathname==="/api/trades/thesis")return json(res,200,{monitors:getThesisMonitorCache()});
  const thesisCheck=url.pathname.match(/^\/api\/trades\/open\/([^/]+)\/thesis-check$/);if(req.method==="POST"&&thesisCheck){const trade=getActiveTrades().find(x=>x.id===decodeURIComponent(thesisCheck[1]));if(!trade)return json(res,404,{error:"trade_not_found"});return json(res,200,await monitorTradeThesis(trade,true))}
  if(req.method==="POST"&&url.pathname==="/api/trades/thesis/check-all")return json(res,200,{monitors:await monitorAllOpenTradeTheses(true)});
  const partial=url.pathname.match(/^\/api\/trades\/open\/([^/]+)\/partial-exit$/);if(req.method==="POST"&&partial){const b=await readJsonBody(req);return json(res,200,recordPartialExit(decodeURIComponent(partial[1]),{quantity:Number(b.quantity),price:Number(b.price),note:b.note}))}
  const stopMove=url.pathname.match(/^\/api\/trades\/open\/([^/]+)\/move-stop$/);if(req.method==="POST"&&stopMove){const b=await readJsonBody(req);return json(res,200,moveStop(decodeURIComponent(stopMove[1]),Number(b.stop),b.reason??"עדכון ידני",Boolean(b.allowWiden)))}
  const breakeven=url.pathname.match(/^\/api\/trades\/open\/([^/]+)\/breakeven$/);if(req.method==="POST"&&breakeven)return json(res,200,moveStopToBreakeven(decodeURIComponent(breakeven[1])));
  const trailing=url.pathname.match(/^\/api\/trades\/open\/([^/]+)\/trailing$/);if(req.method==="POST"&&trailing){const b=await readJsonBody(req);return json(res,200,setTrailingMode(decodeURIComponent(trailing[1]),b.mode))}
  const tradeNote=url.pathname.match(/^\/api\/trades\/open\/([^/]+)\/note$/);if(req.method==="POST"&&tradeNote){const b=await readJsonBody(req);if(!b.note)return json(res,400,{error:"note_required"});return json(res,200,addTradeNote(decodeURIComponent(tradeNote[1]),String(b.note)))}
  const stage=url.pathname.match(/^\/api\/trades\/open\/([^/]+)\/stage-orders$/);if(req.method==="POST"&&stage){const orders=stageOrdersByTradeId(decodeURIComponent(stage[1]));return json(res,200,{orders,ibiInstructions:formatIbiInstructions(orders),sentToBroker:false})}
  if(req.method==="PATCH"&&url.pathname.startsWith("/api/trades/open/")){const id=decodeURIComponent(url.pathname.split("/").pop()??"");return json(res,200,updateTrade(id,await readJsonBody(req)))}
  if(req.method==="GET"&&url.pathname==="/api/watchlist")return json(res,200,{watchlist:getWatchlist()});
  if(req.method==="POST"&&url.pathname==="/api/watchlist"){const b=await readJsonBody(req);return json(res,200,{watchlist:addToWatchlist(b.symbol,b.note??"","manual",{triggerPrice:b.triggerPrice?Number(b.triggerPrice):undefined,triggerType:b.triggerType,reason:b.reason})})}
  if(req.method==="DELETE"&&url.pathname.startsWith("/api/watchlist/"))return json(res,200,{watchlist:removeFromWatchlist(decodeURIComponent(url.pathname.split("/").pop()??""))});

  if(req.method==="GET"&&url.pathname==="/api/market-brief")return json(res,200,getCachedMarketBrief());
  if(req.method==="POST"&&url.pathname==="/api/market-brief/refresh")return json(res,200,await buildDeterministicMarketBrief(true));
  if(req.method==="GET"&&url.pathname==="/api/calendar")return json(res,200,await getEventCalendar());
  if(req.method==="POST"&&url.pathname==="/api/calendar/refresh")return json(res,200,await refreshCalendarsNow(true));
  if(req.method==="POST"&&url.pathname==="/api/calendar/macro")return json(res,200,addMacroEvent(await readJsonBody(req)));
  if(req.method==="DELETE"&&url.pathname.startsWith("/api/calendar/macro/"))return json(res,200,removeMacroEvent(decodeURIComponent(url.pathname.split("/").pop()??"")));
  if(req.method==="GET"&&url.pathname==="/api/journal")return json(res,200,{entries:getDecisionJournal(500),metrics:journalMetrics(),shadowTrades:getShadowTrades()});
  if(req.method==="GET"&&url.pathname==="/api/journal/metrics")return json(res,200,journalMetrics());
  if(req.method==="GET"&&url.pathname==="/api/learning")return json(res,200,getAdaptiveLearningSnapshot());
  if(req.method==="GET"&&url.pathname==="/api/decision-lab")return json(res,200,{learning:getAdaptiveLearningSnapshot(),calibration:calibrationSnapshot(),counterfactual:counterfactualMetrics(),ab:abShadowSummary(),regimes:regimePlaybookStats(),ranking:(getCachedStrategyOpportunities() as any)?.opportunities??[],opportunityCost:(getCachedStrategyOpportunities() as any)?.opportunityCost});
  if(req.method==="POST"&&url.pathname==="/api/rule-lab/compare"){const b=await readJsonBody(req);if(!b.symbol||!b.playbook)return json(res,400,{error:"symbol_and_playbook_required"});return json(res,200,compareRuleVariants(String(b.symbol),String(b.playbook) as any))}

  if(req.method==="GET"&&url.pathname==="/api/alerts")return json(res,200,{alerts:getAlerts(Number(url.searchParams.get("limit")??200)),unread:unreadAlertCount(),channels:alertChannelStatus()});
  if(req.method==="POST"&&url.pathname==="/api/alerts/read-all")return json(res,200,markAllAlertsRead());
  const alertRead=url.pathname.match(/^\/api\/alerts\/([^/]+)\/read$/);if(req.method==="POST"&&alertRead)return json(res,200,markAlertRead(decodeURIComponent(alertRead[1])));

  if(req.method==="GET"&&url.pathname==="/api/automation")return json(res,200,{status:getAutomationStatus(),lastScan:getLastBackgroundScan(),rules:getTriggerRules(),live:getLiveAutomationStatus()});
  if(req.method==="POST"&&url.pathname==="/api/automation/scan")return json(res,200,await runBackgroundScanNow());
  if(req.method==="POST"&&url.pathname==="/api/automation/poll")return json(res,200,await pollTriggersNow());
  if(req.method==="POST"&&url.pathname==="/api/automation/start")return json(res,200,startAutomationEngine());
  if(req.method==="POST"&&url.pathname==="/api/automation/stop")return json(res,200,stopAutomationEngine());
  if(req.method==="GET"&&url.pathname==="/api/triggers")return json(res,200,getTriggerRules());
  if(req.method==="POST"&&url.pathname==="/api/triggers")return json(res,200,addTriggerRule(await readJsonBody(req)));
  if(req.method==="DELETE"&&url.pathname.startsWith("/api/triggers/"))return json(res,200,removeTriggerRule(decodeURIComponent(url.pathname.split("/").pop()??"")));

  if(req.method==="GET"&&url.pathname==="/api/broker")return json(res,200,{...getBrokerState(),reconciliation:brokerReconciliation(),stagedOrders:getStagedOrders()});
  if(req.method==="POST"&&url.pathname==="/api/broker/import")return json(res,200,importBrokerSnapshot(await readJsonBody(req)));
  if(req.method==="DELETE"&&url.pathname==="/api/broker/import")return json(res,200,clearBrokerSnapshot());
  if(req.method==="GET"&&url.pathname==="/api/broker/orders")return json(res,200,{orders:getStagedOrders()});
  const orderStatus=url.pathname.match(/^\/api\/broker\/orders\/([^/]+)$/);if(req.method==="PATCH"&&orderStatus){const b=await readJsonBody(req);return json(res,200,updateStagedOrder(decodeURIComponent(orderStatus[1]),b.status))}

  if(req.method==="OPTIONS"&&url.pathname===MCP_PATH){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, GET, DELETE, OPTIONS","Access-Control-Allow-Headers":"content-type, mcp-session-id, authorization, x-trader-token","Access-Control-Expose-Headers":"Mcp-Session-Id"});res.end();return}
  if(url.pathname===MCP_PATH&&req.method&&new Set(["POST","GET","DELETE"]).has(req.method)){res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Expose-Headers","Mcp-Session-Id");const server=createTraderServer(),transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});res.on("close",()=>{transport.close();server.close()});await server.connect(transport);await transport.handleRequest(req,res);return}
  return json(res,404,{error:"not_found"});
}catch(error){console.error(error);return json(res,500,{error:"internal_server_error",message:error instanceof Error?error.message:"unknown error"})}});

purgeLegacyAiState();
if((process.env.FULL_MARKET_AUTOSTART??"false").toLowerCase()==="true")startFullMarketDiscoveryWorker();
startLivePrices();setLiveSymbols([...getActiveTrades().map(x=>x.symbol),...getWatchlist().map(x=>x.symbol)]);
httpServer.listen(PORT,"0.0.0.0",()=>{console.log(`Trader OS Zero-AI v${VERSION} listening on http://0.0.0.0:${PORT}`);console.log(`Dashboard: http://localhost:${PORT}/`);const cfg=getRuntimeConfig();console.log(`Engine: DETERMINISTIC · external AI disabled · model cost $0`);console.log(`Market data: ${cfg.provider} (${cfg.providerConfigured?"configured":"DEMO"})`);console.log(`Scan universe (${cfg.scanUniverse.length}): ${cfg.scanUniverse.join(", ")}`);console.log(`Automation: ${cfg.automationEnabled?"enabled":"disabled"}`);if(cfg.automationEnabled)startAutomationEngine();else stopAutomationEngine()});
