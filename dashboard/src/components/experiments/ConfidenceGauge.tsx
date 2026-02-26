import type { DecisionProgress } from "@/lib/api";

function getBarColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-400";
  return "bg-zinc-500";
}

function getTextColor(pct: number): string {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 50) return "text-amber-400";
  return "text-zinc-400";
}

export function ConfidenceGauge({
  progress,
}: {
  progress: DecisionProgress | null;
}) {
  if (!progress) return null;

  const pct = Math.min(100, Math.max(0, progress.confidence_pct));

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Decision Confidence
        </span>
        <span className={`text-sm font-bold ${getTextColor(pct)}`}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getBarColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-zinc-600">
          Threshold: {(progress.epsilon_threshold * 100).toFixed(3)}%
        </span>
        <span className="text-xs text-zinc-600">
          Leading loss: {(progress.leading_variant_loss * 100).toFixed(3)}%
        </span>
      </div>
    </div>
  );
}
