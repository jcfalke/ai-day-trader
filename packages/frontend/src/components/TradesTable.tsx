import { TradeRecord } from "@ai-trader/shared";

interface Props {
  trades: TradeRecord[] | undefined;
  isLoading: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    filled: "text-green-400",
    submitted: "text-blue-400",
    pending: "text-yellow-400",
    cancelled: "text-gray-500",
    rejected: "text-red-400",
    partially_filled: "text-orange-400",
  };
  return (
    <span className={`text-xs font-medium ${map[status] ?? "text-gray-400"}`}>
      {status}
    </span>
  );
}

export function TradesTable({ trades, isLoading }: Props) {
  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Trade History
      </h2>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      ) : !trades || trades.length === 0 ? (
        <p className="text-gray-600 text-sm py-4 text-center">No trades yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head">Time</th>
                <th className="table-head">Symbol</th>
                <th className="table-head">Side</th>
                <th className="table-head text-right">Qty</th>
                <th className="table-head text-right">Entry</th>
                <th className="table-head text-right">Stop Loss</th>
                <th className="table-head text-right">Take Profit</th>
                <th className="table-head">Status</th>
                <th className="table-head">Mode</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="hover:bg-gray-800/30">
                  <td className="table-cell text-gray-500 text-xs whitespace-nowrap">
                    {new Date(t.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="table-cell font-bold text-white">{t.symbol}</td>
                  <td className="table-cell">
                    <span
                      className={
                        t.side === "buy" ? "text-green-400" : "text-red-400"
                      }
                    >
                      {t.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="table-cell text-right tabular-nums">{t.qty}</td>
                  <td className="table-cell text-right tabular-nums">
                    ${t.entryPrice.toFixed(2)}
                  </td>
                  <td className="table-cell text-right tabular-nums text-red-400">
                    {t.stopLoss ? `$${t.stopLoss.toFixed(2)}` : "—"}
                  </td>
                  <td className="table-cell text-right tabular-nums text-green-400">
                    {t.takeProfit ? `$${t.takeProfit.toFixed(2)}` : "—"}
                  </td>
                  <td className="table-cell">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="table-cell">
                    <span
                      className={`text-xs ${
                        t.isPaper ? "text-yellow-600" : "text-orange-400 font-bold"
                      }`}
                    >
                      {t.isPaper ? "PAPER" : "LIVE"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
