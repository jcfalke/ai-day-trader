// ============================================================
// Technical Indicators — Pure functions, no external deps
// Implements: SMA, EMA, RSI, MACD, Bollinger Bands, ATR
// ============================================================
import {
  MarketDataCandle,
  IndicatorBundle,
  MacdResult,
  BollingerBands,
} from "@ai-trader/shared";
import { INDICATOR_PERIODS } from "@ai-trader/shared";

// ------------------------------------------------------------
// Simple Moving Average
// ------------------------------------------------------------
export function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

// ------------------------------------------------------------
// Exponential Moving Average
// ------------------------------------------------------------
export function ema(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  // Seed with SMA of first `period` values
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < values.length; i++) {
    const current = values[i] * k + prev * (1 - k);
    result.push(current);
    prev = current;
  }
  return result;
}

// ------------------------------------------------------------
// RSI (Wilder's smoothed method)
// ------------------------------------------------------------
export function rsi(closes: number[], period: number): number[] {
  if (closes.length < period + 1) return [];
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }
  const result: number[] = [];
  // Initial averages
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const calcRsi = (ag: number, al: number) =>
    al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  result.push(calcRsi(avgGain, avgLoss));

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    result.push(calcRsi(avgGain, avgLoss));
  }
  return result;
}

// ------------------------------------------------------------
// MACD (fast EMA - slow EMA, with signal line & histogram)
// ------------------------------------------------------------
export function macd(
  closes: number[],
  fast: number,
  slow: number,
  signal: number
): MacdResult {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  // Align arrays (slowEma is shorter)
  const offset = slow - fast;
  const macdLine = slowEma.map((v, i) => fastEma[i + offset] - v);
  const signalLine = ema(macdLine, signal);
  const macdOffset = macdLine.length - signalLine.length;
  const histogram = signalLine.map(
    (v, i) => macdLine[i + macdOffset] - v
  );
  return { macdLine, signalLine, histogram };
}

// ------------------------------------------------------------
// Bollinger Bands
// ------------------------------------------------------------
export function bollingerBands(
  closes: number[],
  period: number,
  stdDev: number
): BollingerBands {
  const middle = sma(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i - (period - 1)];
    const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);
    upper.push(mean + stdDev * sd);
    lower.push(mean - stdDev * sd);
  }
  return { upper, middle, lower };
}

// ------------------------------------------------------------
// Average True Range (Wilder's)
// ------------------------------------------------------------
export function atr(candles: MarketDataCandle[], period: number): number[] {
  if (candles.length < period + 1) return [];
  const trValues: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trValues.push(tr);
  }
  const result: number[] = [];
  let prevAtr = trValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prevAtr);
  for (let i = period; i < trValues.length; i++) {
    const currentAtr = (prevAtr * (period - 1) + trValues[i]) / period;
    result.push(currentAtr);
    prevAtr = currentAtr;
  }
  return result;
}

// ------------------------------------------------------------
// Tail — returns last N items from an array (for LLM context)
// ------------------------------------------------------------
function tail<T>(arr: T[], n: number): T[] {
  return arr.slice(-n);
}

// ------------------------------------------------------------
// Master compute function — builds full IndicatorBundle
// ------------------------------------------------------------
export function computeIndicators(
  candles: MarketDataCandle[],
  symbol: string
): IndicatorBundle {
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const timeframe = candles[0]?.timeframe ?? "unknown";
  const KEEP = 20; // send last 20 values to LLM

  const sma20 = sma(closes, INDICATOR_PERIODS.SMA_PERIOD);
  const ema9 = ema(closes, INDICATOR_PERIODS.EMA_PERIOD);
  const rsi14 = rsi(closes, INDICATOR_PERIODS.RSI_PERIOD);
  const macdResult = macd(
    closes,
    INDICATOR_PERIODS.MACD_FAST,
    INDICATOR_PERIODS.MACD_SLOW,
    INDICATOR_PERIODS.MACD_SIGNAL
  );
  const bb = bollingerBands(
    closes,
    INDICATOR_PERIODS.BB_PERIOD,
    INDICATOR_PERIODS.BB_STD_DEV
  );
  const atr14 = atr(candles, INDICATOR_PERIODS.ATR_PERIOD);
  const volumeSma20 = sma(volumes, INDICATOR_PERIODS.VOLUME_SMA_PERIOD);

  return {
    symbol,
    timeframe,
    sma20: tail(sma20, KEEP).map((v) => parseFloat(v.toFixed(4))),
    ema9: tail(ema9, KEEP).map((v) => parseFloat(v.toFixed(4))),
    rsi14: tail(rsi14, KEEP).map((v) => parseFloat(v.toFixed(2))),
    macd: {
      macdLine: tail(macdResult.macdLine, KEEP).map((v) =>
        parseFloat(v.toFixed(4))
      ),
      signalLine: tail(macdResult.signalLine, KEEP).map((v) =>
        parseFloat(v.toFixed(4))
      ),
      histogram: tail(macdResult.histogram, KEEP).map((v) =>
        parseFloat(v.toFixed(4))
      ),
    },
    bollingerBands: {
      upper: tail(bb.upper, KEEP).map((v) => parseFloat(v.toFixed(4))),
      middle: tail(bb.middle, KEEP).map((v) => parseFloat(v.toFixed(4))),
      lower: tail(bb.lower, KEEP).map((v) => parseFloat(v.toFixed(4))),
    },
    atr14: tail(atr14, KEEP).map((v) => parseFloat(v.toFixed(4))),
    volumeSma20: tail(volumeSma20, KEEP).map((v) => parseFloat(v.toFixed(0))),
    computedAt: new Date().toISOString(),
  };
}

/** Extract latest snapshot (last value from each series) */
export function latestSnapshot(bundle: IndicatorBundle) {
  const last = <T>(arr: T[]): T => arr[arr.length - 1];
  return {
    sma20: last(bundle.sma20),
    ema9: last(bundle.ema9),
    rsi14: last(bundle.rsi14),
    macd: last(bundle.macd.macdLine),
    macdSignal: last(bundle.macd.signalLine),
    macdHistogram: last(bundle.macd.histogram),
    bbUpper: last(bundle.bollingerBands.upper),
    bbMiddle: last(bundle.bollingerBands.middle),
    bbLower: last(bundle.bollingerBands.lower),
    atr14: last(bundle.atr14),
    volumeSma20: last(bundle.volumeSma20),
  };
}
