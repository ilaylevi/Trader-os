import type { PlaybookId, TechnicalSnapshot, TimeframeSnapshot, TradePlan, Trend, MarketQuote, MarketSession } from "@trader-os/shared";
import type { Candle } from "./market-data.js";

function round(value:number,digits=2){return Number(value.toFixed(digits))}
function mean(values:number[]){return values.length?values.reduce((a,b)=>a+b,0)/values.length:undefined}
function stddev(values:number[]){if(values.length<2)return undefined;const m=mean(values)!;return Math.sqrt(values.reduce((s,x)=>s+(x-m)**2,0)/(values.length-1))}
export function sma(values:number[],period:number){if(values.length<period)return undefined;return mean(values.slice(-period))}
export function rsi(values:number[],period=14){if(values.length<=period)return undefined;const slice=values.slice(-(period+1));let gains=0,losses=0;for(let i=1;i<slice.length;i++){const d=slice[i]-slice[i-1];if(d>=0)gains+=d;else losses+=Math.abs(d)}const ag=gains/period,al=losses/period;if(al===0)return 100;return 100-100/(1+ag/al)}
export function atr(candles:Candle[],period=14){if(candles.length<=period)return undefined;const slice=candles.slice(-(period+1)),trs:number[]=[];for(let i=1;i<slice.length;i++){const c=slice[i],p=slice[i-1];trs.push(Math.max(c.high-c.low,Math.abs(c.high-p.close),Math.abs(c.low-p.close)))}return mean(trs.slice(-period))}

const nyFmt=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
function nyParts(epoch:number){const ps=nyFmt.formatToParts(new Date(epoch*1000));const g=(t:string)=>ps.find(p=>p.type===t)?.value??"";return{date:`${g("year")}-${g("month")}-${g("day")}`,minutes:Number(g("hour"))*60+Number(g("minute"))}}
function regularSessionBars(candles:Candle[]){if(!candles.length)return[];const dates=candles.map(c=>nyParts(c.time).date),last=dates.at(-1);return candles.filter(c=>{const p=nyParts(c.time);return p.date===last&&p.minutes>=570&&p.minutes<960})}
function completeBars(candles:Candle[],seconds=300){if(!candles.length)return[];const now=Math.floor(Date.now()/1000),copy=[...candles];if(now<(copy.at(-1)!.time+seconds+15))copy.pop();return copy}
export function sessionVwap(candles:Candle[]){const bars=regularSessionBars(candles).filter(x=>x.volume>0);if(!bars.length)return undefined;const vol=bars.reduce((s,x)=>s+x.volume,0);return vol?bars.reduce((s,x)=>s+((x.high+x.low+x.close)/3)*x.volume,0)/vol:undefined}

function aggregateCandles(candles:Candle[],bucketSeconds:number){const buckets=new Map<number,Candle[]>();for(const c of candles){const b=Math.floor(c.time/bucketSeconds)*bucketSeconds,l=buckets.get(b)??[];l.push(c);buckets.set(b,l)}return[...buckets.entries()].sort((a,b)=>a[0]-b[0]).map(([time,bars])=>({time,open:bars[0].open,high:Math.max(...bars.map(x=>x.high)),low:Math.min(...bars.map(x=>x.low)),close:bars.at(-1)!.close,volume:bars.reduce((s,x)=>s+x.volume,0)}))}
function timeframeSnapshot(timeframe:TimeframeSnapshot["timeframe"],candles:Candle[]):TimeframeSnapshot{const closes=candles.map(x=>x.close),s20=sma(closes,20),s50=sma(closes,50),r=rsi(closes,14),latest=closes.at(-1),prev=closes.length>=6?closes.at(-6):closes.at(0);let trend:Trend="UNKNOWN";if(latest!==undefined&&s20!==undefined){trend=s50!==undefined?(latest>s20&&s20>s50?"BULLISH":latest<s20&&s20<s50?"BEARISH":"NEUTRAL"):(latest>s20?"BULLISH":latest<s20?"BEARISH":"NEUTRAL")}return{timeframe,trend,sma20:s20?round(s20):undefined,sma50:s50?round(s50):undefined,rsi14:r?round(r,1):undefined,momentumPct:latest&&prev?round((latest/prev-1)*100,2):undefined,bars:candles.length}}
export function buildMultiTimeframe(intraday5:Candle[],daily:Candle[]=[]){const clean=completeBars(intraday5),m15=aggregateCandles(clean,900),h1=aggregateCandles(clean,3600);return[timeframeSnapshot("5m",clean),timeframeSnapshot("15m",m15),timeframeSnapshot("1h",h1),timeframeSnapshot("1d",daily)]}
function mtfQuality(frames:TimeframeSnapshot[]){const req:{[k:string]:number}={"5m":150,"15m":50,"1h":50,"1d":60};return Math.round(frames.reduce((s,f)=>s+Math.min(1,f.bars/(req[f.timeframe]??50)),0)/frames.length*100)}

function timeOfDayRelativeVolume(candles:Candle[]){const bars=completeBars(candles);const latest=bars.at(-1);if(!latest)return{};const lp=nyParts(latest.time),slot=lp.minutes;const history=bars.slice(0,-1).filter(c=>{const p=nyParts(c.time);return p.date!==lp.date&&Math.abs(p.minutes-slot)<=2&&c.volume>0}).map(c=>c.volume);if(history.length>=3){const avg=mean(history)!,sd=stddev(history);return{relativeVolume:avg>0?latest.volume/avg:undefined,volumeZScore:sd&&sd>0?(latest.volume-avg)/sd:undefined,method:"TIME_OF_DAY" as const}}
 const rolling=bars.slice(-31,-1).map(x=>x.volume).filter(v=>v>0),avg=mean(rolling),sd=stddev(rolling);return{relativeVolume:latest&&avg&&avg>0?latest.volume/avg:undefined,volumeZScore:latest&&avg&&sd&&sd>0?(latest.volume-avg)/sd:undefined,method:"ROLLING" as const}}

function structuralReferenceLevels(candles:Candle[],daily:Candle[]){
 const clean=completeBars(candles),currentDate=clean.length?nyParts(clean.at(-1)!.time).date:undefined,dates=[...new Set(clean.map(x=>nyParts(x.time).date))];
 const prevDate=dates.length>=2?dates.at(-2):undefined,prevBars=prevDate?clean.filter(x=>nyParts(x.time).date===prevDate&&nyParts(x.time).minutes>=570&&nyParts(x.time).minutes<960):[];
 const session=currentDate?clean.filter(x=>{const p=nyParts(x.time);return p.date===currentDate&&p.minutes>=570&&p.minutes<960}):[];
 const opening=session.filter(x=>{const m=nyParts(x.time).minutes;return m>=570&&m<600});
 const week=daily.slice(-6,-1).length?daily.slice(-6,-1):daily.slice(-5),month=daily.slice(-22,-1).length?daily.slice(-22,-1):daily.slice(-21);
 const previousDayHigh=prevBars.length?Math.max(...prevBars.map(x=>x.high)):daily.length>=2?daily.at(-2)?.high:undefined,previousDayLow=prevBars.length?Math.min(...prevBars.map(x=>x.low)):daily.length>=2?daily.at(-2)?.low:undefined;
 const recent=clean.slice(-120);let anchoredVwap:number|undefined;if(recent.length){let pivotIdx=0;for(let i=1;i<recent.length;i++)if(recent[i].low<recent[pivotIdx].low)pivotIdx=i;const anchor=recent.slice(pivotIdx).filter(x=>x.volume>0),vol=anchor.reduce((a,b)=>a+b.volume,0);if(vol>0)anchoredVwap=anchor.reduce((a,b)=>a+((b.high+b.low+b.close)/3)*b.volume,0)/vol}
 let volumeProfilePoc:number|undefined;const profile=clean.slice(-390).filter(x=>x.volume>0);if(profile.length){const lo=Math.min(...profile.map(x=>x.low)),hi=Math.max(...profile.map(x=>x.high)),bins=24,w=(hi-lo)/bins;if(w>0){const vols=Array.from({length:bins},()=>0);for(const b of profile){const px=(b.high+b.low+b.close)/3,idx=Math.max(0,Math.min(bins-1,Math.floor((px-lo)/w)));vols[idx]+=b.volume}let best=0;for(let i=1;i<bins;i++)if(vols[i]>vols[best])best=i;volumeProfilePoc=lo+w*(best+.5)}}
 return{previousDayHigh,previousDayLow,weeklyHigh:week.length?Math.max(...week.map(x=>x.high)):undefined,weeklyLow:week.length?Math.min(...week.map(x=>x.low)):undefined,monthlyHigh:month.length?Math.max(...month.map(x=>x.high)):undefined,monthlyLow:month.length?Math.min(...month.map(x=>x.low)):undefined,openingRangeHigh:opening.length?Math.max(...opening.map(x=>x.high)):undefined,openingRangeLow:opening.length?Math.min(...opening.map(x=>x.low)):undefined,anchoredVwap,volumeProfilePoc};
}

function pivotLows(candles:Candle[]){const a=candles.slice(-80),out:number[]=[];for(let i=2;i<a.length-2;i++)if(a[i].low<=a[i-1].low&&a[i].low<=a[i-2].low&&a[i].low<=a[i+1].low&&a[i].low<=a[i+2].low)out.push(a[i].low);return out}
function overheadLevels(entry:number,hourly:Candle[],daily:Candle[]){const vals=[...hourly.slice(-120).map(x=>x.high),...daily.slice(-120).map(x=>x.high)].filter(x=>x>entry*1.002).sort((a,b)=>a-b);return vals.filter((x,i)=>i===0||Math.abs(x-vals[i-1])/entry>.003)}

function buildTechnicals(quote:MarketQuote,intraday:Candle[],daily:Candle[]=[]):TechnicalSnapshot{const candles=completeBars(intraday),closes=candles.map(x=>x.close),s20=sma(closes,20),s50=sma(closes,50),rsi14=rsi(closes,14),atr14=atr(candles,14),previousBars=candles.slice(-41,-1),resistance=previousBars.length?Math.max(...previousBars.map(x=>x.high)):undefined,support=previousBars.length?Math.min(...previousBars.map(x=>x.low)):undefined,latest=candles.at(-1),previous=candles.at(-2),rv=timeOfDayRelativeVolume(candles),refs=structuralReferenceLevels(candles,daily);let trend:Trend="UNKNOWN";if(s20&&s50)trend=quote.price>s20&&s20>s50?"BULLISH":quote.price<s20&&s20<s50?"BEARISH":"NEUTRAL";else if(s20)trend=quote.price>s20?"BULLISH":quote.price<s20?"BEARISH":"NEUTRAL";const trigger=resistance?resistance*1.001:undefined,multiTimeframe=buildMultiTimeframe(candles,daily),usable=multiTimeframe.filter(x=>x.trend!=="UNKNOWN"),bulls=usable.filter(x=>x.trend==="BULLISH").length,alignment=usable.length?bulls/usable.length*100:0,vw=sessionVwap(candles),gapPct=quote.open&&quote.previousClose?((quote.open/quote.previousClose)-1)*100:undefined,move=Math.abs(quote.price-(quote.previousClose??previous?.close??quote.price)),priceExpansionAtr=atr14&&atr14>0?move/atr14:undefined,ranges=candles.slice(-20).map(x=>x.high-x.low).filter(x=>x>0),avgRange=mean(ranges),recentRange=latest?latest.high-latest.low:undefined,compressionPct=avgRange&&recentRange!==undefined?Math.max(0,Math.min(100,(1-recentRange/avgRange)*100)):undefined,dailyDollarVolumes=daily.slice(-20).filter(x=>x.volume>0&&x.close>0).map(x=>x.volume*x.close),averageDollarVolume20d=mean(dailyDollarVolumes);
 return{trend,sma20:s20?round(s20):undefined,sma50:s50?round(s50):undefined,rsi14:rsi14?round(rsi14,1):undefined,atr14:atr14?round(atr14):undefined,relativeVolume:rv.relativeVolume?round(rv.relativeVolume,2):undefined,relativeVolumeMethod:rv.method,volumeZScore:rv.volumeZScore!==undefined?round(rv.volumeZScore,2):undefined,support:support?round(support):undefined,resistance:resistance?round(resistance):undefined,distanceToTriggerPct:trigger?round(((trigger-quote.price)/quote.price)*100,2):undefined,vwap:vw?round(vw):undefined,sessionVwap:vw?round(vw):undefined,multiTimeframe,timeframeAlignmentPct:round(alignment,0),mtfQualityPct:mtfQuality(multiTimeframe),priceExpansionAtr:priceExpansionAtr!==undefined?round(priceExpansionAtr,2):undefined,gapPct:gapPct!==undefined?round(gapPct,2):undefined,abnormalVolume:(rv.volumeZScore??0)>=2||(rv.relativeVolume??0)>=1.8,abnormalPriceMove:(priceExpansionAtr??0)>=1.5,compressionPct:compressionPct!==undefined?round(compressionPct,1):undefined,averageDollarVolume20d:averageDollarVolume20d!==undefined?round(averageDollarVolume20d,0):undefined,previousDayHigh:refs.previousDayHigh?round(refs.previousDayHigh):undefined,previousDayLow:refs.previousDayLow?round(refs.previousDayLow):undefined,weeklyHigh:refs.weeklyHigh?round(refs.weeklyHigh):undefined,weeklyLow:refs.weeklyLow?round(refs.weeklyLow):undefined,monthlyHigh:refs.monthlyHigh?round(refs.monthlyHigh):undefined,monthlyLow:refs.monthlyLow?round(refs.monthlyLow):undefined,openingRangeHigh:refs.openingRangeHigh?round(refs.openingRangeHigh):undefined,openingRangeLow:refs.openingRangeLow?round(refs.openingRangeLow):undefined,anchoredVwap:refs.anchoredVwap?round(refs.anchoredVwap):undefined,volumeProfilePoc:refs.volumeProfilePoc?round(refs.volumeProfilePoc):undefined}}

export function classifyPlaybook(quote:MarketQuote,t:TechnicalSnapshot):PlaybookId{
 const gap=t.gapPct??0,distSma=t.sma20?Math.abs(quote.price/t.sma20-1)*100:99,distSupport=t.support?Math.abs(quote.price/t.support-1)*100:99,above=t.sessionVwap?quote.price>t.sessionVwap:false;
 if(t.trend==="BULLISH"&&(t.timeframeAlignmentPct??0)>=75&&(t.relativeVolume??0)>=1.3&&(t.distanceToTriggerPct??99)<=1.2)return"RELATIVE_STRENGTH_BREAKOUT";
 if(gap>=2&&t.trend==="BULLISH"&&(t.relativeVolume??0)>=1.05)return"GAP_CONTINUATION";
 if(t.trend==="BULLISH"&&(t.relativeVolume??0)>=1.5&&(quote.changePct??0)>=2)return"MOMENTUM_CONTINUATION";
 if(t.trend==="BULLISH"&&t.distanceToTriggerPct!==undefined&&t.distanceToTriggerPct>=-.5&&t.distanceToTriggerPct<=1.5)return"BREAKOUT";
 if(t.trend!=="BEARISH"&&above&&t.sma20&&quote.price>=t.sma20&&distSma<=.8&&(t.rsi14??0)>=48)return"TREND_RECLAIM";
 if((t.compressionPct??0)>=35&&t.trend!=="BEARISH"&&(t.distanceToTriggerPct??99)<=2)return"VOLATILITY_SQUEEZE";
 if(t.trend==="BULLISH"&&distSma<=1.25&&(t.rsi14??100)>=42&&(t.rsi14??0)<=64)return"PULLBACK";
 if(distSupport<=1.25&&(quote.changePct??0)>=-1)return"SUPPORT_BOUNCE";
 return"NONE"
}

type PlannedLevels={
 entry?:number;stop?:number;tp1?:number;tp2?:number;riskReward?:number;
 levelQuality:"STRUCTURAL"|"HYBRID"|"ATR_FALLBACK"|"NONE";
 entryLogic?:string;stopLogic?:string;targetLogic?:string;notes:string[];
};
function nearestPivotBelow(candles:Candle[],price:number){return pivotLows(candles).filter(x=>x<price).sort((a,b)=>b-a)[0]}
function recentMicroHigh(candles:Candle[]){const bars=candles.slice(-8,-1);return bars.length?Math.max(...bars.map(x=>x.high)):undefined}
function validRisk(entry:number,stop:number,atrValue:number,minAtr=.45,maxAtr=2.2){const r=entry-stop;return r>0&&r>=atrValue*minAtr&&r<=atrValue*maxAtr}
function structuralStop(entry:number,atrValue:number,candidates:Array<{value?:number;name:string}>,maxAtr=2.2){
 const usable=candidates.filter(x=>x.value!==undefined&&Number.isFinite(x.value!)&&x.value!<entry).sort((a,b)=>b.value!-a.value!);
 for(const c of usable){const stop=round(c.value!-atrValue*.16);if(validRisk(entry,stop,atrValue,.48,maxAtr))return{stop,source:c.name}}
 return undefined;
}
function buildTargets(entry:number,stop:number,hourly:Candle[],daily:Candle[]){
 const risk=entry-stop,levels=overheadLevels(entry,hourly,daily),nearest=levels[0],roomR=nearest?(nearest-entry)/risk:undefined;
 if(nearest&&roomR!==undefined&&roomR<1.45)return{blocked:true,nearest:round(nearest),roomR:round(roomR,2),reason:`ההתנגדות המבנית הקרובה נמצאת רק ${round(roomR,1)}R מעל הכניסה`};
 const structuralTp1=levels.find(x=>(x-entry)/risk>=1.55),structuralTp2=levels.find(x=>(x-entry)/risk>=2.45);
 const tp1=round(structuralTp1??entry+risk*2),tp2=round(structuralTp2??Math.max(entry+risk*3,tp1+risk*.65));
 return{blocked:false,nearest:nearest?round(nearest):undefined,roomR:roomR!==undefined?round(roomR,2):undefined,tp1,tp2,riskReward:round((tp2-entry)/risk,2),structuralTargets:Boolean(structuralTp1||structuralTp2)};
}
function planLongLevels(playbook:PlaybookId,quote:MarketQuote,t:TechnicalSnapshot,clean:Candle[],daily:Candle[]):PlannedLevels{
 const notes:string[]=[],atrValue=t.atr14;if(!atrValue||atrValue<=0||(t.mtfQualityPct??0)<70)return{levelQuality:"NONE",notes:["אין מספיק ATR/Multi-Timeframe כדי לבנות רמות אמינות"]};
 if(playbook==="NONE")return{levelQuality:"NONE",notes:["לא זוהתה תבנית מסחר מוגדרת ולכן לא בונים רמות בכוח"]};
 const hourly=aggregateCandles(clean,3600),microHigh=recentMicroHigh(clean),pivot=nearestPivotBelow(clean,quote.price),res=t.resistance,support=t.support,vwap=t.sessionVwap,sma=t.sma20;
 let entry:number|undefined,entryLogic="",stopResult:{stop:number;source:string}|undefined,maxRiskAtr=2.2;
 const breakoutLike=new Set<PlaybookId>(["BREAKOUT","RELATIVE_STRENGTH_BREAKOUT","VOLATILITY_SQUEEZE"]);
 if(breakoutLike.has(playbook)){
   if(!res)return{levelQuality:"NONE",notes:["לתבנית פריצה חסרה התנגדות ברורה שממנה ניתן להגדיר טריגר"]};
   entry=round(res*1.001);entryLogic=`כניסה רק בפריצה מאושרת מעל ההתנגדות ${round(res)}`;
   stopResult=structuralStop(entry,atrValue,[{value:pivot,name:"שפל מבני אחרון"},{value:t.anchoredVwap,name:"Anchored VWAP"},{value:vwap,name:"VWAP של הסשן"},{value:t.openingRangeLow,name:"שפל טווח הפתיחה"},{value:t.previousDayLow,name:"שפל יום קודם"},{value:sma,name:"SMA20"},{value:support,name:"תמיכה תוך-יומית"}],2.0);
 }else if(playbook==="GAP_CONTINUATION"||playbook==="MOMENTUM_CONTINUATION"){
   const trigger=Math.max(res??0,microHigh??0);if(!trigger)return{levelQuality:"NONE",notes:["לא נמצאה רמת אישור קצרה למומנטום"]};
   entry=round(trigger*1.0008);entryLogic=`כניסה רק בהמשך מומנטום מעל ${round(trigger)}, לא ברדיפה אחרי נר מורחב`;
   stopResult=structuralStop(entry,atrValue,[{value:vwap,name:"VWAP של הסשן"},{value:t.anchoredVwap,name:"Anchored VWAP"},{value:pivot,name:"שפל מומנטום אחרון"},{value:t.openingRangeLow,name:"שפל טווח הפתיחה"},{value:sma,name:"SMA20"},{value:support,name:"תמיכה"}],1.85);maxRiskAtr=1.85;
 }else if(playbook==="PULLBACK"){
   const trigger=microHigh??quote.price;entry=round(Math.max(quote.price,trigger*1.0005));entryLogic="כניסה לאחר שה-Pullback מציג חזרה כלפי מעלה מעל שיא קצר של נר אישור";
   stopResult=structuralStop(entry,atrValue,[{value:pivot,name:"שפל ה-Pullback"},{value:t.anchoredVwap,name:"Anchored VWAP"},{value:sma,name:"SMA20"},{value:vwap,name:"VWAP של הסשן"},{value:t.previousDayLow,name:"שפל יום קודם"},{value:support,name:"תמיכה"}],1.75);maxRiskAtr=1.75;
 }else if(playbook==="SUPPORT_BOUNCE"){
   const trigger=microHigh??quote.price;entry=round(Math.max(quote.price,trigger*1.0005));entryLogic="כניסה רק לאחר אישור Bounce מעל שיא קצר, ולא רק בגלל שהמחיר נגע בתמיכה";
   stopResult=structuralStop(entry,atrValue,[{value:support,name:"רמת התמיכה"},{value:t.previousDayLow,name:"שפל יום קודם"},{value:t.volumeProfilePoc,name:"אזור נפח מרכזי"},{value:pivot,name:"שפל ה-Bounce"}],1.65);maxRiskAtr=1.65;
 }else if(playbook==="TREND_RECLAIM"){
   const reclaim=Math.max(sma??0,vwap??0),trigger=Math.max(reclaim,microHigh??0);if(!trigger)return{levelQuality:"NONE",notes:["חסרה רמת Reclaim ברורה (VWAP/SMA20)"]};
   entry=round(trigger*1.0006);entryLogic=`כניסה לאחר Reclaim ושמירה מעל ${round(reclaim||trigger)}`;
   stopResult=structuralStop(entry,atrValue,[{value:pivot,name:"שפל לפני ה-Reclaim"},{value:t.anchoredVwap,name:"Anchored VWAP"},{value:Math.min(...[sma,vwap].filter((x):x is number=>x!==undefined)),name:"אזור ה-Reclaim"},{value:t.volumeProfilePoc,name:"אזור נפח מרכזי"},{value:support,name:"תמיכה"}],1.8);maxRiskAtr=1.8;
 }
 if(!entry)return{levelQuality:"NONE",notes:["לא ניתן להגדיר טריגר כניסה שמתאים לתבנית"]};
 let levelQuality:PlannedLevels["levelQuality"]="STRUCTURAL";let stop:number|undefined,stopLogic="";
 if(stopResult){stop=stopResult.stop;stopLogic=`סטופ מתחת ל-${stopResult.source} עם מרווח ATR קטן`}
 else{
   const strongEnough=t.trend==="BULLISH"&&(t.timeframeAlignmentPct??0)>=75&&(t.mtfQualityPct??0)>=80&&(t.averageDollarVolume20d??0)>=10_000_000&&(t.relativeVolume??0)>=1.0;
   if(strongEnough){stop=round(entry-atrValue*Math.min(1.05,maxRiskAtr));levelQuality="ATR_FALLBACK";stopLogic="לא נמצא Swing נקי מספיק; משתמשים בסטופ ATR שמרני רק כי המגמה, הנזילות וה-MTF חזקים";notes.push("הסטופ הוא fallback מבוקר ולא רמה מבנית מלאה")}
   else return{entry,levelQuality:"NONE",entryLogic,notes:[...notes,"לא נמצא סטופ מבני קרוב מספיק, והסט-אפ אינו חזק מספיק כדי להתיר ATR fallback"]};
 }
 if(!stop||!validRisk(entry,stop,atrValue,.4,maxRiskAtr))return{entry,levelQuality:"NONE",entryLogic,notes:[...notes,"הסטופ שנמצא אינו עומד בטווח הסיכון הסביר ביחס ל-ATR"]};
 const targets=buildTargets(entry,stop,hourly,daily);
 t.structuralStop=stop;t.nextResistance=targets.nearest;t.roomToResistanceR=targets.roomR;
 if(targets.blocked)return{entry,stop,levelQuality:"NONE",entryLogic,stopLogic,notes:[...notes,targets.reason!]};
 if(!targets.tp1||!targets.tp2||!targets.riskReward||targets.riskReward<2)return{entry,stop,levelQuality:"NONE",entryLogic,stopLogic,notes:[...notes,"לא נמצא מרווח יעד שמאפשר יחס סיכוי/סיכון של לפחות 1:2"]};
 if(levelQuality==="STRUCTURAL"&&!targets.structuralTargets)levelQuality="HYBRID";
 const targetLogic=targets.structuralTargets?"היעדים נבנו מהתנגדויות ב-1H/Daily; במקרה הצורך יעד משני הושלם לפי R":"לא נמצאה התנגדות שימושית מעל 1.5R; היעדים חושבו לפי 2R/3R לאחר בדיקת מרווח התנגדויות";
 return{entry,stop,tp1:targets.tp1,tp2:targets.tp2,riskReward:targets.riskReward,levelQuality,entryLogic,stopLogic,targetLogic,notes};
}

export function analyzeLongSetup(symbol:string,quote:MarketQuote,intraday:Candle[],marketStatus:MarketSession,daily:Candle[]=[]):TradePlan{
 const clean=completeBars(intraday),technicals=buildTechnicals(quote,clean,daily),playbook=classifyPlaybook(quote,technicals),atrValue=technicals.atr14;let score=0;const notes:string[]=[];
 if(technicals.trend==="BULLISH")score+=2.2;else if(technicals.trend==="BEARISH")score-=1.5;
 if((technicals.timeframeAlignmentPct??0)>=75&&(technicals.mtfQualityPct??0)>=75)score+=1.2;else if((technicals.timeframeAlignmentPct??0)<=25)score-=.8;
 if((quote.changePct??0)>0)score+=.65;if((quote.changePct??0)>2)score+=.35;
 if((technicals.relativeVolume??0)>=1.5)score+=1.5;else if((technicals.relativeVolume??0)>=1.2)score+=1.1;else if((technicals.relativeVolume??0)>=.9)score+=.35;
 if(technicals.rsi14!==undefined&&technicals.rsi14>=50&&technicals.rsi14<=70)score+=.9;
 if((technicals.rsi14??0)>75){score-=1.1;notes.push("RSI גבוה — קיים סיכון לרדיפה אחרי מחיר")}
 if(technicals.sessionVwap&&quote.price>technicals.sessionVwap)score+=.45;
 if((technicals.averageDollarVolume20d??0)>=20_000_000)score+=.55;else if((technicals.averageDollarVolume20d??0)>0&&(technicals.averageDollarVolume20d??0)<5_000_000){score-=1.5;notes.push("נזילות דולרית יומית נמוכה מדי לסגנון המסחר שלנו")}
 if(technicals.abnormalVolume){score+=.7;notes.push(`זוהה נפח חריג (${technicals.relativeVolumeMethod==="TIME_OF_DAY"?"בהשוואה לאותה שעה בימים קודמים":"השוואה מתגלגלת"})`)}
 if((technicals.priceExpansionAtr??0)>=1.5&&(technicals.priceExpansionAtr??0)<2.5)score+=.2;
 if((technicals.priceExpansionAtr??0)>=3){score-=1.35;notes.push("המחיר מורחב ביותר מ-3 ATR — כלל No-Chase מחמיר")}
 if((technicals.compressionPct??0)>=35)score+=.3;if(playbook!=="NONE")score+=.75;else score-=1.4;if(marketStatus==="OPEN")score+=.35;
 score=Math.max(0,Math.min(10,round(score,1)));
 const levels=planLongLevels(playbook,quote,technicals,clean,daily);notes.push(...levels.notes);
 let status:TradePlan["status"]="WATCHING",verdict:TradePlan["verdict"]="WAIT",thesis="המניה נבדקה, אך עדיין לא קיימת עסקה איכותית לביצוע.";
 const entry=levels.entry,stop=levels.stop,tp1=levels.tp1,tp2=levels.tp2,riskReward=levels.riskReward;
 const levelUsable=Boolean(entry&&stop&&tp1&&tp2&&riskReward&&riskReward>=2&&levels.levelQuality!=="NONE");
 if(levelUsable&&entry&&atrValue){
   const pullbackLike=playbook==="PULLBACK"||playbook==="SUPPORT_BOUNCE";
   const chaseLimit=entry+atrValue*(pullbackLike ? .55 : .75),volumeFloor=pullbackLike ? .9 : 1.1,volumeConfirmed=(technicals.relativeVolume??0)>=volumeFloor,mtfConfirmed=(technicals.timeframeAlignmentPct??0)>=50&&(technicals.mtfQualityPct??0)>=70;
   if(quote.price>=entry&&quote.price<=chaseLimit&&technicals.trend!=="BEARISH"&&volumeConfirmed&&mtfConfirmed&&marketStatus==="OPEN"&&score>=6.5){status="TRIGGERED";verdict="ENTER";thesis=`${playbook} אושרה: קיימים טריגר, סטופ, יעדים, נפח ו-Multi-Timeframe שמאפשרים ביצוע.`}
   else if(quote.price>chaseLimit){verdict="NO_ENTRY";thesis="המחיר התרחק מדי מאזור הכניסה; כלל No-Chase חוסם כניסה מאוחרת.";notes.push("NO CHASE")}
   else if(score>=6.5&&quote.price<entry){status="ARMED";thesis="הסט-אפ איכותי והרמות שמישות, אך עדיין ממתינים לטריגר המחיר/אישור הנפח."}
   else thesis="הרמות קיימות, אך איכות המומנטום/נפח/מגמה עדיין אינה מספיקה כדי לסמן את העסקה כמוכנה.";
 }else{
   verdict="NO_ENTRY";thesis=levels.notes.at(-1)??"לא ניתן לבנות כרגע כניסה, סטופ ויעדים אמינים שמתאימים לתבנית.";
 }
 if(marketStatus!=="OPEN")notes.push(`מצב המסחר הוא ${marketStatus}; לא מאשרים כניסה חיה על בסיס הסשן הנוכחי.`);
 const rejectionReasons=verdict==="NO_ENTRY"?[thesis,...notes.filter(x=>/לא |אין |נמוכה|רחוק|NO CHASE|חסרה|חסר/.test(x)).slice(-3)]:undefined;
 return{symbol,side:"LONG",status,verdict,setupScore:score,playbook,entry,stop,tp1,tp2,riskReward,holdingPeriod:"1-3d",thesis,trigger:entry?levels.entryLogic:`אין כרגע טריגר כניסה אמין`,notes,quote,technicals,dataSource:quote.source,dataAsOf:quote.timestamp,levelQuality:levels.levelQuality,entryLogic:levels.entryLogic,stopLogic:levels.stopLogic,targetLogic:levels.targetLogic,rejectionReasons}
}
