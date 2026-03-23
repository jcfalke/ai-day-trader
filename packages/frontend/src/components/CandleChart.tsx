"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, ColorType, CandlestickData } from "lightweight-charts";
import { DecisionRecord } from "@ai-trader/shared";

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Props {
  symbol: string;
  candles?: Candle[];
  decisions?: DecisionRecord[];
  isLoading?: boolean;
}

const ALPACA_DATA_BASE =
  process.env.NEXT_PUBLIC_ALPACA_DATA_BASE ?? "https://data.alpaca.markets";

export function CandleChart({ symbol, candles: propCandles, decisions, isLoading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [fetchedCandles, setFetchedCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(isLoading ?? false);

  // Fetch candles from Alpaca directly in the browser (demo mode)
  useEffect(() => {
    if (propCandles) {
      setFetchedCandles(propCandles);
      return;
    }
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
    setLoading(true);
    fetch(`${backendUrl}/api/candles?symbol=${symbol}&timeframe=5Min&limit=100`)
      .then((r) => r.json())
      .then((data) => {
        setFetchedCandles(data.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [symbol, propCandles]);

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0f172a" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: "#334155" },
      timeScale: { borderColor: "#334155", timeVisible: true },
      width: containerRef.current.clientWidth,
      height: 300,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        chart.resize(entries[0].contentRect.width, 300);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Update candle data
  useEffect(() => {
    if (!candleSeriesRef.current || fetchedCandles.length === 0) return;

    const data: CandlestickData[] = fetchedCandles.map((c) => ({
      time: (new Date(c.time).getTime() / 1000) as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(data);

    // Add trade markers from decisions
    if (decisions && decisions.length > 0) {
      const markers = decisions
        .filter((d) => d.action !== "HOLD")
        .map((d) => ({
          time: (new Date(d.createdAt).getTime() / 1000) as any,
          position: d.action === "BUY" ? ("belowBar" as const) : ("aboveBar" as const),
          color: d.action === "BUY" ? "#22c55e" : "#ef4444",
          shape: d.action === "BUY" ? ("arrowUp" as const) : ("arrowDown" as const),
          text: `${d.action} ${(d.confidence * 100).toFixed(0)}%`,
        }));
      candleSeriesRef.current.setMarkers(markers);
    }

    chartRef.current?.timeScale().fitContent();
  }, [fetchedCandles, decisions]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          {symbol} — Price Chart (5-Min)
        </h2>
        {loading && (
          <span className="text-xs text-gray-600 animate-pulse">Loading…</span>
        )}
      </div>

      {loading && fetchedCandles.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-gray-700">
          <div className="text-center">
            <div className="text-4xl mb-2">📊</div>
            <div className="text-sm">Loading chart data…</div>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="w-full" />
      )}

      <div className="flex gap-4 mt-2 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          Bullish
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          Bearish
        </span>
        <span className="flex items-center gap-1">▲ AI BUY signal</span>
        <span className="flex items-center gap-1">▼ AI SELL signal</span>
      </div>
    </div>
  );
}
