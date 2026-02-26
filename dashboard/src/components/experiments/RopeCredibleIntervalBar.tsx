import type { VariantResult, RopeResult } from "@/lib/api";

export function RopeCredibleIntervalBar({
  result,
  maxRate,
  ropeAnalysis,
}: {
  result: VariantResult;
  maxRate: number;
  ropeAnalysis: RopeResult | null;
}) {
  const scale = maxRate > 0 ? 100 / maxRate : 0;
  const left = result.credible_interval[0] * scale;
  const right = result.credible_interval[1] * scale;
  const point = result.conversion_rate * scale;

  // ROPE region (centered at 0 in the difference space, but we show it
  // relative to the scale for visualization purposes)
  const ropeWidth =
    ropeAnalysis?.rope ? Math.abs(ropeAnalysis.rope[1]) * scale : 0;

  return (
    <div className="relative h-6 bg-zinc-800 rounded-full overflow-hidden">
      {/* ROPE region overlay (amber hatched) — shown as a band around the midpoint */}
      {ropeAnalysis?.rope && (
        <div
          className="absolute top-0 bottom-0 bg-amber-500/8 border-l border-r border-amber-500/20"
          style={{
            left: `${Math.max(0, 50 - ropeWidth)}%`,
            width: `${Math.min(100, ropeWidth * 2)}%`,
          }}
        >
          {/* Hatching pattern via repeating gradient */}
          <div
            className="w-full h-full opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(245,158,11,0.15) 2px, rgba(245,158,11,0.15) 4px)",
            }}
          />
        </div>
      )}

      {/* Credible interval bar */}
      <div
        className="absolute top-1 bottom-1 bg-violet-500/20 rounded-full"
        style={{ left: `${left}%`, width: `${right - left}%` }}
      />
      {/* Point estimate */}
      <div
        className="absolute top-0.5 bottom-0.5 w-1 bg-violet-500 rounded-full"
        style={{ left: `${point}%` }}
      />
    </div>
  );
}
