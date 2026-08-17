import type { MarketRegime, PlaybookId, TradePlan } from "@trader-os/shared";

export const verdictHe:Record<string,string>={
  ENTER:"כניסה אפשרית — כל שערי החובה עברו",
  WAIT:"ממתינים — עדיין אין אישור מלא",
  NO_ENTRY:"לא נכנסים כרגע",
  READY:"מוכן לבחינה לביצוע",
  ARMED:"מוכן וממתין לטריגר",
  WATCH:"במעקב",
  REJECT:"נפסל כרגע",
  ENTRY_TRIGGERED:"טריגר הכניסה הופעל",
  NO_EXECUTABLE_TRADE:"אין כרגע עסקה לביצוע",
};
export const statusHe:Record<string,string>={WATCHING:"במעקב",ARMED:"ממתין לטריגר",TRIGGERED:"הטריגר הופעל",OPEN:"פתוחה",TP1:"יעד ראשון הושג",CLOSED:"סגורה",INVALIDATED:"התזה נפסלה",PLANNED:"תוכנית בלבד",RECORDED:"בוצעה ונרשמה"};
export const trendHe:Record<string,string>={BULLISH:"מגמה עולה",BEARISH:"מגמה יורדת",NEUTRAL:"מגמה ניטרלית",UNKNOWN:"לא ידוע"};
export const rsHe:Record<string,string>={LEADER:"מובילה מול השוק והסקטור",OUTPERFORM:"חזקה יחסית",NEUTRAL:"חוזק יחסי ניטרלי",LAGGARD:"חלשה יחסית",UNKNOWN:"לא ידוע"};
export const sectorHe:Record<string,string>={TAILWIND:"רוח גבית מהסקטור",HEADWIND:"רוח נגדית מהסקטור",NEUTRAL:"סקטור ניטרלי",UNKNOWN:"מצב סקטור לא ידוע"};
export const regimeHe:Record<MarketRegime|string,string>={RISK_ON:"שוק תומך בסיכון / לונגים",RISK_OFF:"שוק במצב הגנתי",TREND_UP:"מגמת שוק עולה",TREND_DOWN:"מגמת שוק יורדת",CHOP:"שוק מדשדש ולא נקי",HIGH_VOL:"תנודתיות גבוהה",UNKNOWN:"מצב שוק לא ידוע"};
export const playbookHe:Record<PlaybookId|string,string>={BREAKOUT:"פריצה",PULLBACK:"תיקון בתוך מגמה",MOMENTUM_CONTINUATION:"המשך מומנטום",SUPPORT_BOUNCE:"קפיצה מתמיכה",GAP_CONTINUATION:"המשך גאפ",EARNINGS_CONTINUATION:"המשך תנועה אחרי דוחות",RELATIVE_STRENGTH_BREAKOUT:"פריצה עם חוזק יחסי",TREND_RECLAIM:"חזרה למגמה",VOLATILITY_SQUEEZE:"כיווץ תנודתיות לפני מהלך",NONE:"ללא תבנית ברורה"};

export type GateKey="liveQuote"|"dataQuality"|"trueMtf"|"liquidity"|"bullishTrend"|"multiTimeframe"|"relativeVolume"|"definedStop"|"riskReward"|"structuralRoom"|"marketOpen"|"marketNotRiskOff"|"sectorNotHeadwind"|"eventRiskClear"|"headlineRiskClear"|"catalystNotBlocked"|"noChase"|"portfolioCapacity"|"sectorCapacity"|"noDuplicate";
export interface GateHe {title:string; ok:string; fail:string; importance:"חובה"|"תומך";}
export const gatesHe:Record<GateKey,GateHe>={
  liveQuote:{title:"מחיר שוק עדכני",ok:"יש מחיר שוק זמין",fail:"אין מחיר שוק אמין",importance:"חובה"},
  dataQuality:{title:"איכות נתונים",ok:"יש מספיק נתונים טכניים לקבלת החלטה",fail:"חסרים נתוני נרות/נפח ולכן אי אפשר לאמת את העסקה",importance:"חובה"},
  trueMtf:{title:"היסטוריה רב־טווחית",ok:"יש מספיק היסטוריה אמינה ל־5 דקות, 15 דקות, שעה ויומי",fail:"אין מספיק היסטוריה אמינה בכל טווחי הזמן",importance:"חובה"},
  liquidity:{title:"נזילות",ok:"מחזור המסחר הדולרי מספיק לעסקה",fail:"המניה דלילה מדי ביחס לרף הנזילות שלנו",importance:"חובה"},
  bullishTrend:{title:"מגמה עולה",ok:"המגמה הטכנית תומכת בלונג",fail:"המגמה עדיין לא שורית מספיק",importance:"תומך"},
  multiTimeframe:{title:"התאמה בין טווחי זמן",ok:"כמה טווחי זמן מצביעים לאותו כיוון",fail:"טווחי הזמן לא מסונכרנים מספיק",importance:"תומך"},
  relativeVolume:{title:"אישור נפח",ok:"הנפח היחסי מספיק חזק",fail:"אין עדיין אישור נפח מספק",importance:"תומך"},
  definedStop:{title:"סטופ מוגדר",ok:"יש נקודת ביטול ברורה לעסקה",fail:"אין סטופ אמין ולכן אי אפשר לחשב סיכון",importance:"חובה"},
  riskReward:{title:"יחס סיכוי/סיכון",ok:"יחס הסיכוי/סיכון עומד בדרישה",fail:"יחס הסיכוי/סיכון נמוך מדי או לא ניתן לחישוב",importance:"חובה"},
  structuralRoom:{title:"מרווח עד התנגדות",ok:"יש מספיק מרווח מבני עד ההתנגדות הבאה",fail:"ההתנגדות הבאה קרובה מדי ולא משאירה מספיק מקום לעסקה",importance:"חובה"},
  marketOpen:{title:"שעות מסחר",ok:"השוק פתוח למסחר רגיל",fail:"השוק לא פתוח כרגע; לא מאשרים ביצוע על בסיס נתוני סשן חסרים",importance:"חובה"},
  marketNotRiskOff:{title:"מצב השוק",ok:"השוק הרחב לא נמצא במצב Risk-Off",fail:"השוק הרחב במצב הגנתי שמקשה על עסקאות לונג",importance:"תומך"},
  sectorNotHeadwind:{title:"מצב הסקטור",ok:"הסקטור אינו מהווה רוח נגדית",fail:"הסקטור חלש ומפעיל לחץ נגד העסקה",importance:"תומך"},
  eventRiskClear:{title:"סיכון אירועים",ok:"אין כרגע אירוע קרוב שחוסם כניסה",fail:"יש דוחות/אירוע מאקרו קרוב שחוסם כניסה לפי החוקים",importance:"חובה"},
  headlineRiskClear:{title:"סיכון חדשות",ok:"לא זוהתה כותרת שלילית קריטית",fail:"זוהתה כותרת שלילית קריטית שמחייבת להימנע",importance:"חובה"},
  catalystNotBlocked:{title:"קטליזטור",ok:"מנוע הקטליזטורים לא זיהה חסימה",fail:"מנוע הקטליזטורים זיהה סיבה שמונעת כניסה",importance:"חובה"},
  noChase:{title:"לא רודפים אחרי המחיר",ok:"המחיר לא מורחב בצורה שמפעילה כלל No-Chase",fail:"המחיר כבר מורחב מדי; לא רודפים אחרי העסקה",importance:"חובה"},
  portfolioCapacity:{title:"תקציב סיכון בתיק",ok:"יש מספיק תקציב סיכון פנוי בתיק",fail:"אין מספיק תקציב סיכון פנוי לעסקה נוספת",importance:"חובה"},
  sectorCapacity:{title:"ריכוז סקטוריאלי",ok:"החשיפה לסקטור עדיין בגבולות המותרים",fail:"כבר קיימת חשיפה גבוהה מדי לאותו סקטור",importance:"חובה"},
  noDuplicate:{title:"אין עסקה כפולה",ok:"אין כבר עסקה פתוחה באותה מניה",fail:"כבר קיימת עסקה או תוכנית פתוחה באותה מניה",importance:"חובה"},
};

function n(v:number|undefined,d=2){return v==null?"—":v.toFixed(d)}
export function translateEnglishReason(reason:string|undefined){if(!reason)return "";const r=reason.toLowerCase();if(r.includes("data-quality gate"))return "איכות הנתונים אינה מספיקה לביצוע. חסרים נתוני OHLCV אמינים, ולכן המערכת לא מוכנה להמציא מגמה, נפח, סטופ או יחס סיכוי/סיכון.";if(r.includes("event-risk lock"))return "קיים אירוע סיכון קרוב (כגון דוחות או אירוע מאקרו משמעותי), ולכן הכניסה חסומה לפי כללי ניהול הסיכון.";if(r.includes("headline-risk"))return "מנוע החדשות זיהה כותרת שלילית קריטית, ולכן העסקה חסומה כרגע.";if(r.includes("catalyst engine"))return "מנוע הקטליזטורים זיהה גורם שלילי שמונע כניסה כרגע.";if(r.includes("extended")||r.includes("no-chase"))return "המחיר כבר התרחק יותר מדי מאזור הכניסה. לפי כלל No-Chase אנחנו לא רודפים אחרי המניה.";if(r.includes("ohlcv"))return "חסרים נתוני נרות ונפח מלאים, ולכן אי אפשר לאמת את המבנה הטכני בצורה בטוחה.";return reason;}

export function explainEntryHe(symbol:string,verdict:string,reason:string|undefined,gates:Record<string,boolean>,plan?:TradePlan){
  const details=Object.entries(gates).map(([key,passed])=>{const g=gatesHe[key as GateKey]??{title:key,ok:"עבר",fail:"נכשל",importance:"תומך" as const};return{key,title:g.title,passed:Boolean(passed),importance:g.importance,message:passed?g.ok:g.fail}});
  const failed=details.filter(x=>!x.passed),passed=details.filter(x=>x.passed);
  const hardFailed=failed.filter(x=>x.importance==="חובה");
  let primary=translateEnglishReason(reason);
  if(hardFailed.length){const first=hardFailed[0];if(!primary||primary===reason)primary=first.message;}
  const next:string[]=[];
  if(!gates.dataQuality)next.push("להמתין לנתוני OHLCV מלאים ועדכניים כדי לחשב מגמה, נפח, ATR, סטופ ויעדים.");
  if(!gates.trueMtf)next.push("להמתין עד שיהיו מספיק נרות בכל טווחי הזמן כדי שהניתוח הרב־טווחי יהיה אמין.");
  if(!gates.liquidity)next.push("להמתין לנזילות טובה יותר או לבחור מניה עם מחזור מסחר גבוה יותר כדי לצמצם Slippage.");
  if(!gates.bullishTrend)next.push("להמתין למבנה טכני שורי יותר ולאישור מגמה.");
  if(!gates.multiTimeframe)next.push("להמתין להתאמה טובה יותר בין 5 דקות, 15 דקות, שעה ויומי.");
  if(!gates.relativeVolume)next.push("להמתין לעלייה בנפח היחסי שתאשר שהמהלך מקבל השתתפות אמיתית.");
  if(!gates.definedStop)next.push("להמתין למבנה שמאפשר לקבוע סטופ ברור ולא שרירותי.");
  if(!gates.riskReward)next.push("להמתין למחיר כניסה שמייצר יחס סיכוי/סיכון של לפחות 1:2.");
  if(!gates.structuralRoom)next.push("להמתין למבנה עם יותר מרווח עד ההתנגדות הבאה.");
  if(!gates.marketOpen)next.push("לבצע בדיקת כניסה נוספת בזמן המסחר הרגיל, כאשר נתוני הסשן מלאים.");
  if(!gates.marketNotRiskOff)next.push("להמתין לשיפור בסביבה הרחבה או לסט־אפ חריג בעוצמתו שמצדיק זהירות נוספת.");
  if(!gates.sectorNotHeadwind)next.push("להמתין לשיפור בסקטור או לחוזק יחסי מובהק של המניה מולו.");
  if(!gates.eventRiskClear)next.push("להמתין עד שאירוע הסיכון יעבור ורק אז להעריך מחדש.");
  if(!gates.headlineRiskClear||!gates.catalystNotBlocked)next.push("לבדוק מחדש אחרי שהסיכון החדשותי/הקטליזטור יתבהר.");
  if(!gates.noChase)next.push("להמתין לתיקון/התבססות במקום לרדוף אחרי המחיר.");
  if(!gates.portfolioCapacity)next.push("לפנות תקציב סיכון בתיק או להקטין סיכון לפני פתיחת עסקה חדשה.");
  if(!gates.sectorCapacity)next.push("להימנע מהגדלת הריכוז באותו סקטור כרגע.");
  if(!gates.noDuplicate)next.push("לנהל את העסקה הקיימת במקום לפתוח עסקה כפולה באותו סימבול.");
  if(!next.length&&verdict!=="ENTER")next.push(plan?.trigger?`להמתין לטריגר: ${plan.trigger}`:"להמשיך לעקוב ולבצע בדיקה חדשה כאשר התנאים משתנים.");
  const positives=passed.filter(x=>["liveQuote","liquidity","marketNotRiskOff","sectorNotHeadwind","eventRiskClear","headlineRiskClear","noChase","bullishTrend","relativeVolume","multiTimeframe"].includes(x.key)).map(x=>x.message).slice(0,5);
  return{
    verdictCode:verdict,
    verdictLabel:verdictHe[verdict]??verdict,
    title:verdict==="ENTER"?`${symbol}: תנאי הכניסה עברו`:`${symbol}: לא נכנסים כרגע`,
    primaryReason:primary||"לא כל תנאי הכניסה הנדרשים עברו.",
    positives,
    blockers:failed.map(x=>x.message),
    nextSteps:next,
    gateDetails:details,
    levels:{entry:plan?.entry,stop:plan?.stop,tp1:plan?.tp1,tp2:plan?.tp2,riskReward:plan?.riskReward},
    snapshot:{score:plan?.setupScore,conviction:plan?.convictionScore,dataQuality:plan?.dataQualityPct,trend:plan?.technicals?.trend?trendHe[plan.technicals.trend]:undefined,relativeStrength:plan?.context?.relativeStrengthGrade?rsHe[plan.context.relativeStrengthGrade]:undefined,marketRegime:plan?.context?.marketRegime?regimeHe[plan.context.marketRegime]:undefined,sector:plan?.context?.sectorAlignment?sectorHe[plan.context.sectorAlignment]:undefined,playbook:plan?.playbook?playbookHe[plan.playbook]:undefined,rvol:plan?.technicals?.relativeVolume,volumeZ:plan?.technicals?.volumeZScore},
  };
}

export function planSummaryHe(p:TradePlan){return `${p.symbol} · ${statusHe[p.status]??p.status} · ${verdictHe[p.verdict]??p.verdict}\nציון עסקה: ${n(p.setupScore,1)}/10 · ביטחון: ${p.convictionScore??"—"}% · איכות נתונים: ${p.dataQualityPct??0}%\nכניסה: ${n(p.entry)} | סטופ: ${n(p.stop)} | יעד 1: ${n(p.tp1)} | יעד 2: ${n(p.tp2)} | יחס סיכוי/סיכון: ${p.riskReward??"—"}\nתבנית: ${playbookHe[p.playbook??"NONE"]} · חוזק יחסי: ${rsHe[p.context?.relativeStrengthGrade??"UNKNOWN"]}\nRVOL: ${p.technicals?.relativeVolume??"—"}x · Volume Z: ${p.technicals?.volumeZScore??"—"} · התאמת למידה: ${p.learningAdjustment??0}`;}
