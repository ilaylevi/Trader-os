import type { ConsoleMessage, StrategyOpportunity, TradePlan } from "@trader-os/shared";
import { appendConsoleMessage, clearConsoleHistory, getConsoleHistory, addMemoryNote } from "./memory.js";
import { buildDeterministicMarketBrief, deterministicCoachReview, getCachedStrategyOpportunities, getStrategyEngineStatus, rankStrategyOpportunities } from "./strategy-engine.js";
import { checkEntry, getRuntimeConfig, runMarketScan } from "./trader.js";
import { getActiveTrades, openTrade, portfolioRiskSummary, recordActualFill } from "./portfolio.js";
import { getPortfolioIntelligence } from "./portfolio-intelligence.js";
import { getTradeManagementPlan } from "./trade-manager.js";
import { formatIbiInstructions, stageOrdersByTradeId } from "./broker.js";
import { getEventCalendar } from "./calendar.js";
import { getAdaptiveLearningSnapshot } from "./learning.js";
import { planSummaryHe, playbookHe, rsHe, verdictHe } from "./i18n-he.js";

function tickerFrom(message:string){const upper=message.toUpperCase();const matches=upper.match(/\b[A-Z][A-Z0-9.-]{0,9}\b/g)??[];const ignore=new Set(["AI","API","IBI","USD","RISK","STOP","TP","NOW","OPEN","LONG","SHORT","SCAN"]);return matches.find(x=>!ignore.has(x))}
function n(v:number|undefined,d=2){return v==null?"—":v.toFixed(d)}
function linePlan(p:TradePlan){return planSummaryHe(p)}
function lineOpp(o:StrategyOpportunity){return `${o.grade} · ${o.symbol} · ${verdictHe[o.verdict]??o.verdict}
רמת ביטחון: ${o.confidence}% · ציון עסקה: ${o.setupScore}/10
כניסה: ${n(o.entry)} | סטופ: ${n(o.stop)} | יעד 1: ${n(o.tp1)} | יעד 2: ${n(o.tp2)}
תבנית: ${playbookHe[o.playbook??"NONE"]} · חוזק יחסי: ${rsHe[o.relativeStrengthGrade??"UNKNOWN"]}
למה היא מעניינת: ${o.rationale}
קטליזטור: ${o.catalyst}
הסיכון המרכזי: ${o.keyRisk}`}
function formatEntryExplanation(data:any){const e=data?.explanation;if(!e)return `${verdictHe[data?.verdict]??data?.verdict} — ${data?.reason??""}`;const good=e.positives?.length?`

מה כן נראה טוב:
${e.positives.map((x:string)=>`✓ ${x}`).join("\n")}`:"";const bad=e.blockers?.length?`

מה חוסם את העסקה:
${e.blockers.map((x:string)=>`✕ ${x}`).join("\n")}`:"";const next=e.nextSteps?.length?`

מה צריך לקרות עכשיו:
${e.nextSteps.map((x:string)=>`→ ${x}`).join("\n")}`:"";const l=e.levels??{};const levels=(l.entry||l.stop||l.tp1)?`

רמות עסקה:
כניסה: ${n(l.entry)} | סטופ: ${n(l.stop)} | יעד 1: ${n(l.tp1)} | יעד 2: ${n(l.tp2)} | סיכוי/סיכון: ${l.riskReward??"—"}`:`\n\nרמות עסקה: עדיין לא ניתן לחשב בצורה אמינה.`;return `${e.verdictLabel}
${e.primaryReason}${good}${bad}${next}${levels}`}
function riskQty(entry:number,stop:number){const account=Number(process.env.ACCOUNT_VALUE_USD??0),riskPct=Number(process.env.DEFAULT_TRADE_RISK_PCT??0.5),budget=account*riskPct/100,perShare=Math.abs(entry-stop);return{quantity:account>0&&perShare>0?Math.floor(budget/perShare):0,budgetUsd:Number(budget.toFixed(2)),riskPerShareUsd:Number(perShare.toFixed(2))}}
function addHistory(user:string,answer:string,command:string,symbol?:string){appendConsoleMessage({role:"user",content:user,at:new Date().toISOString(),command,symbol});appendConsoleMessage({role:"engine",content:answer,at:new Date().toISOString(),command,symbol});}

async function openFromPlan(message:string,symbol?:string){let plan:TradePlan|undefined;
  if(symbol){const c=await checkEntry(symbol);plan=(c as any).setup;if((c as any).verdict==="NO_ENTRY")return{answer:`${formatEntryExplanation(c)}\n\nלא נוצרה תוכנית עסקה.`,data:c};}
  else{let snap=getCachedStrategyOpportunities();if(!snap||Date.now()-Date.parse(snap.generatedAt)>5*60_000)snap=await rankStrategyOpportunities(true,false);const o=snap.opportunities.find(x=>x.verdict==="READY")??snap.opportunities.find(x=>x.verdict==="ARMED");if(!o)return{answer:"אין כרגע עסקה שמוכנה לביצוע או ממתינה לטריגר תקין, ולכן לא נוצרת תוכנית בכוח.",data:snap};const checked=await checkEntry(o.symbol);plan=(checked as any).setup;if((checked as any).verdict==="NO_ENTRY")return{answer:`${formatEntryExplanation(checked)}\n\nהמועמדת שהייתה בדירוג אינה עוברת כרגע בדיקת כניסה טרייה, ולכן לא נוצרה תוכנית.`,data:checked};}
  if(!plan?.entry||!plan.stop)return{answer:"אין עדיין מחיר כניסה וסטופ מלאים ואמינים, ולכן לא ניתן ליצור תוכנית עסקה.",data:plan};
  const q=riskQty(plan.entry,plan.stop);const trade=openTrade({symbol:plan.symbol,entry:plan.entry,quantity:q.quantity,stop:plan.stop,tp1:plan.tp1,tp2:plan.tp2,thesis:plan.thesis,setup:plan,executionState:"PLANNED",entrySource:"plan",createdBy:"engine"});
  return{answer:`נוצרה תוכנית ${plan.symbol} בטאב העסקאות.\nזו תוכנית בלבד — לא נשלחה שום פקודה לברוקר.\nכניסה ${n(plan.entry)} | סטופ ${n(plan.stop)} | יעד 1 ${n(plan.tp1)} | יעד 2 ${n(plan.tp2)}\nגודל פוזיציה מוצע: ${q.quantity} מניות, לסיכון של כ-$${q.budgetUsd} (${process.env.DEFAULT_TRADE_RISK_PCT??0.5}% מהתיק).\nלאחר ביצוע בפועל, יש לרשום את מחיר ה-Fill האמיתי.`,data:trade};
}

export async function executeStrategyCommand(message:string){const raw=message.trim();if(!raw)throw new Error("message_required");const lower=raw.toLowerCase(),symbol=tickerFrom(raw);let command="help",answer="",data:any;
  if(lower.includes("תזכור ש")||lower.startsWith("זכור ש")){command="memory_note";const note=raw.replace(/^.*?תזכור ש/i,"").replace(/^זכור ש/i,"").trim();data=addMemoryNote(note);answer=`נשמרה הערת מסחר מקומית: ${note}`;}
  else if(/קניתי|בוצע|fill|מילוי/.test(lower)&&symbol){command="record_fill";const nums=raw.match(/\d+(?:\.\d+)?/g)?.map(Number)??[],trade=getActiveTrades().find(x=>x.symbol===symbol);if(!trade)answer=`לא קיימת תוכנית פתוחה ל-${symbol}.`;else if(nums.length<2)answer=`כדי לרשום Fill אמיתי כתוב למשל: קניתי 40 ${symbol} ב-48.82`;else{const quantity=Math.floor(nums[0]),entry=nums[1];data=recordActualFill(trade.id,{quantity,entry});answer=`ביצוע אמיתי נרשם ל-${symbol}: ${quantity} מניות במחיר $${entry}. הפוזיציה מסומנת כעת כבוצעה ונרשמה.`}}
  else if(/בוא נפתח עסקה|פתח עסקה|יאללה נכנסים|תפתח את העסקה/.test(lower)){command="open_trade";const r=await openFromPlan(raw,symbol);answer=r.answer;data=r.data;}
  else if(lower.includes("סריקת שוק")||lower==="scan"||lower.includes("סרוק את השוק")){command="market_scan";data=await rankStrategyOpportunities(true,true);answer=`סריקה ודירוג חדשים ${data.scanId??""}\n${data.summary}\n\n${data.opportunities.slice(0,5).map(lineOpp).join("\n\n")||"אין כרגע הזדמנות שעוברת את רף האיכות."}`;}
  else if(lower.includes("מצא עסקה")||lower.includes("עסקה עכשיו")||lower.includes("הזדמנות")){command="find_trade";data=await rankStrategyOpportunities(true,true);const top=data.opportunities.find((x:StrategyOpportunity)=>x.verdict==="READY")??data.opportunities.find((x:StrategyOpportunity)=>x.verdict==="ARMED")??data.opportunities[0];answer=top?`המועמד המוביל כרגע:\n\n${lineOpp(top)}\n\n${data.summary}`:`לא נמצאה כרגע עסקה שעוברת את תנאי הביצוע.\n${data.summary}`;}
  else if(lower.includes("הכנה לפתיחה")||lower.includes("pre-market")||lower.includes("פרה מרקט")){command="session_brief";data=await buildDeterministicMarketBrief(true);answer=`הכנה לפתיחה\n\n${data.text}\n\nהסקטורים המובילים: ${data.sectors.map((x:any)=>`${x.sector} ${x.avgScore}/10`).join(", ")||"—"}`;}
  else if((lower.includes("בדיקת כניסה")||lower.includes("להיכנס")||lower.includes("כניסה"))&&symbol){command="check_entry";data=await checkEntry(symbol);const p=(data as any).setup;answer=`${formatEntryExplanation(data)}${p?`\n\nסיכום טכני:\n${linePlan(p)}`:""}`;}
  else if((lower.includes("נהל")||lower.includes("management"))&&symbol){command="manage_trade";const trade=getActiveTrades().find(x=>x.symbol===symbol);if(!trade)answer=`אין עסקה פתוחה ב-${symbol}.`;else{data=await getTradeManagementPlan(trade.id);answer=`ניהול ${symbol}: ${data.action}\nמחיר נוכחי ${n(data.price)} | ${data.currentR!=null?`${data.currentR}R`:"R עדיין לא זמין"}\n${data.reason}${data.suggestedStop?`\nנקודת סטופ מוצעת לבדיקה: ${n(data.suggestedStop)} — הסטופ לא הוזז אוטומטית.`:""}`}}
  else if(lower.includes("סיכון תיק")||lower.includes("portfolio risk")||lower.includes("חשיפה")){command="portfolio_risk";data=await getPortfolioIntelligence(true);answer=`סיכון תיק: ${data.risk.usedPct}% מתוך ${data.risk.maxPct}% · סיכון פתוח $${data.risk.openRiskUsd} · נשארה קיבולת של ${data.risk.remainingPct}%.\n${data.warnings.length?data.warnings.join("\n"):"אין כרגע אזהרת ריכוז או קורלציה מעל הסף."}`;}
  else if((lower.includes("פקודות")||lower.includes("ibi"))&&symbol){command="stage_orders";const trade=getActiveTrades().find(x=>x.symbol===symbol);if(!trade)answer=`אין עסקה פתוחה ב-${symbol}.`;else{const orders=stageOrdersByTradeId(trade.id);data={orders,instructions:formatIbiInstructions(orders)};answer=`נבנו פקודות טיוטה ל-${symbol}; הן לא נשלחו לברוקר.\n${data.instructions}`}}
  else if(lower.includes("יומן")||lower.includes("איך אני סוחר")||lower.includes("coach")||lower.includes("ביצועים")){command="coach";data=deterministicCoachReview();answer=`מאמן המסחר הדטרמיניסטי\nאחוז הצלחה במסחר צל: ${data.metrics.winRate}% · R ממוצע במסחר צל: ${data.metrics.avgR} · R ממוצע בעסקאות אמיתיות: ${data.metrics.avgRealizedR}\n${data.recommendations.map((x:string)=>`• ${x}`).join("\n")}`;}
  else if(lower.includes("מצב למידה")||lower.includes("adaptive")||lower.includes("מה למד")){command="learning";data=getAdaptiveLearningSnapshot();const rows=Object.values(data.stats).sort((a:any,b:any)=>b.sampleSize-a.sampleSize);answer=`מצב הלמידה של המערכת\nהמערכת משנה ציונים רק מעט ובתוך גבולות שמרניים, ורק לפי תוצאות בפועל.\n${rows.length?rows.map((x:any)=>`• ${playbookHe[x.playbook]??x.playbook}: ${x.sampleSize} דגימות · הצלחה ${x.winRate}% · ממוצע ${x.avgR}R · התאמה ${x.adjustment>0?"+":""}${x.adjustment}`).join("\n"):"עדיין אין מספיק עסקאות סגורות או עסקאות צל כדי להתחיל ללמוד."}`;}
  else if(lower.includes("קלנדר")||lower.includes("אירועים")||lower.includes("earnings")){command="calendar";data=await getEventCalendar();const events=[...data.earnings,...data.macro].filter((x:any)=>(x.minutesAway??9999)>=0).slice(0,10);answer=`אירועים קרובים:\n${events.length?events.map((e:any)=>`• ${e.symbol?e.symbol+" ":""}${e.title} · ${e.at}${e.blocksEntry?" · ENTRY LOCK":""}`).join("\n"):"אין אירועים קרובים שמורים."}`;}
  else if(symbol){command="symbol_status";data=await checkEntry(symbol);const p=(data as any).setup;answer=`${formatEntryExplanation(data)}${p?`\n\n${linePlan(p)}`:""}`;}
  else{command="help";data=getStrategyEngineStatus();answer=`הסוחר שלי עובד ללא AI חיצוני וללא עלות מודל.\nפקודות מומלצות:\n• סריקת שוק\n• מצא עסקה עכשיו\n• הכנה לפתיחה\n• בדיקת כניסה ASTS\n• בוא נפתח עסקה ASTS\n• קניתי 40 ASTS ב-48.82\n• נהל ASTS\n• בנה פקודות ASTS IBI\n• סיכון תיק\n• הצג אירועים\n• נתח ביצועים\n• מצב למידה`}
  addHistory(raw,answer,command,symbol);return{answer,command,symbol,data,engine:"DETERMINISTIC",externalAi:false,costUsd:0,at:new Date().toISOString()};
}
export function getStrategyConsoleHistory(){return getConsoleHistory()}
export function clearStrategyConsoleHistory(){clearConsoleHistory();return{ok:true}}
