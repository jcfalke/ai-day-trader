// ============================================================
// GET /api/positions      — open positions from broker
// GET /api/pnl            — full PnL summary
// GET /api/config-status  — which env keys are configured
// GET /api/watchlist      — current watchlist
// POST /api/watchlist     — add ticker { symbol }
// DELETE /api/watchlist/:symbol — remove ticker
// Returns graceful empty data when no API keys are set.
// ============================================================
import { Router, Request, Response } from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { ApiResponse, PnlSummary, OpenPosition } from "@ai-trader/shared";

// ── Watchlist persistence ─────────────────────────────────────
const WATCHLIST_FILE = path.resolve(__dirname, "../../../data/watchlist.json");

function loadWatchlist(): string[] {
  try {
    if (fs.existsSync(WATCHLIST_FILE)) {
      return JSON.parse(fs.readFileSync(WATCHLIST_FILE, "utf8"));
    }
  } catch {}
  // fallback to env
  return (process.env.WATCHLIST ?? "TSLA,NVDA,SPY").split(",").map(s => s.trim().toUpperCase());
}

function saveWatchlist(list: string[]): void {
  try {
    fs.mkdirSync(path.dirname(WATCHLIST_FILE), { recursive: true });
    fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(list));
  } catch {}
}

const router = Router();

function hasAlpacaKeys(): boolean {
  const key = process.env.ALPACA_API_KEY ?? "";
  return key.length > 10 && !key.startsWith("PKXX");
}

const ALPACA_BASE =
  process.env.ALPACA_PAPER_MODE !== "false"
    ? "https://paper-api.alpaca.markets"
    : "https://api.alpaca.markets";

const alpacaHeaders = () => ({
  "APCA-API-KEY-ID": process.env.ALPACA_API_KEY ?? "",
  "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET ?? "",
});

const emptyPnl = (): PnlSummary => ({
  totalEquity: 0, cash: 0, portfolioValue: 0,
  dayPnl: 0, dayPnlPct: 0, totalUnrealizedPnl: 0,
  totalRealizedPnlToday: 0, openPositions: [],
  asOf: new Date().toISOString(),
});

// GET /api/positions
router.get("/positions", async (_req: Request, res: Response) => {
  if (!hasAlpacaKeys()) return res.json({ success: true, data: [], noKeys: true });
  try {
    const { data } = await axios.get(`${ALPACA_BASE}/v2/positions`, {
      headers: alpacaHeaders(), timeout: 10000,
    });
    const positions: OpenPosition[] = (data as any[]).map((p) => ({
      symbol: p.symbol, qty: parseFloat(p.qty), side: p.side,
      avgEntryPrice: parseFloat(p.avg_entry_price),
      currentPrice: parseFloat(p.current_price),
      marketValue: parseFloat(p.market_value),
      unrealizedPnl: parseFloat(p.unrealized_pl),
      unrealizedPnlPct: parseFloat(p.unrealized_plpc) * 100,
      costBasis: parseFloat(p.cost_basis),
    }));
    res.json({ success: true, data: positions } as ApiResponse<OpenPosition[]>);
  } catch {
    res.json({ success: true, data: [] });
  }
});

// GET /api/pnl
router.get("/pnl", async (_req: Request, res: Response) => {
  if (!hasAlpacaKeys()) return res.json({ success: true, data: emptyPnl(), noKeys: true });
  try {
    const [accountRes, posRes] = await Promise.all([
      axios.get(`${ALPACA_BASE}/v2/account`, { headers: alpacaHeaders(), timeout: 10000 }),
      axios.get(`${ALPACA_BASE}/v2/positions`, { headers: alpacaHeaders(), timeout: 10000 }),
    ]);
    const account = accountRes.data;
    const positions: OpenPosition[] = (posRes.data as any[]).map((p) => ({
      symbol: p.symbol, qty: parseFloat(p.qty), side: p.side,
      avgEntryPrice: parseFloat(p.avg_entry_price),
      currentPrice: parseFloat(p.current_price),
      marketValue: parseFloat(p.market_value),
      unrealizedPnl: parseFloat(p.unrealized_pl),
      unrealizedPnlPct: parseFloat(p.unrealized_plpc) * 100,
      costBasis: parseFloat(p.cost_basis),
    }));
    const dayPnl = parseFloat(account.equity) - parseFloat(account.last_equity);
    const pnl: PnlSummary = {
      totalEquity: parseFloat(account.equity), cash: parseFloat(account.cash),
      portfolioValue: parseFloat(account.portfolio_value), dayPnl,
      dayPnlPct: (dayPnl / parseFloat(account.last_equity)) * 100,
      totalUnrealizedPnl: positions.reduce((s, p) => s + p.unrealizedPnl, 0),
      totalRealizedPnlToday: dayPnl, openPositions: positions,
      asOf: new Date().toISOString(),
    };
    res.json({ success: true, data: pnl } as ApiResponse<PnlSummary>);
  } catch {
    res.json({ success: true, data: emptyPnl() });
  }
});

// GET /api/config-status
router.get("/config-status", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      hasAlpacaKeys: hasAlpacaKeys(),
      hasLlmKey:
        (process.env.ANTHROPIC_API_KEY ?? "").startsWith("sk-ant") ||
        (process.env.OPENAI_API_KEY ?? "").startsWith("sk-"),
      paperMode: process.env.PAPER_MODE !== "false",
      watchlist: loadWatchlist(),
    },
  });
});

// GET /api/watchlist
router.get("/watchlist", (_req: Request, res: Response) => {
  res.json({ success: true, data: loadWatchlist() });
});

// POST /api/watchlist  { symbol: "AAPL" }
router.post("/watchlist", (req: Request, res: Response) => {
  const symbol = (req.body?.symbol ?? "").toString().trim().toUpperCase();
  if (!symbol || !/^[A-Z]{1,5}$/.test(symbol)) {
    return res.status(400).json({ success: false, error: "Invalid symbol" });
  }
  const list = loadWatchlist();
  if (!list.includes(symbol)) {
    list.push(symbol);
    saveWatchlist(list);
  }
  res.json({ success: true, data: list });
});

// DELETE /api/watchlist/:symbol
router.delete("/watchlist/:symbol", (req: Request, res: Response) => {
  const symbol = (req.params.symbol ?? "").toUpperCase();
  const list = loadWatchlist().filter(s => s !== symbol);
  saveWatchlist(list);
  res.json({ success: true, data: list });
});

// ── Manual Order ──────────────────────────────────────────────
// POST /api/order
// Body: { symbol, side, qty?, notional?, type }
// side: "buy" | "sell"
// qty: number of shares   OR   notional: dollar amount
// type: "market" (default) | "limit" (requires limitPrice)
router.post("/order", async (req: Request, res: Response) => {
  const paperMode = process.env.PAPER_MODE !== "false";
  if (!hasAlpacaKeys()) {
    // Demo mode — simulate order confirmation
    const { symbol, side, qty, notional } = req.body;
    return res.json({
      success: true,
      demo: true,
      data: {
        id: `demo-${Date.now()}`,
        symbol: (symbol ?? "").toUpperCase(),
        side,
        qty: qty ?? null,
        notional: notional ?? null,
        status: "accepted (demo)",
        paperMode,
      },
    });
  }

  const { symbol, side, qty, notional, type = "market", limitPrice } = req.body;

  // Validation
  if (!symbol || !side) {
    return res.status(400).json({ success: false, error: "symbol and side are required" });
  }
  if (!["buy", "sell"].includes(side)) {
    return res.status(400).json({ success: false, error: "side must be 'buy' or 'sell'" });
  }
  if (!qty && !notional) {
    return res.status(400).json({ success: false, error: "provide qty (shares) or notional (dollars)" });
  }
  if (qty && Number(qty) <= 0) {
    return res.status(400).json({ success: false, error: "qty must be positive" });
  }
  if (notional && Number(notional) < 1) {
    return res.status(400).json({ success: false, error: "notional must be at least $1" });
  }

  const body: Record<string, any> = {
    symbol: symbol.toUpperCase(),
    side,
    type,
    time_in_force: type === "market" ? "day" : "gtc",
  };
  if (qty) body.qty = String(Number(qty));
  else body.notional = String(Number(notional));
  if (type === "limit" && limitPrice) body.limit_price = String(Number(limitPrice));

  try {
    const { data } = await axios.post(`${ALPACA_BASE}/v2/orders`, body, {
      headers: { ...alpacaHeaders(), "Content-Type": "application/json" },
      timeout: 10000,
    });
    res.json({
      success: true,
      data: {
        id: data.id,
        symbol: data.symbol,
        side: data.side,
        qty: data.qty,
        notional: data.notional,
        type: data.type,
        status: data.status,
        paperMode,
      },
    });
  } catch (err: any) {
    const alpacaErr = err.response?.data?.message ?? err.message;
    res.status(400).json({ success: false, error: alpacaErr });
  }
});

export default router;
