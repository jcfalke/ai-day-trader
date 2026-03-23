// ============================================================
// Agent Entry Point
// Run via: npm run run-once (single cycle)
// Or via n8n Cron trigger every X minutes
// ============================================================
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

import { TradingAgent } from "./agent";
import { DEFAULT_RISK_CONFIG } from "@ai-trader/shared";
import { logger } from "./utils/logger";
import fs from "fs";
import path from "path";

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// Build config from environment + defaults
const config = {
  ...DEFAULT_RISK_CONFIG,
  MAX_POSITION_PER_TICKER_PCT: parseFloat(
    process.env.MAX_POSITION_PCT ?? String(DEFAULT_RISK_CONFIG.MAX_POSITION_PER_TICKER_PCT)
  ),
  MAX_DAILY_LOSS_PCT: parseFloat(
    process.env.MAX_DAILY_LOSS_PCT ?? String(DEFAULT_RISK_CONFIG.MAX_DAILY_LOSS_PCT)
  ),
  MIN_CONFIDENCE: parseFloat(
    process.env.MIN_CONFIDENCE ?? String(DEFAULT_RISK_CONFIG.MIN_CONFIDENCE)
  ),
  MAX_OPEN_POSITIONS: parseInt(
    process.env.MAX_OPEN_POSITIONS ?? String(DEFAULT_RISK_CONFIG.MAX_OPEN_POSITIONS)
  ),
  MAX_ORDER_VALUE_USD: parseFloat(
    process.env.MAX_ORDER_VALUE_USD ?? String(DEFAULT_RISK_CONFIG.MAX_ORDER_VALUE_USD)
  ),
  PAPER_MODE: process.env.PAPER_MODE !== "false",
  WATCHLIST: process.env.WATCHLIST
    ? process.env.WATCHLIST.split(",").map((s) => s.trim())
    : DEFAULT_RISK_CONFIG.WATCHLIST,
  TIMEFRAME: (process.env.TIMEFRAME ?? DEFAULT_RISK_CONFIG.TIMEFRAME) as any,
  LOOKBACK_BARS: parseInt(
    process.env.LOOKBACK_BARS ?? String(DEFAULT_RISK_CONFIG.LOOKBACK_BARS)
  ),
  NEWS_ITEMS_PER_TICKER: parseInt(
    process.env.NEWS_ITEMS_PER_TICKER ?? String(DEFAULT_RISK_CONFIG.NEWS_ITEMS_PER_TICKER)
  ),
};

async function main() {
  logger.info("[Startup] AI Day Trader Agent starting");
  logger.info(`[Config] Watchlist: ${config.WATCHLIST.join(", ")}`);
  logger.info(`[Config] Paper Mode: ${config.PAPER_MODE}`);
  logger.info(`[Config] Timeframe: ${config.TIMEFRAME}`);

  const agent = new TradingAgent(config);
  try {
    const summary = await agent.run();
    logger.info("[Run Complete]", {
      ordersPlaced: summary.ordersPlaced.length,
      ordersSkipped: summary.ordersSkipped.length,
      errors: summary.errors.length,
    });
    process.exit(0);
  } catch (err: any) {
    logger.error("[Fatal Error]", { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

main();
