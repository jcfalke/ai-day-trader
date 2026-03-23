import { useEffect, useRef, useState } from "react";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

// ─── tiny fetcher ────────────────────────────────────────────
async function get(path: string) {
  try {
    const r = await fetch(`${API}${path}`);
    const j = await r.json();
    return j.data ?? j;
  } catch {
    return null;
  }
}

// ─── types ───────────────────────────────────────────────────
interface Candle { time: string; open: number; high: number; low: number; close: number; volume: number; }
interface Position { symbol: string; qty: number; side: string; avgEntryPrice: number; currentPrice: number; unrealizedPnl: number; unrealizedPnlPct: number; }
interface Pnl { totalEquity: number; cash: number; dayPnl: number; dayPnlPct: number; totalUnrealizedPnl: number; }
interface Decision { id: number; symbol: string; action: string; confidence: number; positionSizePct: number; stopLossPct: number; takeProfitPct: number; reason: string; riskCheckPassed: boolean; createdAt: string; }
interface ConfigStatus { hasAlpacaKeys: boolean; hasLlmKey: boolean; paperMode: boolean; watchlist: string[]; }
interface DayBar { date: string; open: number; high: number; low: number; close: number; volume: number; change: number; changePct: number; }
interface WeekAnalysis { symbol: string; weekChange: number; weekChangePct: number; weekOpen: number; weekClose: number; weekHigh: number; weekLow: number; weekHighDate: string; weekLowDate: string; avgVolume: number; greenDays: number; redDays: number; volatility: number; trend: string; trendDetail: string; volumeNote: string; biggestMoveDate: string; biggestMovePct: number; }
interface WeeklySummary { days: DayBar[]; analysis: WeekAnalysis; }

const DEFAULT_TICKERS = ["TSLA", "NVDA", "SPY"];

// ─── helpers ─────────────────────────────────────────────────
const $ = (n: number, d = 2) => n?.toFixed(d) ?? "—";
const $$ = (n: number) => `${n >= 0 ? "+" : ""}$${Math.abs(n).toFixed(2)}`;
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n?.toFixed(2) ?? "0"}%`;
const col = (n: number) => n > 0 ? "text-green-400" : n < 0 ? "text-red-400" : "text-gray-400";

// ─── Candle Chart (lightweight-charts) ───────────────────────
function Chart({ candles, decisions }: { candles: Candle[]; decisions: Decision[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    if (!ref.current || typeof window === "undefined") return;
    import("lightweight-charts").then(({ createChart, ColorType }) => {
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
      const chart = createChart(ref.current!, {
        layout: { background: { type: ColorType.Solid, color: "#030712" }, textColor: "#6b7280" },
        grid: { vertLines: { color: "#111827" }, horzLines: { color: "#111827" } },
        rightPriceScale: { borderColor: "#1f2937" },
        timeScale: { borderColor: "#1f2937", timeVisible: true },
        width: ref.current!.clientWidth,
        height: 280,
      });
      const series = chart.addCandlestickSeries({
        upColor: "#22c55e", downColor: "#ef4444",
        borderVisible: false, wickUpColor: "#22c55e", wickDownColor: "#ef4444",
      });
      chartRef.current = chart;
      seriesRef.current = series;

      const ro = new ResizeObserver(([e]) => chart.resize(e.contentRect.width, 280));
      ro.observe(ref.current!);
      return () => { ro.disconnect(); chart.remove(); };
    });
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !candles.length) return;
    const data = candles.map(c => ({
      time: (new Date(c.time).getTime() / 1000) as any,
      open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    seriesRef.current.setData(data);
    if (decisions.length) {
      const markers = decisions
        .filter(d => d.action !== "HOLD")
        .map(d => ({
          time: (new Date(d.createdAt).getTime() / 1000) as any,
          position: d.action === "BUY" ? "belowBar" : "aboveBar",
          color: d.action === "BUY" ? "#22c55e" : "#ef4444",
          shape: d.action === "BUY" ? "arrowUp" : "arrowDown",
          text: `${d.action} ${(d.confidence * 100).toFixed(0)}%`,
        }));
      seriesRef.current.setMarkers(markers);
    }
    chartRef.current?.timeScale().fitContent();
  }, [candles, decisions]);

  return <div ref={ref} className="w-full" />;
}

// ─── Setup Banner ─────────────────────────────────────────────
function SetupBanner({ cfg }: { cfg: ConfigStatus }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const envFile = `/Users/JCanizales/Carol Day Trayding tool/Stock cheaker/.env`;
  return (
    <div className="bg-yellow-950 border border-yellow-700 rounded-lg p-4 text-sm">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-yellow-400 mb-2">⚙️  Setup required — add your API keys to <code className="bg-yellow-900 px-1 rounded">.env</code></p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono mt-2">
            <div className="bg-yellow-900/50 rounded p-3 space-y-1">
              <p className="text-yellow-300 font-bold mb-1">1. Alpaca (free paper trading)</p>
              <p className={cfg.hasAlpacaKeys ? "text-green-400" : "text-red-400"}>{cfg.hasAlpacaKeys ? "✅" : "❌"} ALPACA_API_KEY=PK...</p>
              <p className={cfg.hasAlpacaKeys ? "text-green-400" : "text-red-400"}>{cfg.hasAlpacaKeys ? "✅" : "❌"} ALPACA_API_SECRET=...</p>
              <p className="text-gray-500 mt-1">→ alpaca.markets → Paper Trading → API Keys</p>
            </div>
            <div className="bg-yellow-900/50 rounded p-3 space-y-1">
              <p className="text-yellow-300 font-bold mb-1">2. LLM (pick one)</p>
              <p className={cfg.hasLlmKey ? "text-green-400" : "text-red-400"}>{cfg.hasLlmKey ? "✅" : "❌"} ANTHROPIC_API_KEY=sk-ant-...</p>
              <p className="text-gray-500">or OPENAI_API_KEY=sk-...</p>
              <p className="text-gray-500 mt-1">→ console.anthropic.com</p>
            </div>
          </div>
          <p className="text-yellow-600 mt-3 text-xs">File: <span className="text-yellow-400">{envFile}</span> → edit then restart the backend</p>
        </div>
        <button onClick={() => setOpen(false)} className="text-yellow-700 hover:text-yellow-400 ml-4 text-lg leading-none">✕</button>
      </div>
      {!cfg.hasAlpacaKeys && (
        <p className="mt-2 text-xs text-yellow-600">📊 Chart is showing <span className="text-yellow-400">demo data</span> until Alpaca keys are added.</p>
      )}
    </div>
  );
}

// ─── Buy / Sell Panel ─────────────────────────────────────────
function OrderPanel({ symbol, currentPrice, cash, paperMode, demo }: {
  symbol: string; currentPrice?: number; cash?: number; paperMode: boolean; demo: boolean;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [mode, setMode] = useState<"shares" | "dollars">("dollars");
  const [qty, setQty] = useState("");
  const [notional, setNotional] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const numQty = parseFloat(qty);
  const numNotional = parseFloat(notional);
  const estimatedCost = mode === "shares" && currentPrice && numQty > 0
    ? numQty * currentPrice
    : mode === "dollars" && numNotional > 0 ? numNotional : 0;
  const estimatedShares = mode === "dollars" && currentPrice && numNotional > 0
    ? (numNotional / currentPrice).toFixed(4)
    : mode === "shares" && numQty > 0 ? numQty.toFixed(4) : "—";

  // Reset status on symbol change
  useEffect(() => { setStatus(null); setConfirmed(false); }, [symbol]);

  async function submitOrder() {
    setLoading(true);
    setStatus(null);
    try {
      const body: Record<string, any> = { symbol, side, type: "market" };
      if (mode === "shares") body.qty = numQty;
      else body.notional = numNotional;

      const r = await fetch(`${API}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.success) {
        setStatus({ ok: true, msg: j.demo
          ? `[Demo] ${side.toUpperCase()} order accepted for ${j.data.symbol}`
          : `Order submitted! ID: ${j.data.id} — Status: ${j.data.status}` });
        setQty(""); setNotional(""); setConfirmed(false);
      } else {
        setStatus({ ok: false, msg: j.error ?? "Order failed" });
      }
    } catch {
      setStatus({ ok: false, msg: "Network error — could not reach backend" });
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !loading && (mode === "shares" ? numQty > 0 : numNotional >= 1);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
          Place Order — {symbol}
        </span>
        <div className="flex items-center gap-2">
          {demo && <span className="text-xs bg-yellow-900 text-yellow-400 px-2 py-0.5 rounded">Demo</span>}
          {paperMode && <span className="text-xs bg-blue-900 text-blue-400 px-2 py-0.5 rounded">Paper Trading</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── Left: inputs ── */}
        <div className="space-y-3">
          {/* Side */}
          <div className="flex rounded overflow-hidden border border-gray-700">
            <button onClick={() => { setSide("buy"); setStatus(null); setConfirmed(false); }}
              className={`flex-1 py-2 text-sm font-bold transition-colors ${side === "buy" ? "bg-green-700 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
              Buy
            </button>
            <button onClick={() => { setSide("sell"); setStatus(null); setConfirmed(false); }}
              className={`flex-1 py-2 text-sm font-bold transition-colors ${side === "sell" ? "bg-red-700 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
              Sell
            </button>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded overflow-hidden border border-gray-700 text-xs">
            <button onClick={() => { setMode("dollars"); setQty(""); setStatus(null); setConfirmed(false); }}
              className={`flex-1 py-1.5 font-medium transition-colors ${mode === "dollars" ? "bg-gray-700 text-white" : "bg-gray-800 text-gray-500 hover:bg-gray-750"}`}>
              $ Dollars
            </button>
            <button onClick={() => { setMode("shares"); setNotional(""); setStatus(null); setConfirmed(false); }}
              className={`flex-1 py-1.5 font-medium transition-colors ${mode === "shares" ? "bg-gray-700 text-white" : "bg-gray-800 text-gray-500 hover:bg-gray-750"}`}>
              # Shares
            </button>
          </div>

          {/* Amount input */}
          {mode === "dollars" ? (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number" min="1" step="1" placeholder="Amount in dollars"
                value={notional}
                onChange={e => { setNotional(e.target.value); setStatus(null); setConfirmed(false); }}
                className="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500 tabular-nums"
              />
            </div>
          ) : (
            <div className="relative">
              <input
                type="number" min="0.001" step="0.001" placeholder="Number of shares"
                value={qty}
                onChange={e => { setQty(e.target.value); setStatus(null); setConfirmed(false); }}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500 tabular-nums"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">shares</span>
            </div>
          )}

          {/* Quick dollar buttons */}
          {mode === "dollars" && (
            <div className="flex gap-1">
              {[100, 250, 500, 1000].map(v => (
                <button key={v} onClick={() => { setNotional(String(v)); setStatus(null); setConfirmed(false); }}
                  className="flex-1 py-1 text-xs rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700">
                  ${v}
                </button>
              ))}
            </div>
          )}

          {/* Confirm + submit */}
          {!confirmed ? (
            <button
              disabled={!canSubmit}
              onClick={() => setConfirmed(true)}
              className={`w-full py-2.5 rounded font-bold text-sm transition-colors ${canSubmit
                ? side === "buy" ? "bg-green-700 hover:bg-green-600 text-white" : "bg-red-700 hover:bg-red-600 text-white"
                : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}>
              {side === "buy" ? "Review Buy Order" : "Review Sell Order"}
            </button>
          ) : (
            <div className="space-y-2">
              <div className={`rounded p-2 text-xs text-center font-medium border ${side === "buy" ? "border-green-700 bg-green-900/30 text-green-300" : "border-red-700 bg-red-900/30 text-red-300"}`}>
                Confirm {side.toUpperCase()} {symbol} — {mode === "dollars" ? `$${numNotional.toFixed(2)}` : `${numQty} shares`}
                <br /><span className="text-gray-400">~{estimatedShares} shares @ ${currentPrice?.toFixed(2) ?? "market"}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmed(false)} className="flex-1 py-2 rounded text-xs font-bold bg-gray-800 text-gray-400 hover:bg-gray-700">Cancel</button>
                <button onClick={submitOrder} disabled={loading}
                  className={`flex-1 py-2 rounded text-sm font-bold ${side === "buy" ? "bg-green-600 hover:bg-green-500" : "bg-red-600 hover:bg-red-500"} text-white disabled:opacity-50`}>
                  {loading ? "Submitting…" : `Confirm ${side.toUpperCase()}`}
                </button>
              </div>
            </div>
          )}

          {/* Status message */}
          {status && (
            <div className={`text-xs rounded p-2 ${status.ok ? "bg-green-900/40 text-green-300 border border-green-800" : "bg-red-900/40 text-red-300 border border-red-800"}`}>
              {status.ok ? "✓ " : "✗ "}{status.msg}
            </div>
          )}
        </div>

        {/* ── Right: order summary ── */}
        <div className="bg-gray-800/40 rounded-lg p-3 space-y-2 text-xs">
          <div className="text-gray-500 font-semibold uppercase tracking-wide mb-2">Order Summary</div>
          {[
            { label: "Symbol", value: symbol },
            { label: "Action", value: side.toUpperCase(), color: side === "buy" ? "text-green-400" : "text-red-400" },
            { label: "Type", value: "Market Order" },
            { label: "Est. Price", value: currentPrice ? `$${currentPrice.toFixed(2)}` : "—" },
            { label: "Est. Shares", value: estimatedShares },
            { label: "Est. Total", value: estimatedCost > 0 ? `$${estimatedCost.toFixed(2)}` : "—", color: "text-white font-bold" },
            { label: "Cash Available", value: cash ? `$${cash.toFixed(2)}` : "—", color: side === "buy" && cash && estimatedCost > cash ? "text-red-400" : "text-gray-300" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-gray-500">{label}</span>
              <span className={color ?? "text-gray-300 tabular-nums"}>{value}</span>
            </div>
          ))}
          {side === "buy" && cash !== undefined && estimatedCost > 0 && estimatedCost > cash && (
            <div className="text-red-400 text-xs mt-2 border-t border-red-900 pt-2">
              Insufficient cash for this order.
            </div>
          )}
          <div className="border-t border-gray-700 pt-2 text-gray-600">
            Market orders fill immediately during trading hours (9:30–4:00 ET).
            {paperMode && " Paper trading — no real money."}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Weekly Analysis Panel ────────────────────────────────────
function WeeklyPanel({ symbol, demo }: { symbol: string; demo?: boolean }) {
  const [data, setData] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    get(`/api/weekly-summary?symbol=${symbol}`).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [symbol]);

  const trendColor = (t: string) => {
    if (t.includes("STRONG BULLISH")) return "text-green-300 bg-green-900/40";
    if (t.includes("BULLISH")) return "text-green-400 bg-green-900/20";
    if (t.includes("STRONG BEARISH")) return "text-red-300 bg-red-900/40";
    if (t.includes("BEARISH")) return "text-red-400 bg-red-900/20";
    return "text-yellow-400 bg-yellow-900/20";
  };

  const fmtVol = (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : `${(v/1_000).toFixed(0)}K`;
  const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
          {symbol} — Past Week Analysis
        </span>
        {demo && <span className="text-xs bg-yellow-900 text-yellow-400 px-2 py-0.5 rounded">Demo data</span>}
      </div>

      {loading && <div className="text-gray-600 text-xs py-4 text-center">Loading weekly data…</div>}

      {!loading && data && (
        <div className="space-y-4">
          {/* ── Trend badge + key stats row ── */}
          <div className="flex flex-wrap gap-3 items-start">
            <div className={`px-3 py-2 rounded-lg text-xs font-bold ${trendColor(data.analysis.trend)}`}>
              {data.analysis.trend}
            </div>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: "Week Change", value: `${data.analysis.weekChangePct >= 0 ? "+" : ""}${data.analysis.weekChangePct.toFixed(2)}%`, sub: `${data.analysis.weekChangePct >= 0 ? "+" : ""}$${data.analysis.weekChange.toFixed(2)}`, color: data.analysis.weekChangePct >= 0 ? "text-green-400" : "text-red-400" },
                { label: "Week Range", value: `$${data.analysis.weekLow.toFixed(2)} – $${data.analysis.weekHigh.toFixed(2)}`, sub: `L: ${fmtDate(data.analysis.weekLowDate)} / H: ${fmtDate(data.analysis.weekHighDate)}`, color: "text-white" },
                { label: "Avg Volume", value: fmtVol(data.analysis.avgVolume), sub: data.analysis.volumeNote.split("—")[0].trim(), color: "text-blue-400" },
                { label: "Days Up / Down", value: `${data.analysis.greenDays}🟢 / ${data.analysis.redDays}🔴`, sub: `Volatility: ${data.analysis.volatility}% avg`, color: "text-gray-300" },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="bg-gray-800/60 rounded p-2">
                  <div className="text-gray-500 text-xs mb-0.5">{label}</div>
                  <div className={`font-bold text-sm tabular-nums ${color}`}>{value}</div>
                  <div className="text-gray-600 text-xs truncate" title={sub}>{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Analysis text ── */}
          <div className="bg-gray-800/40 rounded p-3 text-xs text-gray-400 space-y-1">
            <p>📈 <span className="text-gray-300">{data.analysis.trendDetail}</span></p>
            <p>📊 <span className="text-gray-300">{data.analysis.volumeNote}</span></p>
            <p>⚡ Biggest move: <span className={`font-bold ${data.analysis.biggestMovePct >= 0 ? "text-green-400" : "text-red-400"}`}>{data.analysis.biggestMovePct >= 0 ? "+" : ""}{data.analysis.biggestMovePct.toFixed(2)}%</span> on {fmtDate(data.analysis.biggestMoveDate)}</p>
          </div>

          {/* ── Daily table ── */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  {["Date", "Open", "High", "Low", "Close", "Change", "%", "Volume"].map(h => (
                    <th key={h} className="text-left py-1.5 px-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.days.map(d => (
                  <tr key={d.date} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                    <td className="py-1.5 px-2 text-gray-400 whitespace-nowrap">{fmtDate(d.date)}</td>
                    <td className="py-1.5 px-2 tabular-nums">${d.open.toFixed(2)}</td>
                    <td className="py-1.5 px-2 tabular-nums text-green-400">${d.high.toFixed(2)}</td>
                    <td className="py-1.5 px-2 tabular-nums text-red-400">${d.low.toFixed(2)}</td>
                    <td className="py-1.5 px-2 tabular-nums font-bold text-white">${d.close.toFixed(2)}</td>
                    <td className={`py-1.5 px-2 tabular-nums font-medium ${d.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {d.change >= 0 ? "+" : ""}{d.change.toFixed(2)}
                    </td>
                    <td className={`py-1.5 px-2 tabular-nums ${d.changePct >= 0 ? "text-green-400" : "text-red-400"}`}>
                      <div className="flex items-center gap-1">
                        <span>{d.changePct >= 0 ? "▲" : "▼"}</span>
                        <span>{Math.abs(d.changePct).toFixed(2)}%</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 tabular-nums text-gray-400">{fmtVol(d.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────
export default function Dashboard() {
  const [ticker, setTicker] = useState("TSLA");
  const [tab, setTab] = useState<"decisions" | "trades">("decisions");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [cfg, setCfg] = useState<ConfigStatus | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_TICKERS);
  const [newTicker, setNewTicker] = useState("");
  const [addError, setAddError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  async function refresh(sym = ticker) {
    const [c, p, pos, d, t, cf, wl] = await Promise.all([
      get(`/api/candles?symbol=${sym}&timeframe=5Min&limit=100`),
      get("/api/pnl"),
      get("/api/positions"),
      get("/api/trade-decisions"),
      get("/api/trades"),
      get("/api/config-status"),
      get("/api/watchlist"),
    ]);
    if (c) setCandles(c);
    if (p) setPnl(p);
    if (pos) setPositions(pos);
    if (d) setDecisions(d);
    if (t) setTrades(t);
    if (cf) setCfg(cf);
    if (wl && Array.isArray(wl)) setWatchlist(wl);
    setLastUpdate(new Date().toLocaleTimeString());
  }

  async function addTicker() {
    const sym = newTicker.trim().toUpperCase();
    if (!sym || !/^[A-Z]{1,5}$/.test(sym)) { setAddError("Enter a valid 1–5 letter symbol"); return; }
    if (watchlist.includes(sym)) { setAddError(`${sym} already in watchlist`); return; }
    setAddError("");
    try {
      const r = await fetch(`${API}/api/watchlist`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: sym }),
      });
      const j = await r.json();
      if (j.success) { setWatchlist(j.data); setTicker(sym); setNewTicker(""); setShowAdd(false); }
      else setAddError(j.error ?? "Failed to add");
    } catch { setAddError("Network error"); }
  }

  async function removeTicker(sym: string) {
    try {
      const r = await fetch(`${API}/api/watchlist/${sym}`, { method: "DELETE" });
      const j = await r.json();
      if (j.success) {
        setWatchlist(j.data);
        if (ticker === sym) setTicker(j.data[0] ?? "TSLA");
      }
    } catch {}
  }

  useEffect(() => { refresh(); }, []);
  useEffect(() => { refresh(ticker); }, [ticker]);
  useEffect(() => {
    const id = setInterval(() => refresh(ticker), 30000);
    return () => clearInterval(id);
  }, [ticker]);

  const tickerDecisions = decisions.filter(d => d.symbol === ticker);

  return (
    <>
      <Head><title>AI Day Trader</title></Head>
      <div className="min-h-screen bg-gray-950 text-gray-100 font-mono text-sm">

        {/* ── Header ── */}
        <header className="sticky top-0 z-20 bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">AI</span>
            <span className="font-bold text-white">Day Trader</span>
            <span className="text-gray-600 text-xs">Paper Trading</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {watchlist.map(t => (
              <div key={t} className="flex items-center group">
                <button onClick={() => setTicker(t)}
                  className={`px-3 py-1 rounded-l text-xs font-bold transition-colors ${ticker === t ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                  {t}
                </button>
                <button onClick={() => removeTicker(t)}
                  title={`Remove ${t}`}
                  className={`px-1.5 py-1 rounded-r text-xs transition-colors border-l border-gray-700 ${ticker === t ? "bg-blue-700 text-blue-200 hover:bg-red-700 hover:text-white" : "bg-gray-800 text-gray-600 hover:bg-red-800 hover:text-red-300"}`}>
                  ✕
                </button>
              </div>
            ))}
            {/* Add ticker button */}
            {showAdd ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newTicker}
                  onChange={e => { setNewTicker(e.target.value.toUpperCase()); setAddError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") addTicker(); if (e.key === "Escape") { setShowAdd(false); setNewTicker(""); setAddError(""); } }}
                  placeholder="AAPL"
                  maxLength={5}
                  className="w-20 px-2 py-1 rounded text-xs font-bold bg-gray-700 text-white border border-blue-500 focus:outline-none uppercase"
                />
                <button onClick={addTicker} className="px-2 py-1 rounded text-xs font-bold bg-green-700 text-white hover:bg-green-600">✓</button>
                <button onClick={() => { setShowAdd(false); setNewTicker(""); setAddError(""); }} className="px-2 py-1 rounded text-xs font-bold bg-gray-700 text-gray-300 hover:bg-gray-600">✕</button>
                {addError && <span className="text-red-400 text-xs">{addError}</span>}
              </div>
            ) : (
              <button onClick={() => setShowAdd(true)}
                className="px-2 py-1 rounded text-xs font-bold bg-gray-800 text-gray-400 hover:bg-green-800 hover:text-green-300 border border-dashed border-gray-700 hover:border-green-600 transition-colors"
                title="Add stock to watchlist">
                + Add
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            {lastUpdate ? `Updated ${lastUpdate}` : "Loading…"}
            <button onClick={() => refresh(ticker)} className="ml-2 text-blue-500 hover:text-blue-400">↺ Refresh</button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">

          {/* ── Setup Banner ── */}
          {cfg && (!cfg.hasAlpacaKeys || !cfg.hasLlmKey) && <SetupBanner cfg={cfg} />}

          {/* ── PnL Row ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Equity", value: `$${$(pnl?.totalEquity ?? 0)}`, color: "text-white" },
              { label: "Cash", value: `$${$(pnl?.cash ?? 0)}`, color: "text-gray-300" },
              { label: "Day P&L", value: pnl ? $$(pnl.dayPnl) + ` (${pct(pnl.dayPnlPct)})` : "—", color: col(pnl?.dayPnl ?? 0) },
              { label: "Unrealized P&L", value: pnl ? $$(pnl.totalUnrealizedPnl) : "—", color: col(pnl?.totalUnrealizedPnl ?? 0) },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* ── Chart ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">{ticker} — 5-Min Chart</span>
              {cfg && !cfg.hasAlpacaKeys && (
                <span className="text-xs bg-yellow-900 text-yellow-400 px-2 py-0.5 rounded">Demo data</span>
              )}
            </div>
            {candles.length > 0
              ? <Chart candles={candles} decisions={tickerDecisions} />
              : <div className="h-64 flex items-center justify-center text-gray-700">Loading chart…</div>
            }
          </div>

          {/* ── Order Panel ── */}
          {(() => {
            const pos = positions.find(p => p.symbol === ticker);
            const lastPrice = pos?.currentPrice ?? (candles.length > 0 ? candles[candles.length - 1].close : undefined);
            return (
              <OrderPanel
                symbol={ticker}
                currentPrice={lastPrice}
                cash={pnl?.cash}
                paperMode={cfg?.paperMode ?? true}
                demo={cfg ? !cfg.hasAlpacaKeys : false}
              />
            );
          })()}

          {/* ── Weekly Analysis ── */}
          <WeeklyPanel symbol={ticker} demo={cfg ? !cfg.hasAlpacaKeys : false} />

          {/* ── Positions ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-3">Open Positions</div>
            {positions.length === 0
              ? <p className="text-gray-600 text-xs py-2">{cfg?.hasAlpacaKeys ? "No open positions" : "Add Alpaca keys to see live positions"}</p>
              : <table className="w-full text-xs">
                  <thead><tr className="text-gray-500 border-b border-gray-800">
                    {["Symbol","Side","Qty","Avg Entry","Current","Mkt Value","Unr. P&L","%"].map(h =>
                      <th key={h} className="text-left py-1.5 px-2 font-medium">{h}</th>)}
                  </tr></thead>
                  <tbody>{positions.map(p => (
                    <tr key={p.symbol} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                      <td className="py-1.5 px-2 font-bold text-white">{p.symbol}</td>
                      <td className={`py-1.5 px-2 ${p.side === "long" ? "text-green-400" : "text-red-400"}`}>{p.side.toUpperCase()}</td>
                      <td className="py-1.5 px-2">{p.qty}</td>
                      <td className="py-1.5 px-2">${$(p.avgEntryPrice)}</td>
                      <td className="py-1.5 px-2">${$(p.currentPrice)}</td>
                      <td className="py-1.5 px-2">${$((p as any).marketValue ?? 0)}</td>
                      <td className={`py-1.5 px-2 font-medium ${col(p.unrealizedPnl)}`}>{$$(p.unrealizedPnl)}</td>
                      <td className={`py-1.5 px-2 ${col(p.unrealizedPnlPct)}`}>{pct(p.unrealizedPnlPct)}</td>
                    </tr>
                  ))}</tbody>
                </table>
            }
          </div>

          {/* ── Tabs ── */}
          <div>
            <div className="flex gap-2 mb-2">
              {(["decisions","trades"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${tab === t ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                  {t === "decisions" ? `AI Decisions (${decisions.length})` : `Trade History (${trades.length})`}
                </button>
              ))}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              {tab === "decisions" ? (
                decisions.length === 0
                  ? <p className="text-gray-600 text-xs py-2">No decisions yet — run the agent to generate some</p>
                  : <div className="overflow-x-auto"><table className="w-full text-xs">
                      <thead><tr className="text-gray-500 border-b border-gray-800">
                        {["Time","Symbol","Action","Confidence","Size %","SL %","TP %","Risk","Reason"].map(h =>
                          <th key={h} className="text-left py-1.5 px-2 font-medium">{h}</th>)}
                      </tr></thead>
                      <tbody>{decisions.map(d => (
                        <tr key={d.id} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                          <td className="py-1.5 px-2 text-gray-500 whitespace-nowrap">{new Date(d.createdAt).toLocaleTimeString()}</td>
                          <td className="py-1.5 px-2">
                            <button onClick={() => setTicker(d.symbol)} className="font-bold text-blue-400 hover:text-blue-300">{d.symbol}</button>
                          </td>
                          <td className="py-1.5 px-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${d.action === "BUY" ? "bg-green-900 text-green-300" : d.action === "SELL" ? "bg-red-900 text-red-300" : "bg-yellow-900 text-yellow-300"}`}>{d.action}</span>
                          </td>
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-1.5 bg-gray-800 rounded-full"><div className={`h-full rounded-full ${d.confidence >= 0.8 ? "bg-green-500" : d.confidence >= 0.65 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${d.confidence * 100}%` }} /></div>
                              <span className="text-gray-400">{(d.confidence * 100).toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="py-1.5 px-2 tabular-nums">{$(d.positionSizePct, 1)}%</td>
                          <td className="py-1.5 px-2 tabular-nums text-red-400">{$(d.stopLossPct, 1)}%</td>
                          <td className="py-1.5 px-2 tabular-nums text-green-400">{$(d.takeProfitPct, 1)}%</td>
                          <td className="py-1.5 px-2">{d.riskCheckPassed ? <span className="text-green-500">✓</span> : <span className="text-red-500">✗</span>}</td>
                          <td className="py-1.5 px-2 text-gray-400 max-w-xs truncate" title={d.reason}>{d.reason}</td>
                        </tr>
                      ))}</tbody>
                    </table></div>
              ) : (
                trades.length === 0
                  ? <p className="text-gray-600 text-xs py-2">No trades yet</p>
                  : <div className="overflow-x-auto"><table className="w-full text-xs">
                      <thead><tr className="text-gray-500 border-b border-gray-800">
                        {["Time","Symbol","Side","Qty","Entry","SL","TP","Status","Mode"].map(h =>
                          <th key={h} className="text-left py-1.5 px-2 font-medium">{h}</th>)}
                      </tr></thead>
                      <tbody>{trades.map(t => (
                        <tr key={t.id} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                          <td className="py-1.5 px-2 text-gray-500 whitespace-nowrap">{new Date(t.timestamp).toLocaleTimeString()}</td>
                          <td className="py-1.5 px-2 font-bold text-white">{t.symbol}</td>
                          <td className={`py-1.5 px-2 font-bold ${t.side === "buy" ? "text-green-400" : "text-red-400"}`}>{t.side?.toUpperCase()}</td>
                          <td className="py-1.5 px-2">{t.qty}</td>
                          <td className="py-1.5 px-2">${$(t.entryPrice)}</td>
                          <td className="py-1.5 px-2 text-red-400">{t.stopLoss ? `$${$(t.stopLoss)}` : "—"}</td>
                          <td className="py-1.5 px-2 text-green-400">{t.takeProfit ? `$${$(t.takeProfit)}` : "—"}</td>
                          <td className="py-1.5 px-2">
                            <span className={`text-xs ${t.status === "filled" ? "text-green-400" : t.status === "submitted" ? "text-blue-400" : "text-gray-500"}`}>{t.status}</span>
                          </td>
                          <td className={`py-1.5 px-2 text-xs ${t.isPaper ? "text-yellow-600" : "text-orange-400 font-bold"}`}>{t.isPaper ? "PAPER" : "LIVE"}</td>
                        </tr>
                      ))}</tbody>
                    </table></div>
              )}
            </div>
          </div>

          {/* ── Footer ── */}
          <p className="text-center text-xs text-gray-700 pb-4">AI Day Trader · Paper Trading Only · Not Financial Advice</p>
        </div>
      </div>
    </>
  );
}
