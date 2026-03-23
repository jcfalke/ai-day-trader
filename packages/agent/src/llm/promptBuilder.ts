// ============================================================
// LLM Prompt Builder
// Constructs the system + user prompts from TickerContext bundles
// ============================================================
import { TickerContext, LlmResponse, LlmDecision } from "@ai-trader/shared";
import { LLM_CONFIG } from "@ai-trader/shared";

// ------------------------------------------------------------
// System Prompt — immutable trading persona
// ------------------------------------------------------------
export const SYSTEM_PROMPT = `You are an expert intraday trader AI assistant with deep knowledge of technical analysis and market microstructure.

STRICT RULES — you MUST follow these always:
1. You ONLY trade with conservative position sizes (never exceed 5% of equity per ticker).
2. You NEVER use leverage.
3. You NEVER suggest overnight positions — all trades must close by end of day.
4. You ALWAYS set a stop-loss and take-profit for every BUY or SELL action.
5. You ONLY output valid JSON matching the exact schema provided. NO extra text, NO markdown fences.
6. If unsure, prefer HOLD. Only act when signals are clear and aligned.
7. Minimum confidence to act: 0.65. If confidence < 0.65, set action to HOLD.

DECISION CRITERIA (use all available signals together):
- RSI: <30 = oversold (buy signal), >70 = overbought (sell signal)
- MACD histogram crossover: positive crossing zero = bullish, negative = bearish
- Price vs Bollinger Bands: below lower band = buy opportunity, above upper band = sell
- Price vs SMA20/EMA9: above both = uptrend, below both = downtrend
- News sentiment: factor headlines into confidence scoring
- Volume vs SMA: high relative volume = stronger signal confirmation

OUTPUT SCHEMA (respond ONLY with this exact JSON):
{
  "decisions": [
    {
      "symbol": "string",
      "action": "BUY" | "SELL" | "HOLD",
      "position_size_pct": number (0.0–5.0),
      "stop_loss_pct": number (0.5–5.0),
      "take_profit_pct": number (0.5–10.0),
      "confidence": number (0.0–1.0),
      "reason": "string (1-2 sentences max)"
    }
  ]
}`;

// ------------------------------------------------------------
// User Prompt — built dynamically per agent run
// ------------------------------------------------------------
export function buildUserPrompt(contexts: TickerContext[]): string {
  const tickerBlocks = contexts.map((ctx) => {
    const candles = ctx.recentCandles.slice(-10); // last 10 for prompt brevity
    const ind = ctx.latestIndicators;
    const latestCandle = candles[candles.length - 1];
    const news = ctx.recentNews
      .slice(0, 3)
      .map((n) => `  - [${n.source}] "${n.headline}" (${n.publishedAt})`)
      .join("\n");

    const positionInfo = ctx.currentPosition
      ? `CURRENT POSITION: ${ctx.currentPosition.qty} shares ${ctx.currentPosition.side} @ avg $${ctx.currentPosition.avgEntryPrice.toFixed(2)}, unrealized PnL: $${ctx.currentPosition.unrealizedPnl.toFixed(2)}`
      : "CURRENT POSITION: None";

    return `
=== ${ctx.symbol} (${ctx.timeframe}) ===
Current Price: $${latestCandle?.close.toFixed(2) ?? "N/A"}
Account Equity: $${ctx.accountEquity.toFixed(2)}
${positionInfo}

LATEST INDICATORS:
  SMA20: ${ind.sma20.toFixed(2)}  |  EMA9: ${ind.ema9.toFixed(2)}
  RSI14: ${ind.rsi14.toFixed(1)}  |  ATR14: ${ind.atr14.toFixed(3)}
  MACD: ${ind.macd.toFixed(4)}  Signal: ${ind.macdSignal.toFixed(4)}  Hist: ${ind.macdHistogram.toFixed(4)}
  BB Upper: ${ind.bbUpper.toFixed(2)}  Middle: ${ind.bbMiddle.toFixed(2)}  Lower: ${ind.bbLower.toFixed(2)}
  Volume SMA20: ${ind.volumeSma20.toFixed(0)}  |  Current Volume: ${latestCandle?.volume ?? "N/A"}

RECENT CANDLES (last 10, oldest → newest) [open,high,low,close,volume]:
${candles
  .map(
    (c) =>
      `  ${c.timestamp.substring(11, 16)} | O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)} V:${c.volume}`
  )
  .join("\n")}

RECENT NEWS HEADLINES:
${news || "  No recent news available."}
`;
  });

  return `Analyze the following ${contexts.length} ticker(s) and provide trading decisions.
Context timestamp: ${new Date().toISOString()}

${tickerBlocks.join("\n---\n")}

Respond ONLY with valid JSON matching the output schema. No explanations outside the JSON.`;
}

// ------------------------------------------------------------
// Parse & validate LLM JSON response
// ------------------------------------------------------------
export function parseLlmResponse(rawText: string, symbols: string[]): LlmResponse {
  // Strip markdown code fences if model adds them
  const cleaned = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  let parsed: { decisions: LlmDecision[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`LLM response is not valid JSON: ${cleaned.substring(0, 200)}`);
  }

  if (!Array.isArray(parsed.decisions)) {
    throw new Error("LLM response missing 'decisions' array");
  }

  const validated = parsed.decisions.map((d): LlmDecision => {
    if (!symbols.includes(d.symbol)) {
      throw new Error(`Unknown symbol in LLM response: ${d.symbol}`);
    }
    const action = d.action?.toUpperCase();
    if (!["BUY", "SELL", "HOLD"].includes(action)) {
      throw new Error(`Invalid action '${d.action}' for ${d.symbol}`);
    }
    return {
      symbol: d.symbol,
      action: action as "BUY" | "SELL" | "HOLD",
      position_size_pct: clamp(Number(d.position_size_pct), 0, 5),
      stop_loss_pct: clamp(Number(d.stop_loss_pct), 0.1, 10),
      take_profit_pct: clamp(Number(d.take_profit_pct), 0.1, 20),
      confidence: clamp(Number(d.confidence), 0, 1),
      reason: String(d.reason ?? "").substring(0, 500),
    };
  });

  return { decisions: validated, rawOutput: rawText };
}

function clamp(value: number, min: number, max: number): number {
  if (isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}
