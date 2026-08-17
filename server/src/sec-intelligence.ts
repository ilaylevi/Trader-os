import { dataPath, isoNow, readJsonFile, writeJsonFile } from "./store.js";

export interface SecurityIdentity {symbol:string;cik?:number;name?:string;exchange?:string;sic?:string;sicDescription?:string;sector?:string;sectorEtf?:string;sectorConfidence?:"HIGH"|"MEDIUM"|"LOW";source:string;verifiedAt:string}
export interface FilingSignal {form:string;filingDate?:string;reportDate?:string;accessionNumber?:string;primaryDocument?:string;label:string;tone:"RISK"|"POSITIVE"|"NEUTRAL";severity:"LOW"|"MEDIUM"|"HIGH"|"CRITICAL";details:string}
export interface FundamentalSnapshot {symbol:string;cik?:number;asOf:string;available:boolean;source:string;fiscalYear?:number;revenue?:number;revenueGrowthPct?:number;grossMarginPct?:number;netMarginPct?:number;cash?:number;assets?:number;liabilities?:number;debt?:number;sharesOutstanding?:number;sharesGrowthPct?:number;operatingCashFlow?:number;capex?:number;freeCashFlow?:number;healthScore?:number;flags:string[];warning?:string}
export interface SecCompanyIntelligence {identity:SecurityIdentity;filings:FilingSignal[];fundamentals:FundamentalSnapshot;criticalFilingRisk:boolean;filingRiskReason?:string;asOf:string}

type MasterRow={cik:number;name:string;ticker:string;exchange:string};
const masterPath=dataPath("sec-security-master.json"), masterTtl=Math.max(6*60*60_000,Number(process.env.SEC_SECURITY_MASTER_CACHE_MS??24*60*60_000));
const companyTtl=Math.max(15*60_000,Number(process.env.SEC_COMPANY_CACHE_MS??6*60*60_000));
const timeoutMs=Math.max(4000,Number(process.env.SEC_TIMEOUT_MS??10000));
const userAgent=(process.env.SEC_USER_AGENT??"TraderOS/2.6 personal-use contact-not-configured@example.invalid").trim();

function hdr(){return{accept:"application/json","user-agent":userAgent,"accept-encoding":"gzip, deflate"}}
async function secJson<T>(url:string):Promise<T>{const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);try{const r=await fetch(url,{headers:hdr(),signal:ctl.signal});const text=await r.text();if(!r.ok)throw new Error(`SEC ${r.status}: ${text.slice(0,220)}`);return JSON.parse(text) as T}finally{clearTimeout(timer)}}
function fresh(ts?:string,ttl=companyTtl){return Boolean(ts&&Date.now()-Date.parse(ts)<ttl)}
function cachePath(symbol:string,suffix:string){return dataPath(`sec/${symbol.toUpperCase()}-${suffix}.json`)}

export async function refreshSecSecurityMaster(force=false):Promise<MasterRow[]>{
  const old=readJsonFile<{updatedAt?:string;rows:MasterRow[]}>(masterPath,{rows:[]});if(!force&&fresh(old.updatedAt,masterTtl)&&old.rows.length)return old.rows;
  const body=await secJson<{fields?:string[];data?:Array<[number,string,string,string]>}>("https://www.sec.gov/files/company_tickers_exchange.json");
  const rows=(body.data??[]).flatMap(x=>{const cik=Number(x[0]),name=String(x[1]??""),ticker=String(x[2]??"").toUpperCase(),exchange=String(x[3]??"");return Number.isFinite(cik)&&ticker?[{cik,name,ticker,exchange}]:[]});
  writeJsonFile(masterPath,{updatedAt:isoNow(),rows});return rows;
}

function sectorFromSic(sicRaw?:string,desc=""):{sector?:string;etf?:string;confidence:"HIGH"|"MEDIUM"|"LOW"}{const sic=Number(sicRaw),d=desc.toLowerCase();
  if((sic>=6000&&sic<6800)||/bank|insurance|broker|financial|credit/.test(d))return{sector:"Financials",etf:"XLF",confidence:"HIGH"};
  if((sic>=6500&&sic<6600)||/real estate|reit/.test(d))return{sector:"Real Estate",etf:"XLRE",confidence:"HIGH"};
  if((sic>=4900&&sic<5000)||/electric service|gas service|utility/.test(d))return{sector:"Utilities",etf:"XLU",confidence:"HIGH"};
  if((sic>=8000&&sic<8100)||(sic>=2830&&sic<2840)||/pharma|biological|medical|health|hospital/.test(d))return{sector:"Health Care",etf:"XLV",confidence:"HIGH"};
  if((sic>=1300&&sic<1400)||/oil|gas|petroleum/.test(d))return{sector:"Energy",etf:"XLE",confidence:"HIGH"};
  if((sic>=1000&&sic<1300)||(sic>=2800&&sic<2830)||/mining|chemical|metal|paper|material/.test(d))return{sector:"Materials",etf:"XLB",confidence:"MEDIUM"};
  if((sic>=3570&&sic<3580)||(sic>=3660&&sic<3680)||(sic>=7370&&sic<7380)||/semiconductor|computer|software|data processing|electronic/.test(d))return{sector:"Technology",etf:"XLK",confidence:"HIGH"};
  if((sic>=4800&&sic<4900)||/telecom|broadcast|communication|media/.test(d))return{sector:"Communication Services",etf:"XLC",confidence:"MEDIUM"};
  if((sic>=5200&&sic<6000)||/retail|restaurant|apparel|automotive|hotel/.test(d))return{sector:"Consumer Discretionary",etf:"XLY",confidence:"MEDIUM"};
  if((sic>=2000&&sic<2200)||/food|beverage|tobacco|grocery/.test(d))return{sector:"Consumer Staples",etf:"XLP",confidence:"MEDIUM"};
  if((sic>=1500&&sic<1800)||(sic>=3400&&sic<3570)||(sic>=3700&&sic<3800)||/construction|machinery|transportation|aerospace|industrial/.test(d))return{sector:"Industrials",etf:"XLI",confidence:"MEDIUM"};
  return{confidence:"LOW"};}

async function submissionsFor(identity:MasterRow){const cik=String(identity.cik).padStart(10,"0"),path=cachePath(identity.ticker,"submissions"),old=readJsonFile<any>(path,{});if(fresh(old?._cachedAt))return old;const body=await secJson<any>(`https://data.sec.gov/submissions/CIK${cik}.json`);body._cachedAt=isoNow();writeJsonFile(path,body);return body}
async function factsFor(identity:MasterRow){const cik=String(identity.cik).padStart(10,"0"),path=cachePath(identity.ticker,"companyfacts"),old=readJsonFile<any>(path,{});if(fresh(old?._cachedAt))return old;const body=await secJson<any>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);body._cachedAt=isoNow();writeJsonFile(path,body);return body}

export async function getSecurityIdentity(symbol:string,force=false):Promise<SecurityIdentity>{const sym=symbol.trim().toUpperCase(),master=await refreshSecSecurityMaster(force),row=master.find(x=>x.ticker===sym);if(!row)return{symbol:sym,source:"SEC company_tickers_exchange",verifiedAt:isoNow()};
  let sic:string|undefined,sicDescription:string|undefined;try{const sub=await submissionsFor(row);sic=sub.sic?String(sub.sic):undefined;sicDescription=sub.sicDescription?String(sub.sicDescription):undefined}catch{}
  const sector=sectorFromSic(sic,sicDescription);return{symbol:sym,cik:row.cik,name:row.name,exchange:row.exchange,sic,sicDescription,sector:sector.sector,sectorEtf:sector.etf,sectorConfidence:sector.confidence,source:"SEC EDGAR",verifiedAt:isoNow()};}

function filingSignals(sub:any,days=14):FilingSignal[]{const r=sub?.filings?.recent??{},forms:string[]=r.form??[],dates:string[]=r.filingDate??[],reports:string[]=r.reportDate??[],acc:string[]=r.accessionNumber??[],docs:string[]=r.primaryDocument??[],cutoff=Date.now()-days*86400_000,out:FilingSignal[]=[];
  for(let i=0;i<Math.min(forms.length,250);i++){const form=String(forms[i]??"");const date=String(dates[i]??"");if(date&&Date.parse(date)<cutoff)continue;let label=`דיווח ${form}`,tone:FilingSignal["tone"]="NEUTRAL",severity:FilingSignal["severity"]="LOW",details="דיווח חדש ל-SEC";
    if(/^424B5|^424B3|^S-3|^S-1/.test(form)){label="סיכון גיוס/דילול";tone="RISK";severity=/424B5/.test(form)?"CRITICAL":"HIGH";details="הוגש מסמך הקשור להצעת ניירות ערך; יש לבדוק אם קיימת הנפקה או דילול פעיל."}
    else if(/^8-K/.test(form)){label="אירוע מהותי (8-K)";severity="MEDIUM";details="החברה פרסמה 8-K; מומלץ לבדוק את סעיף האירוע לפני כניסה."}
    else if(/SC 13D|SC 13G/.test(form)){label="שינוי בעלות מהותי";tone="POSITIVE";severity="MEDIUM";details="דיווח 13D/13G מצביע על החזקה מהותית או שינוי בה."}
    else if(/^4$/.test(form)){label="פעילות Insider (Form 4)";severity="MEDIUM";details="פורסם Form 4. הכיוון המדויק של העסקה דורש קריאת הטופס עצמו."}
    else if(/^10-Q|^10-K/.test(form)){label="דוח כספי חדש";severity="MEDIUM";details="פורסם דוח כספי תקופתי חדש."}
    else continue;
    out.push({form,filingDate:date||undefined,reportDate:reports[i]||undefined,accessionNumber:acc[i]||undefined,primaryDocument:docs[i]||undefined,label,tone,severity,details});}
  return out;}

type FactPoint={val:number;fy?:number;fp?:string;form?:string;filed?:string;end?:string;start?:string};
function factSeries(facts:any,tags:string[],units=["USD","shares"]):FactPoint[]{for(const tag of tags){const node=facts?.facts?.["us-gaap"]?.[tag];if(!node?.units)continue;for(const unit of units){const arr=node.units[unit];if(Array.isArray(arr)&&arr.length)return arr.filter((x:any)=>Number.isFinite(Number(x.val))).map((x:any)=>({...x,val:Number(x.val)}));}}return[]}
function annual(series:FactPoint[]){const rows=series.filter(x=>/10-K|20-F/.test(String(x.form??""))&&Number.isFinite(x.fy)).sort((a,b)=>(b.fy??0)-(a.fy??0)||Date.parse(String(b.filed??""))-Date.parse(String(a.filed??"")));const by=new Map<number,FactPoint>();for(const x of rows)if(x.fy&&!by.has(x.fy))by.set(x.fy,x);return [...by.values()].sort((a,b)=>(b.fy??0)-(a.fy??0));}
function latestInstant(series:FactPoint[]){return [...series].sort((a,b)=>Date.parse(String(b.filed??b.end??""))-Date.parse(String(a.filed??a.end??"")))[0]}
function pct(n?:number,d?:number){return n!==undefined&&d&&Number.isFinite(n/d)?Number((n/d*100).toFixed(1)):undefined}

export async function getFundamentalSnapshot(symbol:string,force=false):Promise<FundamentalSnapshot>{const sym=symbol.trim().toUpperCase();try{const master=await refreshSecSecurityMaster(force),row=master.find(x=>x.ticker===sym);if(!row)return{symbol:sym,asOf:isoNow(),available:false,source:"SEC XBRL",flags:["לא נמצא CIK תואם"]};const facts=await factsFor(row);
  const revenues=annual(factSeries(facts,["RevenueFromContractWithCustomerExcludingAssessedTax","Revenues","SalesRevenueNet"])),gross=annual(factSeries(facts,["GrossProfit"])),net=annual(factSeries(facts,["NetIncomeLoss","ProfitLoss"])),ocf=annual(factSeries(facts,["NetCashProvidedByUsedInOperatingActivities"])),capex=annual(factSeries(facts,["PaymentsToAcquirePropertyPlantAndEquipment"])),shares=annual(factSeries(facts,["CommonStockSharesOutstanding","EntityCommonStockSharesOutstanding"],["shares"]));
  const cash=latestInstant(factSeries(facts,["CashAndCashEquivalentsAtCarryingValue","CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"])),assets=latestInstant(factSeries(facts,["Assets"])),liab=latestInstant(factSeries(facts,["Liabilities"])),debt=latestInstant(factSeries(facts,["LongTermDebtAndFinanceLeaseObligationsCurrent","LongTermDebtCurrent","LongTermDebtNoncurrent"]));
  const rev=revenues[0]?.val,prevRev=revenues[1]?.val,netVal=net[0]?.val,grossVal=gross[0]?.val,shareNow=shares[0]?.val,sharePrev=shares[1]?.val,ocfVal=ocf[0]?.val,capexVal=capex[0]?.val,freeCashFlow=ocfVal!==undefined&&capexVal!==undefined?ocfVal-capexVal:undefined;const flags:string[]=[];let score=50;
  const growth=pct(rev!==undefined&&prevRev!==undefined?rev-prevRev:undefined,prevRev);if(growth!==undefined){if(growth>=15){score+=12;flags.push("צמיחת הכנסות חזקה")}else if(growth<0){score-=12;flags.push("הכנסות בירידה")}}
  const gm=pct(grossVal,rev),nm=pct(netVal,rev);if(nm!==undefined){if(nm>10)score+=10;else if(nm<0)score-=10}if(freeCashFlow!==undefined){if(freeCashFlow>0){score+=10;flags.push("תזרים חופשי חיובי")}else{score-=10;flags.push("תזרים חופשי שלילי")}}
  const shareGrowth=pct(shareNow!==undefined&&sharePrev!==undefined?shareNow-sharePrev:undefined,sharePrev);if(shareGrowth!==undefined&&shareGrowth>5){score-=12;flags.push(`דילול מניות שנתי ~${shareGrowth}%`)}if(cash?.val!==undefined&&debt?.val!==undefined){if(cash.val>debt.val)score+=6;else if(debt.val>cash.val*3)score-=8}
  return{symbol:sym,cik:row.cik,asOf:isoNow(),available:true,source:"SEC XBRL",fiscalYear:revenues[0]?.fy,revenue:rev,revenueGrowthPct:growth,grossMarginPct:gm,netMarginPct:nm,cash:cash?.val,assets:assets?.val,liabilities:liab?.val,debt:debt?.val,sharesOutstanding:shareNow,sharesGrowthPct:shareGrowth,operatingCashFlow:ocfVal,capex:capexVal,freeCashFlow,healthScore:Math.max(0,Math.min(100,Math.round(score))),flags};
 }catch(e){return{symbol:sym,asOf:isoNow(),available:false,source:"SEC XBRL",flags:[],warning:e instanceof Error?e.message:String(e)}}}

export async function getSecCompanyIntelligence(symbol:string,force=false):Promise<SecCompanyIntelligence>{const sym=symbol.trim().toUpperCase(),identity=await getSecurityIdentity(sym,force);let filings:FilingSignal[]=[];if(identity.cik){try{const master=await refreshSecSecurityMaster(false),row=master.find(x=>x.ticker===sym);if(row)filings=filingSignals(await submissionsFor(row),Number(process.env.SEC_RECENT_FILINGS_DAYS??14))}catch{}}
  const fundamentals=await getFundamentalSnapshot(sym,force),critical=filings.some(x=>x.severity==="CRITICAL"&&x.tone==="RISK");return{identity,filings,fundamentals,criticalFilingRisk:critical,filingRiskReason:critical?filings.find(x=>x.severity==="CRITICAL"&&x.tone==="RISK")?.details:undefined,asOf:isoNow()};}

export function secStatus(){return{enabled:true,userAgentConfigured:Boolean(process.env.SEC_USER_AGENT),userAgentHint:"SEC_USER_AGENT=TraderOS your-email@example.com",masterCacheHours:masterTtl/3600000,companyCacheHours:companyTtl/3600000,source:"SEC EDGAR"}}

export async function getFundamentalTrend(symbol:string,force=false){
  const sym=symbol.trim().toUpperCase();
  try{
    const master=await refreshSecSecurityMaster(force),row=master.find(x=>x.ticker===sym);
    if(!row)return{symbol:sym,available:false,source:"SEC XBRL",series:[]};
    const facts=await factsFor(row);
    const rev=annual(factSeries(facts,["RevenueFromContractWithCustomerExcludingAssessedTax","Revenues","SalesRevenueNet"])).slice(0,5).reverse();
    const gross=annual(factSeries(facts,["GrossProfit"])).slice(0,5).reverse();
    const net=annual(factSeries(facts,["NetIncomeLoss","ProfitLoss"])).slice(0,5).reverse();
    const shares=annual(factSeries(facts,["CommonStockSharesOutstanding","EntityCommonStockSharesOutstanding"],["shares"])).slice(0,5).reverse();
    const byFy=new Map<number,any>();
    for(const x of rev)if(x.fy)byFy.set(x.fy,{fy:x.fy,revenue:x.val});
    for(const x of gross)if(x.fy){const r=byFy.get(x.fy)??{fy:x.fy};r.grossProfit=x.val;byFy.set(x.fy,r)}
    for(const x of net)if(x.fy){const r=byFy.get(x.fy)??{fy:x.fy};r.netIncome=x.val;byFy.set(x.fy,r)}
    for(const x of shares)if(x.fy){const r=byFy.get(x.fy)??{fy:x.fy};r.shares=x.val;byFy.set(x.fy,r)}
    const series=[...byFy.values()].sort((a,b)=>a.fy-b.fy).map((r,i,a)=>({
      ...r,
      revenueGrowthPct:i&&r.revenue&&a[i-1]?.revenue?Number(((r.revenue/a[i-1].revenue-1)*100).toFixed(1)):undefined,
      grossMarginPct:r.revenue&&r.grossProfit?Number((r.grossProfit/r.revenue*100).toFixed(1)):undefined,
      netMarginPct:r.revenue&&r.netIncome!==undefined?Number((r.netIncome/r.revenue*100).toFixed(1)):undefined,
      sharesGrowthPct:i&&r.shares&&a[i-1]?.shares?Number(((r.shares/a[i-1].shares-1)*100).toFixed(1)):undefined
    }));
    const last=series[series.length-1],prev=series[series.length-2];
    const changes:string[]=[];
    if(last&&prev){
      if((last.revenueGrowthPct??0)>(prev.revenueGrowthPct??0)+3)changes.push("צמיחת ההכנסות מאיצה.");
      if((last.revenueGrowthPct??0)<(prev.revenueGrowthPct??0)-3)changes.push("צמיחת ההכנסות מאטה.");
      if((last.grossMarginPct??0)>(prev.grossMarginPct??0)+1)changes.push("המרווח הגולמי משתפר.");
      if((last.grossMarginPct??0)<(prev.grossMarginPct??0)-1)changes.push("המרווח הגולמי נשחק.");
      if((last.sharesGrowthPct??0)>5)changes.push("מספר המניות גדל בקצב שמצביע על דילול מהותי.");
    }
    return{symbol:sym,available:series.length>0,source:"SEC XBRL",generatedAt:isoNow(),series,changes};
  }catch(e){return{symbol:sym,available:false,source:"SEC XBRL",series:[],warning:e instanceof Error?e.message:String(e)}}
}
