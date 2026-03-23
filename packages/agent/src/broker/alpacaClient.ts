// ============================================================
// Alpaca Broker Client — Paper Trading + Live
// Docs: https://docs.alpaca.markets/reference/
// ============================================================
import axios, { AxiosInstance } from "axios";
import {
  TradeOrder,
  OpenPosition,
  PnlSummary,
  OrderStatus,
} from "@ai-trader/shared";
import { logger } from "../utils/logger";

const PAPER_BASE = "https://paper-api.alpaca.markets";
const LIVE_BASE = "https://api.alpaca.markets";

export class AlpacaClient {
  private http: AxiosInstance;
  private isPaper: boolean;

  constructor(apiKey: string, apiSecret: string, paper = true) {
    this.isPaper = paper;
    const baseURL = paper ? PAPER_BASE : LIVE_BASE;
    this.http = axios.create({
      baseURL,
      headers: {
        "APCA-API-KEY-ID": apiKey,
        "APCA-API-SECRET-KEY": apiSecret,
        "content-type": "application/json",
      },
      timeout: 15000,
    });
    logger.info(`[Alpaca] Client initialized — ${paper ? "PAPER" : "LIVE"} mode`);
  }

  // ----------------------------------------------------------
  // Account & PnL
  // ----------------------------------------------------------
  async getAccount(): Promise<PnlSummary> {
    const { data } = await this.http.get("/v2/account");
    const positions = await this.getPositions();
    const dayPnl = parseFloat(data.equity) - parseFloat(data.last_equity);
    return {
      totalEquity: parseFloat(data.equity),
      cash: parseFloat(data.cash),
      portfolioValue: parseFloat(data.portfolio_value),
      dayPnl,
      dayPnlPct: (dayPnl / parseFloat(data.last_equity)) * 100,
      totalUnrealizedPnl: positions.reduce((s, p) => s + p.unrealizedPnl, 0),
      totalRealizedPnlToday: parseFloat(data.equity) - parseFloat(data.last_equity),
      openPositions: positions,
      asOf: new Date().toISOString(),
    };
  }

  // ----------------------------------------------------------
  // Positions
  // ----------------------------------------------------------
  async getPositions(): Promise<OpenPosition[]> {
    const { data } = await this.http.get("/v2/positions");
    return (data as any[]).map((p) => ({
      symbol: p.symbol,
      qty: parseFloat(p.qty),
      side: p.side as "long" | "short",
      avgEntryPrice: parseFloat(p.avg_entry_price),
      currentPrice: parseFloat(p.current_price),
      marketValue: parseFloat(p.market_value),
      unrealizedPnl: parseFloat(p.unrealized_pl),
      unrealizedPnlPct: parseFloat(p.unrealized_plpc) * 100,
      costBasis: parseFloat(p.cost_basis),
    }));
  }

  async getPosition(symbol: string): Promise<OpenPosition | null> {
    try {
      const { data } = await this.http.get(`/v2/positions/${symbol}`);
      return {
        symbol: data.symbol,
        qty: parseFloat(data.qty),
        side: data.side as "long" | "short",
        avgEntryPrice: parseFloat(data.avg_entry_price),
        currentPrice: parseFloat(data.current_price),
        marketValue: parseFloat(data.market_value),
        unrealizedPnl: parseFloat(data.unrealized_pl),
        unrealizedPnlPct: parseFloat(data.unrealized_plpc) * 100,
        costBasis: parseFloat(data.cost_basis),
      };
    } catch (err: any) {
      if (err.response?.status === 404) return null;
      throw err;
    }
  }

  // ----------------------------------------------------------
  // Place Order
  // ----------------------------------------------------------
  async placeOrder(order: TradeOrder): Promise<TradeOrder> {
    if (order.isPaper && !this.isPaper) {
      logger.warn("[Alpaca] Order marked as paper but client is in LIVE mode — refusing");
      return { ...order, status: "rejected" };
    }

    const payload: Record<string, unknown> = {
      symbol: order.symbol,
      qty: order.qty,
      side: order.side,
      type: order.type,
      time_in_force: order.timeInForce,
    };

    if (order.limitPrice) payload.limit_price = order.limitPrice.toFixed(2);
    if (order.stopPrice) payload.stop_price = order.stopPrice.toFixed(2);

    // Bracket order (stop-loss + take-profit)
    if (order.stopLoss && order.takeProfit) {
      payload.order_class = "bracket";
      payload.stop_loss = { stop_price: order.stopLoss.stopPrice.toFixed(2) };
      payload.take_profit = {
        limit_price: order.takeProfit.limitPrice.toFixed(2),
      };
    }

    logger.info(
      `[Alpaca] Placing ${order.side.toUpperCase()} ${order.qty}x ${order.symbol} (${order.type})`,
      { payload }
    );

    const { data } = await this.http.post("/v2/orders", payload);
    return {
      ...order,
      brokerId: data.id,
      status: this.mapStatus(data.status),
      submittedAt: data.submitted_at,
    };
  }

  // ----------------------------------------------------------
  // Cancel Order
  // ----------------------------------------------------------
  async cancelOrder(brokerId: string): Promise<void> {
    await this.http.delete(`/v2/orders/${brokerId}`);
    logger.info(`[Alpaca] Cancelled order ${brokerId}`);
  }

  // ----------------------------------------------------------
  // Close position (end-of-day cleanup)
  // ----------------------------------------------------------
  async closePosition(symbol: string): Promise<void> {
    try {
      await this.http.delete(`/v2/positions/${symbol}`);
      logger.info(`[Alpaca] Closed position for ${symbol}`);
    } catch (err: any) {
      logger.warn(`[Alpaca] Could not close position for ${symbol}: ${err.message}`);
    }
  }

  async closeAllPositions(): Promise<void> {
    await this.http.delete("/v2/positions");
    logger.info("[Alpaca] Closed all positions");
  }

  // ----------------------------------------------------------
  // Get current price (latest quote)
  // ----------------------------------------------------------
  async getLatestPrice(symbol: string): Promise<number> {
    const { data } = await this.http.get(
      `https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`,
      { headers: {} }
    );
    return parseFloat(data.quote?.ap ?? data.quote?.bp ?? 0);
  }

  private mapStatus(alpacaStatus: string): OrderStatus {
    const map: Record<string, OrderStatus> = {
      new: "submitted",
      partially_filled: "partially_filled",
      filled: "filled",
      done_for_day: "cancelled",
      canceled: "cancelled",
      expired: "expired",
      replaced: "cancelled",
      pending_cancel: "submitted",
      pending_replace: "submitted",
      held: "submitted",
      accepted: "submitted",
      pending_new: "pending",
      accepted_for_bidding: "pending",
      stopped: "cancelled",
      rejected: "rejected",
      suspended: "rejected",
      calculated: "submitted",
    };
    return map[alpacaStatus] ?? "pending";
  }
}
