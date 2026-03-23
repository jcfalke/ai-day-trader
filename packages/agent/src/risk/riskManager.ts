// ============================================================
// Risk Management Module
// Enforces all guardrails before any trade is placed.
// ============================================================
import {
  RiskConfig,
  RiskCheckResult,
  LlmDecision,
  OpenPosition,
  PnlSummary,
  TradeOrder,
  OrderSide,
} from "@ai-trader/shared";
import { logger } from "../utils/logger";
import { MARKET_HOURS } from "@ai-trader/shared";

export class RiskManager {
  constructor(private config: RiskConfig) {}

  // ----------------------------------------------------------
  // Market Hours Check (Eastern Time)
  // ----------------------------------------------------------
  isMarketOpen(): boolean {
    const now = new Date();
    const etTime = new Date(
      now.toLocaleString("en-US", { timeZone: MARKET_HOURS.TIMEZONE })
    );
    const day = etTime.getDay(); // 0=Sun, 6=Sat
    if (day === 0 || day === 6) return false;

    const hours = etTime.getHours();
    const minutes = etTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const openMinutes =
      MARKET_HOURS.OPEN_HOUR * 60 + MARKET_HOURS.OPEN_MINUTE;
    const closeMinutes =
      MARKET_HOURS.CLOSE_HOUR * 60 +
      MARKET_HOURS.CLOSE_MINUTE -
      MARKET_HOURS.CLOSE_BUFFER_MINUTES;

    return totalMinutes >= openMinutes && totalMinutes <= closeMinutes;
  }

  // ----------------------------------------------------------
  // Daily Loss Circuit Breaker
  // ----------------------------------------------------------
  checkDailyLoss(pnl: PnlSummary): RiskCheckResult {
    const lossPct =
      (Math.abs(Math.min(pnl.dayPnl, 0)) / pnl.totalEquity) * 100;
    if (lossPct >= this.config.MAX_DAILY_LOSS_PCT) {
      return {
        passed: false,
        reason: `Daily loss circuit breaker: realized loss ${lossPct.toFixed(
          2
        )}% >= max ${this.config.MAX_DAILY_LOSS_PCT}%`,
      };
    }
    return { passed: true };
  }

  // ----------------------------------------------------------
  // Confidence Threshold
  // ----------------------------------------------------------
  checkConfidence(decision: LlmDecision): RiskCheckResult {
    if (decision.confidence < this.config.MIN_CONFIDENCE) {
      return {
        passed: false,
        reason: `Confidence ${decision.confidence.toFixed(
          2
        )} below minimum ${this.config.MIN_CONFIDENCE}`,
      };
    }
    return { passed: true };
  }

  // ----------------------------------------------------------
  // Position Size Check
  // ----------------------------------------------------------
  checkPositionSize(decision: LlmDecision): RiskCheckResult {
    if (decision.position_size_pct > this.config.MAX_POSITION_PER_TICKER_PCT) {
      const adjusted = this.config.MAX_POSITION_PER_TICKER_PCT;
      logger.warn(
        `[RiskManager] ${decision.symbol}: Capping position from ${decision.position_size_pct}% to ${adjusted}%`
      );
      return {
        passed: true,
        adjustedSizePct: adjusted,
        reason: `Position size capped from ${decision.position_size_pct}% to ${adjusted}%`,
      };
    }
    return { passed: true, adjustedSizePct: decision.position_size_pct };
  }

  // ----------------------------------------------------------
  // Max Open Positions
  // ----------------------------------------------------------
  checkMaxPositions(
    openPositions: OpenPosition[],
    symbol: string,
    action: string
  ): RiskCheckResult {
    const alreadyHasPosition = openPositions.some((p) => p.symbol === symbol);
    if (
      !alreadyHasPosition &&
      action === "BUY" &&
      openPositions.length >= this.config.MAX_OPEN_POSITIONS
    ) {
      return {
        passed: false,
        reason: `Max open positions (${this.config.MAX_OPEN_POSITIONS}) reached`,
      };
    }
    return { passed: true };
  }

  // ----------------------------------------------------------
  // Max Order Value
  // ----------------------------------------------------------
  checkMaxOrderValue(orderValueUsd: number): RiskCheckResult {
    if (orderValueUsd > this.config.MAX_ORDER_VALUE_USD) {
      return {
        passed: false,
        reason: `Order value $${orderValueUsd.toFixed(
          2
        )} exceeds max $${this.config.MAX_ORDER_VALUE_USD}`,
      };
    }
    return { passed: true };
  }

  // ----------------------------------------------------------
  // Existing Position Check (avoid doubling up)
  // ----------------------------------------------------------
  checkExistingPosition(
    decision: LlmDecision,
    openPositions: OpenPosition[]
  ): RiskCheckResult {
    const existing = openPositions.find((p) => p.symbol === decision.symbol);
    if (existing && decision.action === "BUY" && existing.side === "long") {
      return {
        passed: false,
        reason: `Already long ${decision.symbol} — skipping duplicate BUY`,
      };
    }
    if (existing && decision.action === "SELL" && existing.side === "short") {
      return {
        passed: false,
        reason: `Already short ${decision.symbol} — skipping duplicate SELL`,
      };
    }
    return { passed: true };
  }

  // ----------------------------------------------------------
  // Master Check — runs all guards in order
  // ----------------------------------------------------------
  runAllChecks(
    decision: LlmDecision,
    pnl: PnlSummary,
    openPositions: OpenPosition[]
  ): {
    passed: boolean;
    reasons: string[];
    finalSizePct: number;
    orderValueUsd: number;
  } {
    const reasons: string[] = [];

    // Market hours
    if (!this.isMarketOpen()) {
      return {
        passed: false,
        reasons: ["Market is closed — no trades"],
        finalSizePct: 0,
        orderValueUsd: 0,
      };
    }

    // HOLD never needs to be placed
    if (decision.action === "HOLD") {
      return {
        passed: false,
        reasons: ["Action is HOLD — no order"],
        finalSizePct: 0,
        orderValueUsd: 0,
      };
    }

    // Daily loss breaker
    const lossCheck = this.checkDailyLoss(pnl);
    if (!lossCheck.passed) {
      return {
        passed: false,
        reasons: [lossCheck.reason!],
        finalSizePct: 0,
        orderValueUsd: 0,
      };
    }

    // Confidence
    const confCheck = this.checkConfidence(decision);
    if (!confCheck.passed) {
      reasons.push(confCheck.reason!);
      return { passed: false, reasons, finalSizePct: 0, orderValueUsd: 0 };
    }

    // Existing position guard
    const existingCheck = this.checkExistingPosition(decision, openPositions);
    if (!existingCheck.passed) {
      reasons.push(existingCheck.reason!);
      return { passed: false, reasons, finalSizePct: 0, orderValueUsd: 0 };
    }

    // Position size (may be capped)
    const sizeCheck = this.checkPositionSize(decision);
    const finalSizePct = sizeCheck.adjustedSizePct ?? decision.position_size_pct;
    if (sizeCheck.reason) reasons.push(sizeCheck.reason);

    // Order value
    const orderValueUsd = (finalSizePct / 100) * pnl.totalEquity;
    const valueCheck = this.checkMaxOrderValue(orderValueUsd);
    if (!valueCheck.passed) {
      reasons.push(valueCheck.reason!);
      return { passed: false, reasons, finalSizePct, orderValueUsd };
    }

    // Max open positions
    const posCheck = this.checkMaxPositions(
      openPositions,
      decision.symbol,
      decision.action
    );
    if (!posCheck.passed) {
      reasons.push(posCheck.reason!);
      return { passed: false, reasons, finalSizePct, orderValueUsd };
    }

    return { passed: true, reasons, finalSizePct, orderValueUsd };
  }

  // ----------------------------------------------------------
  // Build a TradeOrder from a validated decision
  // ----------------------------------------------------------
  buildOrder(
    decision: LlmDecision,
    currentPrice: number,
    finalSizePct: number,
    equity: number
  ): TradeOrder {
    const orderValueUsd = (finalSizePct / 100) * equity;
    const qty = Math.floor(orderValueUsd / currentPrice);

    if (qty <= 0) {
      throw new Error(
        `Calculated qty=${qty} for ${decision.symbol} — order value too small`
      );
    }

    const side: OrderSide = decision.action === "BUY" ? "buy" : "sell";
    const stopPrice =
      side === "buy"
        ? currentPrice * (1 - decision.stop_loss_pct / 100)
        : currentPrice * (1 + decision.stop_loss_pct / 100);
    const takeProfitPrice =
      side === "buy"
        ? currentPrice * (1 + decision.take_profit_pct / 100)
        : currentPrice * (1 - decision.take_profit_pct / 100);

    return {
      symbol: decision.symbol,
      side,
      type: "market",
      qty,
      timeInForce: "day",
      stopLoss: {
        stopPrice: parseFloat(stopPrice.toFixed(2)),
      },
      takeProfit: {
        limitPrice: parseFloat(takeProfitPrice.toFixed(2)),
      },
      isPaper: this.config.PAPER_MODE,
      status: "pending",
    };
  }
}
