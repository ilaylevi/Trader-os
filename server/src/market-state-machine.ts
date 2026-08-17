import type { MarketRegime } from "@trader-os/shared";

export type MarketPhase="PREMARKET_DISCOVERY"|"OPENING_DRIVE"|"TREND_EXPANSION"|"MIDDAY_COMPRESSION"|"AFTERNOON_REACCELERATION"|"DISTRIBUTION"|"CLOSED"|"UNKNOWN";
function nyParts(){const p=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",hour12:false,hour:"2-digit",minute:"2-digit",weekday:"short"}).formatToParts(new Date()),g=(t:string)=>p.find(x=>x.type===t)?.value??"";return{day:g("weekday"),m:Number(g("hour"))*60+Number(g("minute"))}}
export function deriveMarketPhase(input:{regime?:MarketRegime;breadthAdvancePct?:number;avgChangePct?:number;volatilityPct?:number}){
  const {day,m}=nyParts();if(["Sat","Sun"].includes(day))return{phase:"CLOSED" as MarketPhase,labelHe:"השוק סגור",confidence:100,reasons:["סוף שבוע בארה״ב."]};
  if(m<570)return{phase:m>=240?"PREMARKET_DISCOVERY":"CLOSED" as MarketPhase,labelHe:m>=240?"טרום מסחר — גילוי":"השוק סגור",confidence:90,reasons:["לפני פתיחת המסחר הרגיל."]};
  if(m<600)return{phase:"OPENING_DRIVE" as MarketPhase,labelHe:"פתיחה — תנועה ראשונית",confidence:85,reasons:["30 הדקות הראשונות מאופיינות בגילוי מחיר ותנודתיות גבוהה."]};
  if(m<720){const dist=Math.abs(input.avgChangePct??0),wide=Math.abs((input.breadthAdvancePct??50)-50)>12;return{phase:(dist>.45&&wide)?"TREND_EXPANSION":"MIDDAY_COMPRESSION" as MarketPhase,labelHe:(dist>.45&&wide)?"התרחבות מגמה":"התבססות אחרי הפתיחה",confidence:70,reasons:[`רוחב ${input.breadthAdvancePct??"—"}% · שינוי ממוצע ${input.avgChangePct??"—"}%.`]}}
  if(m<840)return{phase:"MIDDAY_COMPRESSION" as MarketPhase,labelHe:"אמצע היום — דחיסת תנודתיות",confidence:75,reasons:["אמצע יום נוטה להיות איטי יותר; דורשים Confirmation חזק יותר."]};
  if(m<930)return{phase:"AFTERNOON_REACCELERATION" as MarketPhase,labelHe:"אחה״צ — חידוש מומנטום",confidence:75,reasons:["הנזילות והמומנטום נוטים לחזור לקראת השעות האחרונות."]};
  if(m<960)return{phase:input.regime==="RISK_OFF"?"DISTRIBUTION":"AFTERNOON_REACCELERATION" as MarketPhase,labelHe:input.regime==="RISK_OFF"?"חלוקה / לחץ לקראת סגירה":"שעת הסיום",confidence:75,reasons:[`משטר שוק ${input.regime??"UNKNOWN"}.`]};
  return{phase:"CLOSED" as MarketPhase,labelHe:"השוק סגור",confidence:100,reasons:["אחרי סגירת המסחר הרגיל."]};
}
