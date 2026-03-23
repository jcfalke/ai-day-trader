// ============================================================
// API client — connects to Express backend
// ============================================================
const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

export const apiRoutes = {
  decisions: (symbol?: string) =>
    `/api/trade-decisions${symbol ? `?symbol=${symbol}` : ""}`,
  trades: (symbol?: string) =>
    `/api/trades${symbol ? `?symbol=${symbol}` : ""}`,
  positions: "/api/positions",
  pnl: "/api/pnl",
  health: "/api/health",
};
