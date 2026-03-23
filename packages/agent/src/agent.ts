// ============================================================
// Main Agent Orchestrator
// Runs a full pipeline: data → indicators → LLM → risk → broker
// ============================================================
import { v4 as uuidv4 } from "uuid";
import {
  RiskConfig,
  TickerContext,
  AgentRunSummary,
  TradeOrder,
  LlmDecision,
} from "@ai-trader/shared";
import { AlpacaClient } from "./broker/alpacaClient";
import { MarketDataClient } from "./data/marketData";
import { NewsClient } from "./data/newsClient";
import { computeIndicators, latestSnapshot } from "./indicators/compute";
import { LlmClient } from "./llm/llmClient";
import { RiskManager } from "./risk/riskManager";
import { logger } from "./utils/logger";
import axios from "axios";

export class TradingAgent {
  private broker: AlpacaClient;
  private marketData: MarketDataClient;
  private news: NewsClient;
  private llm: LlmClient;
  private risk: RiskManager;
  private config: RiskConfig;
  private backendUrl: string;

  constructor(config: RiskConfig) {
    this.config = config;

    const alpacaKey = process.env.ALPACA_API_KEY!;
    const alpacaSecret = process.env.ALPACA_API_SECRET!;
    const llmProvider =
      (process.env.LLM_PROVIDER as "anthropic" | "openai") ?? "anthropic";
    const llmApiKey =
      llmProvider === "anthropic"
        ? process.env.ANTHROPIC_API_KEY!
        : process.env.OPENAI_API_KEY!;

    this.broker = new AlpacaClient(alpacaKey, alpacaSecret, config.PAPER_MODE);
    this.marketData = new MarketDataClient(alpacaKey, alpacaSecret);
    this.news = new NewsClient(
      alpacaKey,
      alpacaSecret,
      process.env.NEWSAPI_KEY
    );
    this.llm = new LlmClient({ provider: llmProvider, apiKey: llmApiKey });
    this.risk = new RiskManager(config);
    this.backendUrl = process.env.BACKEND_URL ?? "http://localhost:3001";
  }

  // ----------------------------------------------------------
  // Run a full agent cycle
  // ----------------------------------------------------------
  async run(): Promise<AgentRunSummary> {
    const runId = uuidv4();
    const startedAt = new Date().toISOString();
    logger.info(`========== Agent Run ${runId} started ==========`);

    const summary: AgentRunSummary = {
      runId,
      startedAt,
      completedAt: "",
      tickersProcessed: [],
      decisions: [],
      ordersPlaced: [],
      ordersSkipped: [],
      errors: [],
    };

    // 1. Check market hours
    if (!this.risk.isMarketOpen()) {
      logger.warn("[Agent] Market is closed — skipping run");
      summary.completedAt = new Date().toISOString();
      return summary;
    }

    // 2. Get account PnL
    let pnl;
    try {
      pnl = await this.broker.getAccount();
      logger.info(
        `[Agent] Account equity: $${pnl.totalEquity.toFixed(2)}, day PnL: $${pnl.dayPnl.toFixed(2)}`
      );
    } catch (err: any) {
      logger.error("[Agent] Failed to fetch account info", { error: err.message });
      summary.errors.push({ symbol: "ACCOUNT", error: err.message });
      summary.completedAt = new Date().toISOString();
      return summary;
    }

    // 3. Daily loss check
    const lossCheck = this.risk.checkDailyLoss(pnl);
    if (!lossCheck.passed) {
      logger.warn(`[Agent] ${lossCheck.reason} — halting all trading`);
      summary.completedAt = new Date().toISOString();
      return summary;
    }

    // 4. Build context bundles for each ticker
    const contexts: TickerContext[] = [];
    for (const symbol of this.config.WATCHLIST) {
      try {
        const ctx = await this.buildContext(
          symbol,
          pnl.totalEquity,
          pnl.openPositions.find((p) => p.symbol === symbol) ?? null
        );
        contexts.push(ctx);
        summary.tickersProcessed.push(symbol);
      } catch (err: any) {
        logger.error(`[Agent] Failed to build context for ${symbol}`, {
          error: err.message,
        });
        summary.errors.push({ symbol, error: err.message });
      }
    }

    if (contexts.length === 0) {
      logger.error("[Agent] No valid contexts built — aborting");
      summary.completedAt = new Date().toISOString();
      return summary;
    }

    // 5. LLM analysis
    let llmResponse;
    try {
      llmResponse = await this.llm.analyze(contexts);
      summary.decisions = llmResponse.decisions;
      logger.info(`[Agent] LLM returned ${llmResponse.decisions.length} decisions`);
    } catch (err: any) {
      logger.error("[Agent] LLM call failed", { error: err.message });
      summary.errors.push({ symbol: "LLM", error: err.message });
      summary.completedAt = new Date().toISOString();
      return summary;
    }

    // 6. Process each decision
    for (const decision of llmResponse.decisions) {
      await this.processDecision(
        decision,
        pnl,
        contexts,
        summary,
        llmResponse.rawOutput ?? ""
      );
    }

    summary.completedAt = new Date().toISOString();
    logger.info(
      `========== Agent Run ${runId} complete — placed: ${summary.ordersPlaced.length}, skipped: ${summary.ordersSkipped.length}, errors: ${summary.errors.length} ==========`
    );
    return summary;
  }

  // ----------------------------------------------------------
  // Build context bundle for a single ticker
  // ----------------------------------------------------------
  private async buildContext(
    symbol: string,
    equity: number,
    currentPosition: any
  ): Promise<TickerContext> {
    const [candles, newsItems] = await Promise.all([
      this.marketData.getBars(symbol, this.config.TIMEFRAME, this.config.LOOKBACK_BARS),
      this.news.getNewsWithSentiment(symbol, this.config.NEWS_ITEMS_PER_TICKER),
    ]);

    if (candles.length < 30) {
      throw new Error(`Insufficient candle data for ${symbol}: got ${candles.length}`);
    }

    const indicatorBundle = computeIndicators(candles, symbol);
    const latestInd = latestSnapshot(indicatorBundle);

    return {
      symbol,
      timeframe: this.config.TIMEFRAME,
      recentCandles: candles.slice(-20), // last 20 candles in context
      latestIndicators: latestInd,
      recentNews: newsItems,
      currentPosition,
      accountEquity: equity,
      contextBuiltAt: new Date().toISOString(),
    };
  }

  // ----------------------------------------------------------
  // Process a single LLM decision → risk check → order
  // ----------------------------------------------------------
  private async processDecision(
    decision: LlmDecision,
    pnl: any,
    contexts: TickerContext[],
    summary: AgentRunSummary,
    rawLlmOutput: string
  ) {
    const ctx = contexts.find((c) => c.symbol === decision.symbol);
    if (!ctx) return;

    logger.info(
      `[Agent] ${decision.symbol}: ${decision.action} confidence=${decision.confidence.toFixed(2)} — ${decision.reason}`
    );

    // Risk checks
    const riskResult = this.risk.runAllChecks(
      decision,
      pnl,
      pnl.openPositions
    );

    // Store decision to backend regardless of risk outcome
    const decisionPayload = {
      symbol: decision.symbol,
      action: decision.action,
      confidence: decision.confidence,
      positionSizePct: decision.position_size_pct,
      stopLossPct: decision.stop_loss_pct,
      takeProfitPct: decision.take_profit_pct,
      reason: decision.reason,
      rawContextJson: JSON.stringify(ctx),
      llmOutputJson: rawLlmOutput,
      riskCheckPassed: riskResult.passed,
      riskCheckReason: riskResult.reasons.join("; "),
    };

    let decisionId: number | undefined;
    try {
      const res = await axios.post(
        `${this.backendUrl}/api/trade-decisions`,
        decisionPayload,
        { timeout: 5000 }
      );
      decisionId = res.data?.data?.id;
    } catch (err: any) {
      logger.warn(`[Agent] Failed to store decision for ${decision.symbol}: ${err.message}`);
    }

    if (!riskResult.passed) {
      logger.info(
        `[Agent] ${decision.symbol} skipped — ${riskResult.reasons.join(", ")}`
      );
      summary.ordersSkipped.push({
        symbol: decision.symbol,
        reason: riskResult.reasons.join("; "),
      });
      return;
    }

    // Get current price
    const latestCandle = ctx.recentCandles[ctx.recentCandles.length - 1];
    const currentPrice = latestCandle?.close ?? 0;
    if (currentPrice <= 0) {
      summary.ordersSkipped.push({
        symbol: decision.symbol,
        reason: "Invalid current price",
      });
      return;
    }

    // Build order
    let order: TradeOrder;
    try {
      order = this.risk.buildOrder(
        decision,
        currentPrice,
        riskResult.finalSizePct,
        pnl.totalEquity
      );
      order.decisionId = decisionId?.toString();
    } catch (err: any) {
      logger.warn(`[Agent] Order build failed for ${decision.symbol}: ${err.message}`);
      summary.ordersSkipped.push({ symbol: decision.symbol, reason: err.message });
      return;
    }

    // Paper mode — log only
    if (this.config.PAPER_MODE) {
      logger.info(
        `[PAPER] Would place ${order.side.toUpperCase()} ${order.qty}x ${order.symbol} @ ~$${currentPrice.toFixed(2)}`,
        {
          stopLoss: order.stopLoss?.stopPrice,
          takeProfit: order.takeProfit?.limitPrice,
        }
      );
    }

    // Place order
    try {
      const placed = await this.broker.placeOrder(order);
      summary.ordersPlaced.push(placed);

      // Store trade to backend
      try {
        await axios.post(
          `${this.backendUrl}/api/trades`,
          {
            symbol: placed.symbol,
            side: placed.side,
            qty: placed.qty,
            entryPrice: currentPrice,
            stopLoss: order.stopLoss?.stopPrice,
            takeProfit: order.takeProfit?.limitPrice,
            brokerId: placed.brokerId,
            isPaper: placed.isPaper,
            decisionId,
          },
          { timeout: 5000 }
        );
      } catch (err: any) {
        logger.warn(`[Agent] Failed to store trade: ${err.message}`);
      }

      logger.info(
        `[Agent] Order placed: ${placed.side.toUpperCase()} ${placed.qty}x ${placed.symbol} | broker_id=${placed.brokerId}`
      );
    } catch (err: any) {
      logger.error(`[Agent] Order placement failed for ${decision.symbol}`, {
        error: err.message,
      });
      summary.errors.push({ symbol: decision.symbol, error: err.message });
    }
  }
}
