import { PnlSummary } from "@ai-trader/shared";

interface Props {
  pnl: PnlSummary | undefined;
  isLoading: boolean;
}

function fmt(n: number, decimals = 2) {
  return n?.toFixed(decimals) ?? "—";
}

function fmtDollar(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return `${sign}$${abs.toFixed(2)}`;
}

export function PnlCard({ pnl, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-32 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!pnl) return null;

  const dayPnlColor =
    pnl.dayPnl > 0
      ? "text-green-400"
      : pnl.dayPnl < 0
      ? "text-red-400"
      : "text-gray-400";

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Account Summary
        </h2>
        <span className="text-xs text-gray-600">
          {pnl.asOf ? new Date(pnl.asOf).toLocaleTimeString() : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="stat-label">Total Equity</div>
          <div className="stat-value text-white">${fmt(pnl.totalEquity)}</div>
        </div>
        <div>
          <div className="stat-label">Cash</div>
          <div className="stat-value text-gray-300">${fmt(pnl.cash)}</div>
        </div>
        <div>
          <div className="stat-label">Day P&amp;L</div>
          <div className={`stat-value ${dayPnlColor}`}>
            {fmtDollar(pnl.dayPnl)}
            <span className="text-sm ml-1">
              ({pnl.dayPnl > 0 ? "+" : ""}
              {fmt(pnl.dayPnlPct)}%)
            </span>
          </div>
        </div>
        <div>
          <div className="stat-label">Unrealized P&amp;L</div>
          <div
            className={`stat-value ${
              pnl.totalUnrealizedPnl > 0
                ? "text-green-400"
                : pnl.totalUnrealizedPnl < 0
                ? "text-red-400"
                : "text-gray-400"
            }`}
          >
            {fmtDollar(pnl.totalUnrealizedPnl)}
          </div>
        </div>
      </div>
    </div>
  );
}
