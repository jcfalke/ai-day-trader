import { OpenPosition } from "@ai-trader/shared";

interface Props {
  positions: OpenPosition[] | undefined;
  isLoading: boolean;
}

export function PositionsTable({ positions, isLoading }: Props) {
  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Open Positions
      </h2>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      ) : !positions || positions.length === 0 ? (
        <p className="text-gray-600 text-sm py-4 text-center">No open positions</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head">Symbol</th>
                <th className="table-head">Side</th>
                <th className="table-head text-right">Qty</th>
                <th className="table-head text-right">Avg Entry</th>
                <th className="table-head text-right">Current</th>
                <th className="table-head text-right">Mkt Value</th>
                <th className="table-head text-right">Unr. P&L</th>
                <th className="table-head text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const pnlColor =
                  pos.unrealizedPnl > 0
                    ? "text-green-400"
                    : pos.unrealizedPnl < 0
                    ? "text-red-400"
                    : "text-gray-400";
                return (
                  <tr key={pos.symbol} className="hover:bg-gray-800/30">
                    <td className="table-cell font-bold text-white">{pos.symbol}</td>
                    <td className="table-cell">
                      <span
                        className={
                          pos.side === "long" ? "text-green-400" : "text-red-400"
                        }
                      >
                        {pos.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="table-cell text-right">{pos.qty}</td>
                    <td className="table-cell text-right">
                      ${pos.avgEntryPrice.toFixed(2)}
                    </td>
                    <td className="table-cell text-right">
                      ${pos.currentPrice.toFixed(2)}
                    </td>
                    <td className="table-cell text-right">
                      ${pos.marketValue.toFixed(2)}
                    </td>
                    <td className={`table-cell text-right font-medium ${pnlColor}`}>
                      {pos.unrealizedPnl > 0 ? "+" : ""}
                      {pos.unrealizedPnl.toFixed(2)}
                    </td>
                    <td className={`table-cell text-right ${pnlColor}`}>
                      {pos.unrealizedPnlPct > 0 ? "+" : ""}
                      {pos.unrealizedPnlPct.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
