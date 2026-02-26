"use client";

import Link from "next/link";
import type { Experiment } from "@/lib/api";

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-zinc-800", text: "text-zinc-400", dot: "bg-zinc-500" },
  running: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  paused: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  completed: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
};

interface ExperimentCardProps {
  experiment: Experiment;
}

export default function ExperimentCard({ experiment }: ExperimentCardProps) {
  const status = statusColors[experiment.status] || statusColors.draft;
  const variantKeys = experiment.variant_keys ?? [];
  const trafficPct = experiment.traffic_percentage ?? 1;

  return (
    <Link
      href={`/dashboard/experiments/${experiment.id}`}
      className="block bg-zinc-850 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all duration-150 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-violet-300 transition-colors truncate">
            {experiment.name}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {variantKeys.length} variants
            {experiment.key && (
              <span className="ml-2 font-mono text-zinc-600">{experiment.key}</span>
            )}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {experiment.status.charAt(0).toUpperCase() + experiment.status.slice(1)}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div>
          <p className="text-xs text-zinc-500">Variants</p>
          <p className="text-sm font-semibold text-zinc-200 mt-0.5">
            {variantKeys.length}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Traffic</p>
          <p className="text-sm font-semibold text-zinc-200 mt-0.5">
            {(trafficPct * 100).toFixed(0)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Key</p>
          <p className="text-sm font-semibold text-zinc-200 mt-0.5 truncate font-mono">
            {experiment.key || "-"}
          </p>
        </div>
      </div>

      {/* Variant list */}
      {variantKeys.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {variantKeys.map((vk, idx) => {
            const widthPct = (1 / variantKeys.length) * 100;
            return (
              <div key={vk} className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 w-16 truncate">
                  {vk}
                </span>
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      idx === 0 ? "bg-violet-500" : "bg-zinc-600"
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 w-12 text-right">
                  {(100 / variantKeys.length).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Link>
  );
}
