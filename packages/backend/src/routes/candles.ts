// ============================================================
// GET /api/candles?symbol=TSLA&timeframe=5Min&limit=100
// Proxy to Alpaca Data API. Returns demo data when no keys set.
// ============================================================
import { Router, Request, Response } from "express";
import axios from "axios";

const router = Router();

function hasAlpacaKeys(): boolean {
  const key = process.env.ALPACA_API_KEY ?? "";
  return key.length > 0 && !key.startsWith("PK_REPLACE") && !key.startsWith("PKXX");
}

/** Generate realistic-looking fake candles for demo mode */
function generateDemoCandles(symbol: string, count = 100) {
  const seeds: Record<string, number> = { TSLA: 175, NVDA: 420, SPY: 450 };
  let price = seeds[symbol] ?? 100;
  const now = Date.now();
  const bars = [];
  for (let i = count; i >= 0; i--) {
    const t = new Date(now - i * 5 * 60 * 1000).toISOString();
    const change = (Math.random() - 0.48) * price * 0.008;
    const open = price;
    const close = Math.max(1, price + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.003);
    const low = Math.min(open, close) * (1 - Math.random() * 0.003);
    bars.push({
      time: t,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(50000 + Math.random() * 200000),
    });
    price = close;
  }
  return bars;
}

router.get("/candles", async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string)?.toUpperCase();
  const timeframe = (req.query.timeframe as string) ?? "5Min";
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

  if (!symbol) {
    return res.status(400).json({ success: false, error: "symbol required" });
  }

  if (!hasAlpacaKeys()) {
    return res.json({ success: true, data: generateDemoCandles(symbol, limit), demo: true });
  }

  try {
    const { data } = await axios.get(
      `https://data.alpaca.markets/v2/stocks/${symbol}/bars`,
      {
        params: { timeframe, limit, adjustment: "raw", feed: "iex" },
        headers: {
          "APCA-API-KEY-ID": process.env.ALPACA_API_KEY ?? "",
          "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET ?? "",
        },
        timeout: 10000,
      }
    );
    const candles = (data.bars ?? []).map((b: any) => ({
      time: b.t,
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v,
    }));
    res.json({ success: true, data: candles });
  } catch (err: any) {
    // Fall back to demo data on any error
    res.json({ success: true, data: generateDemoCandles(symbol, limit), demo: true, error: err.message });
  }
});

// ── Weekly Summary ────────────────────────────────────────────
// GET /api/weekly-summary?symbol=TSLA
// Returns daily OHLCV for past 7 trading days + analysis stats
router.get("/weekly-summary", async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string)?.toUpperCase();
  if (!symbol) return res.status(400).json({ success: false, error: "symbol required" });

  // Generate demo weekly data
  function generateWeeklyDemo(sym: string) {
    const seeds: Record<string, number> = { TSLA: 175, NVDA: 420, SPY: 450 };
    let price = (seeds[sym] ?? 100) * 0.93; // start ~7% lower a week ago
    const days: any[] = [];
    const now = new Date();
    let d = new Date(now);
    d.setDate(d.getDate() - 7);
    while (days.length < 7) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) {
        const change = (Math.random() - 0.45) * price * 0.025;
        const open = price * (1 + (Math.random() - 0.5) * 0.005);
        const close = Math.max(1, price + change);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        days.push({
          date: d.toISOString().slice(0, 10),
          open: parseFloat(open.toFixed(2)),
          high: parseFloat(high.toFixed(2)),
          low: parseFloat(low.toFixed(2)),
          close: parseFloat(close.toFixed(2)),
          volume: Math.floor(10000000 + Math.random() * 40000000),
          change: parseFloat((close - open).toFixed(2)),
          changePct: parseFloat(((close - open) / open * 100).toFixed(2)),
        });
        price = close;
      }
      d.setDate(d.getDate() + 1);
    }
    return days;
  }

  function analyzeWeek(days: any[], symbol: string) {
    if (!days.length) return null;
    const first = days[0];
    const last = days[days.length - 1];
    const weekChange = last.close - first.open;
    const weekChangePct = (weekChange / first.open) * 100;
    const highest = days.reduce((m, d) => d.high > m.high ? d : m, days[0]);
    const lowest = days.reduce((m, d) => d.low < m.low ? d : m, days[0]);
    const avgVolume = Math.round(days.reduce((s, d) => s + d.volume, 0) / days.length);
    const greenDays = days.filter(d => d.close > d.open).length;
    const redDays = days.length - greenDays;
    const volatility = parseFloat((days.reduce((s, d) => s + Math.abs(d.changePct), 0) / days.length).toFixed(2));

    // Simple trend analysis
    let trend = "NEUTRAL";
    let trendDetail = "";
    if (weekChangePct > 3) { trend = "STRONG BULLISH"; trendDetail = "Significant weekly gain with upward momentum."; }
    else if (weekChangePct > 0.5) { trend = "BULLISH"; trendDetail = "Moderate gains this week, buyers in control."; }
    else if (weekChangePct < -3) { trend = "STRONG BEARISH"; trendDetail = "Heavy selling pressure throughout the week."; }
    else if (weekChangePct < -0.5) { trend = "BEARISH"; trendDetail = "Week ended lower, sellers dominant."; }
    else { trend = "NEUTRAL"; trendDetail = "Sideways price action, no clear direction."; }

    // Volume analysis
    let volumeNote = "";
    const lastVol = last.volume;
    if (lastVol > avgVolume * 1.5) volumeNote = "High volume on last day — strong conviction.";
    else if (lastVol < avgVolume * 0.6) volumeNote = "Low volume on last day — weak conviction.";
    else volumeNote = "Volume near average — normal activity.";

    // Key events (biggest move days)
    const biggestMover = days.reduce((m, d) => Math.abs(d.changePct) > Math.abs(m.changePct) ? d : m, days[0]);

    return {
      symbol,
      weekChange: parseFloat(weekChange.toFixed(2)),
      weekChangePct: parseFloat(weekChangePct.toFixed(2)),
      weekOpen: first.open,
      weekClose: last.close,
      weekHigh: parseFloat(highest.high.toFixed(2)),
      weekLow: parseFloat(lowest.low.toFixed(2)),
      weekHighDate: highest.date,
      weekLowDate: lowest.date,
      avgVolume,
      greenDays,
      redDays,
      volatility,
      trend,
      trendDetail,
      volumeNote,
      biggestMoveDate: biggestMover.date,
      biggestMovePct: biggestMover.changePct,
    };
  }

  if (!hasAlpacaKeys()) {
    const days = generateWeeklyDemo(symbol);
    return res.json({ success: true, data: { days, analysis: analyzeWeek(days, symbol) }, demo: true });
  }

  try {
    const start = new Date();
    start.setDate(start.getDate() - 10); // fetch 10 days to ensure 7 trading days
    const { data } = await axios.get(
      `https://data.alpaca.markets/v2/stocks/${symbol}/bars`,
      {
        params: {
          timeframe: "1Day",
          start: start.toISOString().slice(0, 10),
          limit: 10,
          adjustment: "raw",
          feed: "iex",
        },
        headers: {
          "APCA-API-KEY-ID": process.env.ALPACA_API_KEY ?? "",
          "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET ?? "",
        },
        timeout: 10000,
      }
    );
    const days = (data.bars ?? []).slice(-7).map((b: any) => ({
      date: b.t.slice(0, 10),
      open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v,
      change: parseFloat((b.c - b.o).toFixed(2)),
      changePct: parseFloat(((b.c - b.o) / b.o * 100).toFixed(2)),
    }));
    res.json({ success: true, data: { days, analysis: analyzeWeek(days, symbol) } });
  } catch (err: any) {
    const days = generateWeeklyDemo(symbol);
    res.json({ success: true, data: { days, analysis: analyzeWeek(days, symbol) }, demo: true, error: err.message });
  }
});

export default router;
