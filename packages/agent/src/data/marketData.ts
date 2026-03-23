// ============================================================
// Market Data Client — Alpaca Data API v2
// Fetches OHLCV candles and latest quotes
// ============================================================
import axios from "axios";
import { MarketDataCandle } from "@ai-trader/shared";
import { logger } from "../utils/logger";

const DATA_BASE = "https://data.alpaca.markets";

export class MarketDataClient {
  private headers: Record<string, string>;

  constructor(apiKey: string, apiSecret: string) {
    this.headers = {
      "APCA-API-KEY-ID": apiKey,
      "APCA-API-SECRET-KEY": apiSecret,
    };
  }

  // ----------------------------------------------------------
  // Fetch OHLCV bars
  // ----------------------------------------------------------
  async getBars(
    symbol: string,
    timeframe: string,
    limit: number
  ): Promise<MarketDataCandle[]> {
    logger.info(`[MarketData] Fetching ${limit}x ${timeframe} bars for ${symbol}`);
    const { data } = await axios.get(
      `${DATA_BASE}/v2/stocks/${symbol}/bars`,
      {
        params: {
          timeframe,
          limit,
          adjustment: "raw",
          feed: "iex",
        },
        headers: this.headers,
        timeout: 10000,
      }
    );

    if (!data.bars || data.bars.length === 0) {
      logger.warn(`[MarketData] No bars returned for ${symbol}`);
      return [];
    }

    return (data.bars as any[]).map((b): MarketDataCandle => ({
      timestamp: b.t,
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v,
      timeframe,
    }));
  }

  // ----------------------------------------------------------
  // Fetch bars for multiple symbols at once
  // ----------------------------------------------------------
  async getMultiBars(
    symbols: string[],
    timeframe: string,
    limit: number
  ): Promise<Record<string, MarketDataCandle[]>> {
    logger.info(`[MarketData] Multi-bar fetch for ${symbols.join(",")} (${timeframe})`);
    const { data } = await axios.get(
      `${DATA_BASE}/v2/stocks/bars`,
      {
        params: {
          symbols: symbols.join(","),
          timeframe,
          limit,
          adjustment: "raw",
          feed: "iex",
        },
        headers: this.headers,
        timeout: 15000,
      }
    );

    const result: Record<string, MarketDataCandle[]> = {};
    for (const [sym, bars] of Object.entries(data.bars ?? {})) {
      result[sym] = (bars as any[]).map((b): MarketDataCandle => ({
        timestamp: b.t,
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v,
        timeframe,
      }));
    }
    return result;
  }

  // ----------------------------------------------------------
  // Latest trade price
  // ----------------------------------------------------------
  async getLatestTrade(symbol: string): Promise<number> {
    try {
      const { data } = await axios.get(
        `${DATA_BASE}/v2/stocks/${symbol}/trades/latest`,
        { headers: this.headers, timeout: 5000 }
      );
      return data.trade?.p ?? 0;
    } catch {
      return 0;
    }
  }
}
