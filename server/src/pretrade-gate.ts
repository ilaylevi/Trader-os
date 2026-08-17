import type { MarketSession, TradePlan } from "@trader-os/shared";
import { getActiveTrades, portfolioRiskSummary } from "./portfolio.js";

export interface PreTradeGateResult {
  passed:boolean;
  verdict:"ENTER"|"WAIT"|"NO_ENTRY";
  blockers:string[];
  warnings:string[];
  gates:Record<string,boolean>;
  portfolio:{remainingPct:number;requiredPct:number;sameSectorTrades:number;duplicateSymbol:boolean};
}

export function evaluatePreTradeGate(setup:TradePlan,marketStatus:MarketSession,opts:{headlineCritical?:boolean;catalystBlocked?:boolean}={}):PreTradeGateResult{
  const risk=portfolioRiskSummary(),requiredPct=Math.max(0.1,Number(process.env.DEFAULT_TRADE_RISK_PCT??0.5)),active=getActiveTrades(),duplicate=active.some(x=>x.symbol===setup.symbol),sector=setup.context?.sectorEtf,sameSector=sector?active.filter(x=>x.executionState==="RECORDED"&&x.context?.sectorEtf===sector).length:0,maxSector=Math.max(1,Number(process.env.MAX_SAME_SECTOR_TRADES??2));
  const minDollarVolume=Math.max(0,Number(process.env.MIN_AVG_DOLLAR_VOLUME_20D??5000000));
  const minDataConfidence=Math.max(0,Math.min(100,Number(process.env.MIN_DATA_CONFIDENCE_SCORE??70))),maxSpread=Math.max(.05,Number(process.env.MAX_EXECUTION_SPREAD_PCT??0.8));
  const gates={
    liveQuote:Boolean(setup.quote?.price),
    dataQuality:(setup.dataQualityPct??0)>=80,
    dataConfidence:(setup.dataConfidenceScore??100)>=minDataConfidence,
    spreadAcceptable:setup.spreadPct===undefined||setup.spreadPct<=maxSpread,
    secRiskClear:!setup.secCriticalRisk,
    trueMtf:(setup.technicals?.mtfQualityPct??0)>=70,
    liquidity:(setup.technicals?.averageDollarVolume20d??0)>=minDollarVolume,
    bullishTrend:setup.technicals?.trend==="BULLISH",
    multiTimeframe:(setup.technicals?.timeframeAlignmentPct??0)>=50,
    relativeVolume:(setup.technicals?.relativeVolume??0)>=1.2,
    definedStop:Boolean(setup.stop&&setup.entry&&setup.stop<setup.entry),
    riskReward:(setup.riskReward??0)>=2,
    structuralRoom:(setup.technicals?.roomToResistanceR??3)>=2,
    marketOpen:marketStatus==="OPEN",
    sessionPriceVerified:marketStatus!=="PRE"||setup.preMarketVerified===true,
    marketNotRiskOff:setup.context?.marketRegime!=="RISK_OFF",
    sectorNotHeadwind:setup.context?.sectorAlignment!=="HEADWIND",
    eventRiskClear:!setup.eventRiskLocked,
    headlineRiskClear:!opts.headlineCritical,
    catalystNotBlocked:!opts.catalystBlocked,
    noChase:!setup.notes?.includes("NO CHASE"),
    portfolioCapacity:risk.accountValueUsd<=0||risk.remainingPct>=requiredPct,
    sectorCapacity:sameSector<maxSector,
    noDuplicate:!duplicate,
  };
  const blockers:string[]=[]; const warnings:string[]=[];
  const add=(ok:boolean,msg:string)=>{if(!ok)blockers.push(msg)};
  add(gates.dataQuality,"איכות הנתונים אינה מספיקה לביצוע."); add(gates.dataConfidence,`ציון אמינות המידע נמוך מ-${minDataConfidence}%.`); add(gates.spreadAcceptable,`הספרד רחב מדי לביצוע (${setup.spreadPct?.toFixed(2)??"—"}% > ${maxSpread}%).`); add(gates.secRiskClear,"קיים דיווח SEC טרי שמפעיל חסימת סיכון (למשל גיוס/דילול). "); add(gates.trueMtf,"אין מספיק היסטוריה אמינה בכל טווחי הזמן."); add(gates.liquidity,`הנזילות נמוכה מדי: נדרש מחזור דולרי יומי ממוצע של לפחות $${Math.round(minDollarVolume).toLocaleString("en-US")}.`); add(gates.definedStop,"אין סטופ מבני מוגדר ואמין."); add(gates.riskReward,"יחס הסיכוי/סיכון נמוך מ-1:2."); add(gates.structuralRoom,"ההתנגדות הבאה קרובה מדי ואינה משאירה מספיק מרווח לעסקה."); add(gates.eventRiskClear,"אירוע מהותי קרוב מפעיל חסימת כניסה."); add(gates.headlineRiskClear,"זוהתה כותרת חדשותית שלילית קריטית."); add(gates.catalystNotBlocked,"מנוע הקטליזטורים חוסם את העסקה."); add(gates.noChase,"המחיר התרחק מדי מנקודת הכניסה — לא רודפים."); add(gates.portfolioCapacity,"אין כרגע מספיק תקציב סיכון פנוי בתיק."); add(gates.sectorCapacity,`כבר קיימת חשיפה גבוהה מדי לסקטור ${sector??"הנוכחי"}.`); add(gates.noDuplicate,"כבר קיימת עסקה או תוכנית פתוחה באותה מניה.");
  if(!gates.marketNotRiskOff)warnings.push("השוק במצב Risk-Off ולכן הרף לעסקת לונג גבוה במיוחד."); if(!gates.sectorNotHeadwind)warnings.push("הסקטור מהווה רוח נגדית לעסקה."); if(!gates.relativeVolume)warnings.push("הנפח היחסי עדיין לא מאשר את המהלך."); if(!gates.bullishTrend||!gates.multiTimeframe)warnings.push("המגמה עדיין לא מאושרת מספיק בין טווחי הזמן.");
  const hardFailed = !(
    gates.dataQuality && gates.dataConfidence && gates.spreadAcceptable && gates.secRiskClear && gates.trueMtf && gates.liquidity && gates.definedStop && gates.riskReward &&
    gates.structuralRoom && gates.eventRiskClear &&
    gates.headlineRiskClear && gates.catalystNotBlocked && gates.noChase &&
    gates.portfolioCapacity && gates.sectorCapacity && gates.noDuplicate
  );
  if(!gates.marketOpen)warnings.push("השוק סגור כרגע: ה-Setup יכול להישאר תקף/ARMED, אבל אין אישור ביצוע עד לפתיחת המסחר הרגיל.");if(!gates.sessionPriceVerified)warnings.push("מחיר ה-Pre-Market עדיין לא אומת מספיק לביצוע; איכות ה-Setup נשמרת אך הביצוע ממתין.");
  const verdict=hardFailed?"NO_ENTRY":gates.marketOpen&&gates.sessionPriceVerified&&setup.verdict==="ENTER"&&gates.bullishTrend&&gates.multiTimeframe&&gates.relativeVolume?"ENTER":"WAIT";
  return{passed:verdict==="ENTER",verdict,blockers,warnings,gates,portfolio:{remainingPct:risk.remainingPct,requiredPct,sameSectorTrades:sameSector,duplicateSymbol:duplicate}};
}
