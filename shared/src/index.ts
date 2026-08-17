export type TradeStatus = "WATCHING" | "ARMED" | "TRIGGERED" | "OPEN" | "TP1" | "CLOSED" | "INVALIDATED";
export type Verdict = "ENTER" | "WAIT" | "NO_ENTRY";
export type MarketSession = "PRE" | "OPEN" | "AFTER" | "CLOSED" | "UNKNOWN";
export type Trend = "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";
export type MarketRegime = "RISK_ON" | "RISK_OFF" | "TREND_UP" | "TREND_DOWN" | "CHOP" | "HIGH_VOL" | "UNKNOWN";
export type PlaybookId = "BREAKOUT" | "PULLBACK" | "MOMENTUM_CONTINUATION" | "SUPPORT_BOUNCE" | "GAP_CONTINUATION" | "EARNINGS_CONTINUATION" | "RELATIVE_STRENGTH_BREAKOUT" | "TREND_RECLAIM" | "VOLATILITY_SQUEEZE" | "NONE";
export type ThesisStatus = "VALID" | "WEAKENING" | "INVALIDATED" | "UNKNOWN";
export type AlertSeverity = "INFO" | "WATCH" | "ARMED" | "TRIGGERED" | "RISK" | "TP_HIT" | "STOP_HIT" | "INVALIDATED" | "SYSTEM";

export interface MarketQuote {
  symbol: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  change?: number;
  changePct?: number;
  timestamp: string;
  source: string;
}

export interface TimeframeSnapshot {
  timeframe: "5m" | "15m" | "1h" | "1d";
  trend: Trend;
  sma20?: number;
  sma50?: number;
  rsi14?: number;
  momentumPct?: number;
  bars: number;
}

export interface TechnicalSnapshot {
  trend: Trend;
  sma20?: number;
  sma50?: number;
  rsi14?: number;
  atr14?: number;
  relativeVolume?: number;
  relativeVolumeMethod?: "TIME_OF_DAY" | "ROLLING";
  sessionVwap?: number;
  nextResistance?: number;
  structuralStop?: number;
  roomToResistanceR?: number;
  mtfQualityPct?: number;
  support?: number;
  resistance?: number;
  distanceToTriggerPct?: number;
  vwap?: number;
  multiTimeframe?: TimeframeSnapshot[];
  timeframeAlignmentPct?: number;
  volumeZScore?: number;
  priceExpansionAtr?: number;
  gapPct?: number;
  abnormalVolume?: boolean;
  abnormalPriceMove?: boolean;
  compressionPct?: number;
  averageDollarVolume20d?: number;
  previousDayHigh?: number;
  previousDayLow?: number;
  weeklyHigh?: number;
  weeklyLow?: number;
  monthlyHigh?: number;
  monthlyLow?: number;
  openingRangeHigh?: number;
  openingRangeLow?: number;
  anchoredVwap?: number;
  volumeProfilePoc?: number;
  rs1dPct?: number;
  rs5dPct?: number;
  rs20dPct?: number;
  rsSector5dPct?: number;
  rsSector20dPct?: number;
}

export interface MarketBreadth {
  universe: number;
  advances: number;
  declines: number;
  unchanged: number;
  advancePct: number;
  avgChangePct: number;
  strongUpPct: number;
  strongDownPct: number;
}

export interface TradeContext {
  marketBias?: "BULLISH" | "BEARISH" | "MIXED" | "UNKNOWN";
  marketRegime?: MarketRegime;
  breadth?: MarketBreadth;
  marketQuotes?: MarketQuote[];
  sectorEtf?: string;
  sectorQuote?: MarketQuote;
  sectorAlignment?: "TAILWIND" | "HEADWIND" | "NEUTRAL" | "UNKNOWN";
  factors?: string[];
  relativeStrengthMarketPct?: number;
  relativeStrengthSectorPct?: number;
  relativeStrengthGrade?: "LEADER" | "OUTPERFORM" | "NEUTRAL" | "LAGGARD" | "UNKNOWN";
  regimeScore?: number;
  regimeReasons?: string[];
}

export interface EventRisk {
  id: string;
  type: "EARNINGS" | "MACRO" | "NEWS" | "OTHER";
  symbol?: string;
  title: string;
  at: string;
  impact: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  source: string;
  verified: boolean;
  minutesAway?: number;
  blocksEntry?: boolean;
  details?: string;
}

export interface TradePlan {
  symbol: string;
  side: "LONG" | "SHORT";
  status: TradeStatus;
  verdict: Verdict;
  setupScore: number;
  convictionScore?: number;
  playbook?: PlaybookId;
  entry?: number;
  stop?: number;
  tp1?: number;
  tp2?: number;
  riskReward?: number;
  holdingPeriod: "1-3d";
  thesis: string;
  trigger?: string;
  catalyst?: string;
  notes?: string[];
  quote?: MarketQuote;
  technicals?: TechnicalSnapshot;
  context?: TradeContext;
  eventRisks?: EventRisk[];
  eventRiskLocked?: boolean;
  dataSource?: string;
  dataAsOf?: string;
  dataQualityPct?: number;
  quoteAgeSeconds?: number;
  dataFlags?: string[];
  preMarketVerified?: boolean;
  portfolioGatePassed?: boolean;
  portfolioGateReason?: string;
  catalystScore?: number;
  catalystLabel?: string;
  learningAdjustment?: number;
  learningSampleSize?: number;
  levelQuality?: "STRUCTURAL" | "HYBRID" | "ATR_FALLBACK" | "NONE";
  entryLogic?: string;
  stopLogic?: string;
  targetLogic?: string;
  opportunityQuality?: number;
  rejectionReasons?: string[];
  dataConfidenceScore?: number;
  dataConfidenceGrade?: "HIGH" | "MEDIUM" | "LOW" | "BLOCK";
  spreadPct?: number;
  securityExchange?: string;
  securitySector?: string;
  securityIndustry?: string;
  fundamentalHealthScore?: number;
  secCriticalRisk?: boolean;
  scannerSignals?: Array<{playbook:PlaybookId;score:number;label:string;reason:string}>;
  advancedDecision?: AdvancedDecision;
}

export interface TradeEvent {
  at: string;
  type: "CREATED" | "FILL_RECORDED" | "UPDATED" | "TP1" | "TP2" | "STOP_HIT" | "STOP_MOVED" | "CLOSED" | "NOTE" | "THESIS" | "ALERT" | "ORDER_STAGED";
  message: string;
}

export interface ActiveTrade extends TradePlan {
  id: string;
  openedAt: string;
  quantity: number;
  initialQuantity?: number;
  partialRealizedPnlUsd?: number;
  partialExits?: Array<{ at:string; quantity:number; price:number; pnlUsd:number; note?:string }>;
  current?: number;
  originalThesis: string;
  originalStop?: number;
  thesisStatus?: ThesisStatus;
  realizedPnlUsd?: number;
  executionState?: "PLANNED" | "RECORDED";
  entrySource?: "plan" | "current_quote" | "user_fill" | "manual" | "broker_sync";
  createdBy?: "engine" | "manual" | "broker";
  riskUsd?: number;
  riskPct?: number;
  mfePct?: number;
  maePct?: number;
  highestPrice?: number;
  lowestPrice?: number;
  trailingMode?: "NONE" | "BREAKEVEN" | "ATR" | "STRUCTURE";
  lastUpdatedAt?: string;
  autoLevelManagement?: boolean;
  tp1HitAt?: string;
  tp2HitAt?: string;
  stopHitAt?: string;
  timeline?: TradeEvent[];
}

export interface ClosedTrade extends ActiveTrade {
  closedAt: string;
  exitPrice: number;
  realizedPnlUsd: number;
  closeNotes?: string;
  realizedR?: number;
  followedPlan?: boolean;
  closeReason?: "MANUAL" | "STOP_HIT" | "TP2_HIT" | "BROKER_SYNC" | "OTHER";
  closureSource?: "MANUAL" | "LEVEL_MONITOR" | "BROKER";
  brokerExecutionConfirmed?: boolean;
  brokerExecutionConfirmedAt?: string;
  triggerLevel?: number;
  observedExitPrice?: number;
}

export interface WatchlistItem {
  symbol: string;
  addedAt: string;
  note?: string;
  source?: "manual" | "engine" | "scanner";
  triggerPrice?: number;
  triggerType?: "ABOVE" | "BELOW";
  reason?: string;
  expiresAt?: string;
}

export interface StrategyOpportunity {
  symbol: string;
  confidence: number;
  grade: "A+" | "A" | "B+" | "B" | "PASS";
  verdict: "READY" | "ARMED" | "WATCH" | "REJECT";
  setupScore: number;
  convictionScore?: number;
  playbook?: PlaybookId;
  headline: string;
  rationale: string;
  catalyst: string;
  keyRisk: string;
  entry?: number;
  stop?: number;
  tp1?: number;
  tp2?: number;
  riskReward?: number;
  dataQualityPct?: number;
  eventRiskLocked?: boolean;
  relativeStrengthGrade?: string;
  sectorEtf?: string;
  sectorKnown?: boolean;
  learningAdjustment?: number;
  catalystScore?: number;
  dataAsOf: string;
  levelQuality?: "STRUCTURAL" | "HYBRID" | "ATR_FALLBACK" | "NONE";
  entryLogic?: string;
  stopLogic?: string;
  targetLogic?: string;
  rejectionReasons?: string[];
  dataConfidenceScore?: number;
  dataConfidenceGrade?: "HIGH" | "MEDIUM" | "LOW" | "BLOCK";
  spreadPct?: number;
  securityExchange?: string;
  securitySector?: string;
  fundamentalHealthScore?: number;
  secCriticalRisk?: boolean;
  advancedDecision?: AdvancedDecision;
}

export interface StrategyOpportunitySnapshot {
  generatedAt: string;
  scanId?: string;
  reused?: boolean;
  cooldownRemainingSeconds?: number;
  stats?: { universeSize?: number; quoteSuccess?: number; shortlisted?: number; ohlcvValidated?: number; dynamicSymbols?: number; [key:string]: number | undefined };
  engine: "DETERMINISTIC";
  rulesetVersion: string;
  marketBias: string;
  marketRegime?: MarketRegime;
  summary: string;
  opportunities: StrategyOpportunity[];
  diagnostics?: string[];
  rejected?: StrategyOpportunity[];
  opportunityCost?: Record<string, unknown>;
  calibration?: Record<string, unknown>;
}

export interface TraderProfile {
  style: "day_swing";
  holdingPeriod: "1-3d";
  riskProfile: "conservative";
  capitalPreservationFirst: true;
  noChasing: true;
  requireDefinedStop: true;
  requireRiskReward: true;
}

export interface MarketContext {
  bias: "BULLISH" | "BEARISH" | "MIXED" | "UNKNOWN";
  regime?: MarketRegime;
  regimeScore?: number;
  regimeReasons?: string[];
  breadth?: MarketBreadth;
  quotes: MarketQuote[];
}

export interface AlertRecord {
  id: string;
  at: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  symbol?: string;
  tradeId?: string;
  read: boolean;
  channels: string[];
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}

export interface TriggerRule {
  id: string;
  symbol: string;
  kind: "ENTRY_ABOVE" | "ENTRY_BELOW" | "STOP" | "TP1" | "TP2" | "WATCH_ABOVE" | "WATCH_BELOW";
  price: number;
  active: boolean;
  createdAt: string;
  firedAt?: string;
  tradeId?: string;
  note?: string;
}

export interface StagedOrder {
  id: string;
  createdAt: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  orderType: "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT";
  limitPrice?: number;
  stopPrice?: number;
  purpose: "ENTRY" | "STOP" | "TP1" | "TP2" | "EXIT";
  tradeId?: string;
  status: "STAGED" | "CONFIRMED_EXTERNALLY" | "CANCELLED";
  broker: string;
  notes?: string;
}

export interface BrokerSnapshot {
  broker: string;
  mode: "STAGED_ONLY" | "READ_ONLY";
  syncedAt?: string;
  cashUsd?: number;
  positions: Array<{ symbol: string; quantity: number; avgPrice?: number; marketPrice?: number }>;
  orders: Array<Record<string, unknown>>;
  source: string;
}

export interface DecisionJournalEntry {
  id: string;
  at: string;
  symbol: string;
  source: "SCAN" | "STRATEGY_RANKING" | "ENTRY_CHECK" | "BACKGROUND" | "MANUAL";
  verdict: string;
  confidence?: number;
  grade?: string;
  playbook?: PlaybookId;
  setupScore?: number;
  marketRegime?: MarketRegime;
  marketBias?: string;
  sectorAlignment?: string;
  dataQualityPct?: number;
  entry?: number;
  stop?: number;
  tp1?: number;
  tp2?: number;
  snapshot?: Record<string, unknown>;
  outcome?: "PENDING" | "WIN" | "LOSS" | "EXPIRED" | "MISSED";
  realizedR?: number;
  notes?: string;
}

export interface ShadowTrade {
  id: string;
  journalId: string;
  symbol: string;
  playbook?: PlaybookId;
  openedAt: string;
  expiresAt: string;
  entry: number;
  stop: number;
  tp1?: number;
  tp2?: number;
  status: "PENDING_TRIGGER" | "OPEN" | "WIN" | "LOSS" | "EXPIRED";
  triggeredAt?: string;
  closedAt?: string;
  exitPrice?: number;
  realizedR?: number;
  tp1HitAt?: string;
  tp1RealizedR?: number;
  remainingFraction?: number;
  managementModel?: "TP1_HALF_THEN_TP2_OR_STOP";
  purpose?: "STRATEGY" | "COUNTERFACTUAL" | "AB_TEST";
  abVariant?: "A_BASE" | "B_TIGHTER_STOP";
  maxFavorablePct?: number;
  maxAdversePct?: number;
}

export interface AutomationStatus {
  enabled: boolean;
  startedAt?: string;
  lastScanAt?: string;
  nextScanAt?: string;
  lastTriggerPollAt?: string;
  lastCalendarRefreshAt?: string;
  lastShadowUpdateAt?: string;
  scansToday: number;
  strategyValidationsToday: number;
  alertsToday: number;
  lastScanId?: string;
  lastError?: string;
  session?: MarketSession;
}

export interface DashboardSnapshot {
  mode: "DEMO" | "LIVE";
  asOf: string;
  provider: { name: string; configured: boolean; message?: string };
  engine: { type: "DETERMINISTIC"; rulesetVersion: string; externalAi: false; estimatedCostUsd: 0 };
  market: {
    status: MarketSession;
    exchange?: string;
    holiday?: string;
    bias?: MarketContext["bias"];
    regime?: MarketRegime;
    regimeScore?: number;
    regimeReasons?: string[];
    breadth?: MarketBreadth;
    benchmarks?: MarketQuote[];
  };
  risk: { usedPct: number; maxPct: number; openRiskUsd?: number };
  opportunities: TradePlan[];
  activeTrades: ActiveTrade[];
  watchlist: WatchlistItem[];
  ledgerCount: number;
  automation?: AutomationStatus;
  unreadAlerts?: number;
}


export interface EvidenceSignal {
  key: string;
  label: string;
  category: "TECHNICAL" | "VOLUME" | "MARKET" | "SECTOR" | "CATALYST" | "DATA" | "HISTORICAL" | "EXECUTION" | "FUNDAMENTAL" | "SHORT" | "OPTIONS" | "PORTFOLIO";
  direction: "BULL" | "BEAR" | "NEUTRAL" | "BLOCK";
  strength: number;
  independentGroup: string;
  details: string;
  source?: string;
  asOf?: string;
}

export interface ExpertOpinion {
  expert: string;
  labelHe: string;
  score: number;
  stance: "BULL" | "BEAR" | "NEUTRAL" | "BLOCK";
  reasons: string[];
  confidence: number;
}

export interface HistoricalAnalogSummary {
  sampleSize: number;
  tp1BeforeStopPct?: number;
  tp2BeforeStopPct?: number;
  stopFirstPct?: number;
  expectedR?: number;
  avgMfeR?: number;
  avgMaeR?: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  note: string;
}

export interface AdvancedDecision {
  generatedAt: string;
  validUntil: string;
  symbol: string;
  rawConfidence: number;
  calibratedProbability?: number;
  uncertainty: "LOW" | "MEDIUM" | "HIGH" | "OUT_OF_DISTRIBUTION";
  judgeVerdict: "ENTER" | "ARMED" | "WAIT" | "REJECT" | "UNCERTAIN";
  experts: ExpertOpinion[];
  evidence: EvidenceSignal[];
  bullCase: string[];
  bearCase: string[];
  contradictions: string[];
  whyNow: string[];
  whatChangesMyMind: string[];
  changedSinceLast: string[];
  analogs?: HistoricalAnalogSummary;
  stress?: {normalRiskPct?:number; stressedRiskPct?:number; suggestedSizeFactor:number; scenarios:Array<{name:string;riskPct?:number;note:string}>};
  ranking?: {rank?:number;top5Persistence?:number;stability:"HIGH"|"MEDIUM"|"LOW"|"UNKNOWN"};
  independentEvidence?: {groups:number; bullPct:number; bearPct:number};
  executionReality?: {spreadPct?:number; expectedSlippagePct?:number; normalRiskPct?:number; stressedRiskPct?:number; suggestedSizeFactor?:number; note:string};
  sourceAuthority?: Array<{source:string;level:"OFFICIAL"|"MARKET_PROVIDER"|"LOCAL_DERIVED"|"UNVERIFIED";score:number}>;
  externalContext?: Record<string, unknown>;
  explanationHe: string;
}

export interface ConsoleMessage {
  role: "user" | "engine";
  content: string;
  at: string;
  command?: string;
  symbol?: string;
}
