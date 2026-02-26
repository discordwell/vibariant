import type { DecisionProgress, ExperimentResults } from "@/lib/api";
import { ConfidenceGauge } from "./ConfidenceGauge";

export function ExpectedLossHero({
  results,
}: {
  results: ExperimentResults;
}) {
  const { expected_loss, decision_progress, decision } = results;

  if (!expected_loss) return null;

  const entries = Object.entries(expected_loss);
  const leadingVariant = entries.reduce(
    (min, curr) => (curr[1] < min[1] ? curr : min),
    entries[0]
  );

  return (
    <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-200">
          Decision Progress
        </h2>
        {decision_progress?.estimated_days != null && (
          <span className="text-xs text-zinc-500">
            ~{decision_progress.estimated_days} more days at current traffic
          </span>
        )}
      </div>

      {/* Confidence gauge */}
      <ConfidenceGauge progress={decision_progress ?? null} />

      {/* Per-variant expected loss */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        {entries.map(([key, value]) => {
          const isLeading = key === leadingVariant[0];
          return (
            <div
              key={key}
              className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${
                isLeading
                  ? "bg-emerald-500/5 border border-emerald-500/20"
                  : "bg-zinc-800"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-300 font-mono">{key}</span>
                {isLeading && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                    lowest risk
                  </span>
                )}
              </div>
              <span
                className={`text-sm font-medium ${
                  isLeading ? "text-emerald-400" : "text-zinc-200"
                }`}
              >
                {(value * 100).toFixed(3)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Daily traffic rate */}
      {decision_progress?.daily_visitor_rate != null && (
        <p className="text-xs text-zinc-600 mt-3">
          {decision_progress.daily_visitor_rate.toFixed(0)} visitors/day
        </p>
      )}
    </div>
  );
}
