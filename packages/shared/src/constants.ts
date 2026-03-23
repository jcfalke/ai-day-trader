// ============================================================
// Shared Constants
// ============================================================

/** Default risk config values */
export const DEFAULT_RISK_CONFIG = {
  MAX_POSITION_PER_TICKER_PCT: 5,
  MAX_DAILY_LOSS_PCT: 2,
  MIN_CONFIDENCE: 0.65,
  MAX_OPEN_POSITIONS: 5,
  MAX_ORDER_VALUE_USD: 2000,
  PAPER_MODE: true,
  WATCHLIST: ["TSLA", "NVDA", "SPY"],
  TIMEFRAME: "5Min" as const,
  LOOKBACK_BARS: 50,
  NEWS_ITEMS_PER_TICKER: 5,
};

/** Market hours in Eastern Time */
export const MARKET_HOURS = {
  /** 09:30 ET */
  OPEN_HOUR: 9,
  OPEN_MINUTE: 30,
  /** 16:00 ET */
  CLOSE_HOUR: 16,
  CLOSE_MINUTE: 0,
  /** Buffer before close — stop trading 15 min early */
  CLOSE_BUFFER_MINUTES: 15,
  TIMEZONE: "America/New_York",
};

/** LLM settings */
export const LLM_CONFIG = {
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.1,
  MODEL_ID: "claude-opus-4-6",
};

/** Indicator periods */
export const INDICATOR_PERIODS = {
  SMA_PERIOD: 20,
  EMA_PERIOD: 9,
  RSI_PERIOD: 14,
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,
  BB_PERIOD: 20,
  BB_STD_DEV: 2,
  ATR_PERIOD: 14,
  VOLUME_SMA_PERIOD: 20,
};
