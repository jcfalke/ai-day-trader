// ============================================================
// AI Day Trader — Shared TypeScript Types & Interfaces
// @ai-trader/shared/src/types.ts
// ============================================================

// ------------------------------------------------------------
// 1. Market Data
// ------------------------------------------------------------

/** A single OHLCV candlestick bar */
export interface MarketDataCandle {
  /** ISO-8601 timestamp for bar open */
  timestamp: string;
  /** Open price */
  open: number;
  /** High price */
  high: number;
  /** Low price */
  low: number;
  /** Close price */
  close: number;
  /** Volume */
  volume: number;
  /** Timeframe string, e.g. "1Min" | "5Min" | "15Min" | "1Hour" */
  timeframe: string;
}

/** Raw news/sentiment item */
export interface NewsItem {
  headline: string;
  source: string;
  url?: string;
  publishedAt: string;
  /** -1 to 1, or null if not available */
  sentimentScore?: number | null;
  summary?: string;
}

// ------------------------------------------------------------
// 2. Technical Indicators
// ------------------------------------------------------------

/** MACD result object */
export interface MacdResult {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
}

/** Bollinger Bands result */
export interface BollingerBands {
  upper: number[];
  middle: number[];
  lower: number[];
}

/** All indicators computed for a ticker */
export interface IndicatorBundle {
  symbol: string;
  timeframe: string;
  /** Simple Moving Average (20-period) — last N values */
  sma20: number[];
  /** Exponential Moving Average (9-period) — last N values */
  ema9: number[];
  /** RSI (14-period) — last N values */
  rsi14: number[];
  /** MACD (12,26,9) */
  macd: MacdResult;
  /** Bollinger Bands (20,2) */
  bollingerBands: BollingerBands;
  /** Average True Range (14-period) */
  atr14: number[];
  /** Volume SMA (20-period) */
  volumeSma20: number[];
  /** Computed at */
  computedAt: string;
}

// ------------------------------------------------------------
// 3. LLM Context Bundle — sent to the LLM
// ------------------------------------------------------------

/** Full context bundle for a single ticker, sent to the LLM */
export interface TickerContext {
  symbol: string;
  timeframe: string;
  /** Most recent N candles (oldest → newest) */
  recentCandles: MarketDataCandle[];
  /** Snapshot of the latest indicator values (last value of each series) */
  latestIndicators: {
    sma20: number;
    ema9: number;
    rsi14: number;
    macd: number;
    macdSignal: number;
    macdHistogram: number;
    bbUpper: number;
    bbMiddle: number;
    bbLower: number;
    atr14: number;
    volumeSma20: number;
  };
  /** Recent news/sentiment headlines */
  recentNews: NewsItem[];
  /** Current open position for this ticker, if any */
  currentPosition?: OpenPosition | null;
  /** Account equity snapshot */
  accountEquity: number;
  /** Timestamp context was built */
  contextBuiltAt: string;
}

// ------------------------------------------------------------
// 4. LLM Decision Output
// ------------------------------------------------------------

export type TradeAction = "BUY" | "SELL" | "HOLD";

/** Single ticker decision from the LLM */
export interface LlmDecision {
  symbol: string;
  action: TradeAction;
  /** 0–5% of total equity */
  position_size_pct: number;
  /** % below entry for stop loss */
  stop_loss_pct: number;
  /** % above entry for take profit */
  take_profit_pct: number;
  /** 0–1 confidence score */
  confidence: number;
  /** Short rationale from the LLM */
  reason: string;
}

/** Full LLM response envelope */
export interface LlmResponse {
  decisions: LlmDecision[];
  /** Raw LLM text (for debugging) */
  rawOutput?: string;
  /** Model used */
  model?: string;
  /** Token usage */
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

// ------------------------------------------------------------
// 5. Trade Orders
// ------------------------------------------------------------

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type OrderStatus =
  | "pending"
  | "submitted"
  | "filled"
  | "partially_filled"
  | "cancelled"
  | "rejected"
  | "expired";
export type TimeInForce = "day" | "gtc" | "ioc" | "fok";

/** Order to be submitted to the broker */
export interface TradeOrder {
  /** Internal ID */
  id?: string;
  /** Broker-assigned order ID */
  brokerId?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  limitPrice?: number;
  stopPrice?: number;
  timeInForce: TimeInForce;
  /** Linked stop-loss order params */
  stopLoss?: {
    stopPrice: number;
    limitPrice?: number;
  };
  /** Linked take-profit order params */
  takeProfit?: {
    limitPrice: number;
  };
  /** Whether this was a paper/simulated trade */
  isPaper: boolean;
  status: OrderStatus;
  submittedAt?: string;
  filledAt?: string;
  filledAvgPrice?: number;
  /** Source LLM decision ID */
  decisionId?: string;
}

// ------------------------------------------------------------
// 6. Positions & PnL
// ------------------------------------------------------------

/** An open position from the broker */
export interface OpenPosition {
  symbol: string;
  qty: number;
  side: "long" | "short";
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  costBasis: number;
}

/** Aggregated PnL summary */
export interface PnlSummary {
  totalEquity: number;
  cash: number;
  portfolioValue: number;
  dayPnl: number;
  dayPnlPct: number;
  totalUnrealizedPnl: number;
  totalRealizedPnlToday: number;
  openPositions: OpenPosition[];
  asOf: string;
}

// ------------------------------------------------------------
// 7. Risk Configuration
// ------------------------------------------------------------

/** Risk management config — loaded from env / config file */
export interface RiskConfig {
  /** Max % of equity per single ticker position (0–100) */
  MAX_POSITION_PER_TICKER_PCT: number;
  /** Stop all trading if daily realized loss exceeds this % of equity */
  MAX_DAILY_LOSS_PCT: number;
  /** Minimum LLM confidence to act (0–1) */
  MIN_CONFIDENCE: number;
  /** Maximum number of simultaneous open positions */
  MAX_OPEN_POSITIONS: number;
  /** Maximum order value in USD, regardless of equity */
  MAX_ORDER_VALUE_USD: number;
  /** If true, only log — do not call broker API */
  PAPER_MODE: boolean;
  /** Watchlist of tickers to trade */
  WATCHLIST: string[];
  /** Candle timeframe */
  TIMEFRAME: "1Min" | "5Min" | "15Min" | "1Hour";
  /** Number of candles to look back */
  LOOKBACK_BARS: number;
  /** Number of recent news items to include */
  NEWS_ITEMS_PER_TICKER: number;
}

/** Result of a risk check */
export interface RiskCheckResult {
  passed: boolean;
  reason?: string;
  adjustedSizePct?: number;
}

// ------------------------------------------------------------
// 8. Database Models
// ------------------------------------------------------------

/** Stored trade record */
export interface TradeRecord {
  id: number;
  symbol: string;
  side: OrderSide;
  qty: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  status: OrderStatus;
  brokerId?: string;
  isPaper: boolean;
  decisionId?: number;
  timestamp: string;
  filledAt?: string;
  filledAvgPrice?: number;
}

/** Stored LLM decision record */
export interface DecisionRecord {
  id: number;
  symbol: string;
  action: TradeAction;
  confidence: number;
  positionSizePct: number;
  stopLossPct: number;
  takeProfitPct: number;
  reason: string;
  rawContextJson: string;
  llmOutputJson: string;
  riskCheckPassed: boolean;
  riskCheckReason?: string;
  createdAt: string;
}

// ------------------------------------------------------------
// 9. Agent Run
// ------------------------------------------------------------

/** Summary of a single agent pipeline run */
export interface AgentRunSummary {
  runId: string;
  startedAt: string;
  completedAt: string;
  tickersProcessed: string[];
  decisions: LlmDecision[];
  ordersPlaced: TradeOrder[];
  ordersSkipped: { symbol: string; reason: string }[];
  errors: { symbol: string; error: string }[];
}

// ------------------------------------------------------------
// 10. API Response shapes
// ------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}
