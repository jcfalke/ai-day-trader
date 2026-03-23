import { DecisionRecord } from "@ai-trader/shared";

interface Props {
  decisions: DecisionRecord[] | undefined;
  isLoading: boolean;
  onSelectSymbol?: (symbol: string) => void;
}

function ActionBadge({ action }: { action: string }) {
  if (action === "BUY") return <span className="badge-buy">BUY</span>;
  if (action === "SELL") return <span className="badge-sell">SELL</span>;
  return <span className="badge-hold">HOLD</span>;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 65 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 tabular-nums">{pct}%</span>
    </div>
  );
}

function RiskBadge({ passed }: { passed: boolean }) {
  return passed ? (
    <span className="text-green-500 text-xs">✓ Pass</span>
  ) : (
    <span className="text-red-500 text-xs">✗ Fail</span>
  );
}

export function DecisionsTable({ decisions, isLoading, onSelectSymbol }: Props) {
  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Latest AI Decisions
      </h2>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      ) : !decisions || decisions.length === 0 ? (
        <p className="text-gray-600 text-sm py-4 text-center">No decisions yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head">Time</th>
                <th className="table-head">Symbol</th>
                <th className="table-head">Action</th>
                <th className="table-head">Confidence</th>
                <th className="table-head text-right">Size %</th>
                <th className="table-head text-right">SL %</th>
                <th className="table-head text-right">TP %</th>
                <th className="table-head">Risk</th>
                <th className="table-head">Reason</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d) => (
                <tr key={d.id} className="hover:bg-gray-800/30">
                  <td className="table-cell text-gray-500 text-xs whitespace-nowrap">
                    {new Date(d.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="table-cell">
                    <button
                      className="font-bold text-blue-400 hover:text-blue-300 transition-colors"
                      onClick={() => onSelectSymbol?.(d.symbol)}
                    >
                      {d.symbol}
                    </button>
                  </td>
                  <td className="table-cell">
                    <ActionBadge action={d.action} />
                  </td>
                  <td className="table-cell">
                    <ConfidenceBar value={d.confidence} />
                  </td>
                  <td className="table-cell text-right tabular-nums">
                    {d.positionSizePct.toFixed(1)}%
                  </td>
                  <td className="table-cell text-right tabular-nums text-red-400">
                    {d.stopLossPct.toFixed(1)}%
                  </td>
                  <td className="table-cell text-right tabular-nums text-green-400">
                    {d.takeProfitPct.toFixed(1)}%
                  </td>
                  <td className="table-cell">
                    <RiskBadge passed={d.riskCheckPassed} />
                  </td>
                  <td
                    className="table-cell text-gray-400 text-xs max-w-xs truncate"
                    title={d.reason}
                  >
                    {d.reason}
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
