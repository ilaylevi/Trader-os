import type { MarketQuote, MarketSession } from "@trader-os/shared";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketStatus {
  status: MarketSession;
  exchange: string;
  holiday?: string;
  timestamp: string;
}

export interface MarketDataProvider {
  readonly name: string;
  readonly configured: boolean;
  readonly quoteProviderName: string;
  readonly candleProviderName: string;
  readonly candlesConfigured: boolean;
  getQuote(symbol: string, fresh?: boolean): Promise<MarketQuote>;
  getCandles(symbol: string, resolution: string, from: number, to: number, fresh?: boolean): Promise<Candle[]>;
  getMarketStatus(exchange?: string, fresh?: boolean): Promise<MarketStatus>;
  getDynamicSymbols?(fresh?: boolean): Promise<string[]>;
  getSupportedSymbols?(fresh?: boolean): Promise<string[]>;
}

class TtlCache<T> {
  private readonly values = new Map<string, { expires: number; value: T }>();
  constructor(private readonly ttlMs: number) {}
  get(key: string): T | undefined {
    const hit = this.values.get(key);
    if (!hit) return undefined;
    if (Date.now() >= hit.expires) {
      this.values.delete(key);
      return undefined;
    }
    return hit.value;
  }
  set(key: string, value: T) {
    this.values.set(key, { expires: Date.now() + this.ttlMs, value });
  }
  delete(key: string) { this.values.delete(key); }
}

class FinnhubProvider {
  readonly name = "Finnhub";
  readonly configured: boolean;
  private readonly key: string;
  private readonly timeoutMs: number;
  private readonly cache = new TtlCache<unknown>(Number(process.env.MARKET_DATA_CACHE_MS ?? 20_000));
  private readonly symbolCache = new TtlCache<string[]>(Number(process.env.SYMBOL_CATALOG_CACHE_MS ?? 24*60*60_000));

  constructor() {
    this.key = (process.env.FINNHUB_API_KEY ?? "").trim();
    this.configured = this.key.length > 0;
    this.timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS ?? 8_000);
  }

  private async api<T>(path: string, params: Record<string, string | number>): Promise<T> {
    if (!this.configured) throw new Error("FINNHUB_API_KEY is not configured");
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) query.set(key, String(value));
    query.set("token", this.key);
    const url = `https://finnhub.io/api/v1${path}?${query.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
      const text = await response.text();
      if (!response.ok) throw new Error(`Finnhub ${response.status}: ${text.slice(0, 240)}`);
      const body = JSON.parse(text) as T & { error?: string };
      if (body && typeof body === "object" && "error" in body && body.error) throw new Error(`Finnhub: ${body.error}`);
      return body as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async getQuote(symbol: string, fresh = false): Promise<MarketQuote> {
    const normalized = symbol.trim().toUpperCase();
    const cacheKey = `quote:${normalized}`;
    if (fresh) this.cache.delete(cacheKey);
    const cached = this.cache.get(cacheKey) as MarketQuote | undefined;
    if (cached) return cached;
    const q = await this.api<{ c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number }>("/quote", { symbol: normalized });
    if (!q.c || q.c <= 0) throw new Error(`No quote returned for ${normalized}`);
    const result: MarketQuote = {
      symbol: normalized,
      price: q.c,
      open: q.o || undefined,
      high: q.h || undefined,
      low: q.l || undefined,
      previousClose: q.pc || undefined,
      change: Number.isFinite(q.d) ? q.d : undefined,
      changePct: Number.isFinite(q.dp) ? q.dp : undefined,
      timestamp: new Date((q.t || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      source: this.name,
    };
    this.cache.set(cacheKey, result);
    return result;
  }

  async getCandles(symbol: string, resolution: string, from: number, to: number, fresh = false): Promise<Candle[]> {
    const normalized = symbol.trim().toUpperCase();
    const bucketFrom = Math.floor(from / 60) * 60;
    const cacheKey = `candles:${normalized}:${resolution}:${bucketFrom}:${Math.floor(to / 60)}`;
    if (fresh) this.cache.delete(cacheKey);
    const cached = this.cache.get(cacheKey) as Candle[] | undefined;
    if (cached) return cached;
    const r = await this.api<{ s: string; t?: number[]; o?: number[]; h?: number[]; l?: number[]; c?: number[]; v?: number[] }>("/stock/candle", {
      symbol: normalized,
      resolution,
      from,
      to,
    });
    if (r.s !== "ok" || !r.t || !r.o || !r.h || !r.l || !r.c || !r.v) {
      throw new Error(`No OHLCV candles returned for ${normalized}`);
    }
    const result = r.t.map((time, i) => ({
      time,
      open: r.o![i],
      high: r.h![i],
      low: r.l![i],
      close: r.c![i],
      volume: r.v![i],
    })).filter((x) => [x.open, x.high, x.low, x.close, x.volume].every(Number.isFinite));
    this.cache.set(cacheKey, result);
    return result;
  }


  async getSupportedSymbols(fresh = false): Promise<string[]> {
    const cacheKey = "supported-symbols:US";
    if (fresh && (process.env.FORCE_FRESH_SYMBOL_CATALOG ?? "false").toLowerCase() === "true") this.symbolCache.delete(cacheKey);
    const cached = this.symbolCache.get(cacheKey);
    if (cached) return cached;
    const rows = await this.api<Array<{ symbol?: string; displaySymbol?: string; description?: string; type?: string; currency?: string; mic?: string }>>("/stock/symbol", { exchange: "US" });
    const excluded = /(warrant|unit|right|preferred|depositary receipt|etn|fund|etf|index)/i;
    const symbols = rows.flatMap((row) => {
      const type = String(row.type ?? "");
      const symbol = String(row.symbol ?? row.displaySymbol ?? "").trim().toUpperCase();
      if (!symbol || !/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) return [];
      if (excluded.test(type)) return [];
      if (type && !/(common stock|ordinary share|equity|stock)/i.test(type)) return [];
      const mic = String(row.mic ?? "").toUpperCase();
      const excludeOtc = (process.env.FULL_MARKET_EXCLUDE_OTC ?? "true").toLowerCase() !== "false";
      if (excludeOtc && /(OTC|PINX|OOTC|GREY)/.test(mic)) return [];
      if (symbol.includes("/")) return [];
      return [symbol];
    });
    const result = [...new Set(symbols)].sort();
    this.symbolCache.set(cacheKey, result);
    return result;
  }
  async getMarketStatus(exchange = "US", fresh = false): Promise<MarketStatus> {
    const cacheKey = `market-status:${exchange}`;
    if (fresh) this.cache.delete(cacheKey);
    const cached = this.cache.get(cacheKey) as MarketStatus | undefined;
    if (cached) return cached;
    const r = await this.api<{ exchange?: string; holiday?: string | null; isOpen?: boolean; session?: string; t?: number }>("/stock/market-status", { exchange });
    const session = (r.session ?? "").toLowerCase();
    let status: MarketSession = "UNKNOWN";
    if (r.isOpen) status = "OPEN";
    else if (session.includes("pre")) status = "PRE";
    else if (session.includes("post") || session.includes("after")) status = "AFTER";
    else if (r.isOpen === false) status = "CLOSED";
    const result: MarketStatus = {
      status,
      exchange: r.exchange ?? exchange,
      holiday: r.holiday || undefined,
      timestamp: new Date((r.t || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    };
    this.cache.set(cacheKey, result);
    return result;
  }
}

class TwelveDataProvider {
  readonly name = "Twelve Data";
  readonly configured: boolean;
  private readonly key: string;
  private readonly timeoutMs: number;
  private readonly intradayCache = new TtlCache<Candle[]>(Number(process.env.OHLCV_CACHE_MS ?? 5*60_000));
  private readonly dailyCache = new TtlCache<Candle[]>(Number(process.env.DAILY_OHLCV_CACHE_MS ?? 6*60*60_000));
  private readonly moversCache = new TtlCache<string[]>(Number(process.env.MARKET_MOVERS_CACHE_MS ?? 10*60_000));

  constructor() {
    this.key = (process.env.TWELVE_DATA_API_KEY ?? "").trim();
    this.configured = this.key.length > 0;
    this.timeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS ?? 8_000);
  }

  private async api<T>(path: string, params: Record<string,string|number>): Promise<T> {
    if (!this.configured) throw new Error("TWELVE_DATA_API_KEY is not configured");
    const query=new URLSearchParams();
    for(const [k,v] of Object.entries(params)) query.set(k,String(v));
    query.set("apikey",this.key);
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try {
      const response=await fetch(`https://api.twelvedata.com${path}?${query.toString()}`,{signal:controller.signal,headers:{accept:"application/json"}});
      const text=await response.text();
      if(!response.ok) throw new Error(`Twelve Data ${response.status}: ${text.slice(0,240)}`);
      const body=JSON.parse(text) as T & {status?:string;message?:string};
      if(body && typeof body==="object" && body.status==="error") throw new Error(`Twelve Data: ${body.message??"API error"}`);
      return body as T;
    } finally { clearTimeout(timer); }
  }

  private interval(resolution: string): string {
    const v = resolution.trim().toLowerCase();
    if (v.endsWith("min") || v.endsWith("h") || v.endsWith("day")) return v;
    if (["1", "5", "15", "30", "45"].includes(v)) return `${v}min`;
    if (v === "60") return "1h";
    return "5min";
  }

  async getCandles(symbol: string, resolution: string, _from: number, _to: number, fresh = false): Promise<Candle[]> {
    if (!this.configured) throw new Error("TWELVE_DATA_API_KEY is not configured");
    const normalized = symbol.trim().toUpperCase();
    const interval = this.interval(resolution);
    const cacheKey = `${normalized}:${interval}`;
    const cache = interval === "1day" ? this.dailyCache : this.intradayCache;
    // A "fresh" scan refreshes quotes/intraday, but daily history remains cached for hours.
    if (fresh && interval !== "1day") cache.delete(cacheKey);
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const query = new URLSearchParams({
      symbol: normalized,
      interval,
      outputsize: String(Math.max(60, Math.min(5000, Number(interval === "1day" ? (process.env.OHLCV_DAILY_OUTPUTSIZE ?? 120) : (process.env.OHLCV_INTRADAY_OUTPUTSIZE ?? process.env.OHLCV_OUTPUTSIZE ?? 800))))),
      order: "asc",
      timezone: "UTC",
      apikey: this.key,
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`https://api.twelvedata.com/time_series?${query.toString()}`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Twelve Data ${response.status}: ${text.slice(0, 240)}`);
      const body = JSON.parse(text) as {
        status?: string;
        code?: number;
        message?: string;
        values?: Array<{ datetime: string; open: string; high: string; low: string; close: string; volume?: string }>;
      };
      if (body.status === "error" || !Array.isArray(body.values)) {
        throw new Error(`Twelve Data: ${body.message ?? "No OHLCV values returned"}`);
      }
      const result = body.values.map((row, index) => {
        const parsed = Date.parse(row.datetime.includes("T") ? row.datetime : `${row.datetime.replace(" ", "T")}Z`);
        return {
          time: Number.isFinite(parsed) ? Math.floor(parsed / 1000) : index,
          open: Number(row.open),
          high: Number(row.high),
          low: Number(row.low),
          close: Number(row.close),
          volume: Number(row.volume ?? 0),
        };
      }).filter((x) => [x.open, x.high, x.low, x.close, x.volume].every(Number.isFinite));
      if (result.length < 20) throw new Error(`Twelve Data returned only ${result.length} candles for ${normalized}`);
      cache.set(cacheKey, result);
      return result;
    } finally {
      clearTimeout(timer);
    }
  }
  async getDynamicSymbols(fresh=false): Promise<string[]> {
    const cacheKey="market-movers:stocks";
    if(fresh&&(process.env.FORCE_FRESH_MARKET_MOVERS??"false").toLowerCase()==="true") this.moversCache.delete(cacheKey);
    const cached=this.moversCache.get(cacheKey);
    if(cached) return cached;
    const directions=["gainers","losers"] as const;
    const symbols:string[]=[];
    for(const direction of directions){
      try{
        const body=await this.api<any>("/market_movers/stocks",{direction,outputsize:Number(process.env.DYNAMIC_MOVERS_PER_SIDE??12)});
        const rows=Array.isArray(body?.values)?body.values:Array.isArray(body?.data)?body.data:Array.isArray(body)?body:[];
        for(const row of rows){ const symbol=String(row?.symbol??row?.ticker??"").trim().toUpperCase(); if(/^[A-Z.\-]{1,10}$/.test(symbol)) symbols.push(symbol); }
      }catch{}
    }
    const result=[...new Set(symbols)].slice(0,Number(process.env.DYNAMIC_UNIVERSE_MAX??24));
    this.moversCache.set(cacheKey,result);
    return result;
  }

}

export function createMarketDataProvider(): MarketDataProvider {
  const finnhub = new FinnhubProvider();
  const twelve = new TwelveDataProvider();
  return {
    name: twelve.configured ? "Finnhub + Twelve Data" : "Finnhub",
    configured: finnhub.configured,
    quoteProviderName: finnhub.name,
    candleProviderName: twelve.configured ? twelve.name : finnhub.name,
    candlesConfigured: twelve.configured,
    getQuote: (symbol, fresh) => finnhub.getQuote(symbol, fresh),
    getCandles: (symbol, resolution, from, to, fresh) => twelve.configured
      ? twelve.getCandles(symbol, resolution, from, to, fresh)
      : finnhub.getCandles(symbol, resolution, from, to, fresh),
    getMarketStatus: (exchange, fresh) => finnhub.getMarketStatus(exchange, fresh),
    getDynamicSymbols: (fresh) => twelve.configured && (process.env.TWELVE_MARKET_MOVERS_ENABLED??"false").toLowerCase()==="true" ? twelve.getDynamicSymbols(fresh) : Promise.resolve([]),
    getSupportedSymbols: (fresh) => finnhub.getSupportedSymbols(fresh),
  };
}
