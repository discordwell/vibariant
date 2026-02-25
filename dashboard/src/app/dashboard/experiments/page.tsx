"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Experiment } from "@/lib/api";

const mockExperiments: Experiment[] = [
  {
    id: "exp-1",
    name: "Hero CTA Color",
    status: "running",
    visitor_count: 4521,
    variants: [
      { id: "v1", name: "Original", weight: 0.5, visitor_count: 2260, conversion_rate: 0.032 },
      { id: "v2", name: "Green Button", weight: 0.5, visitor_count: 2261, conversion_rate: 0.047 },
    ],
    created_at: "2026-02-20T10:00:00Z",
    updated_at: "2026-02-26T10:00:00Z",
  },
  {
    id: "exp-2",
    name: "Pricing Layout",
    status: "running",
    visitor_count: 5102,
    variants: [
      { id: "v3", name: "Stacked", weight: 0.5, visitor_count: 2551, conversion_rate: 0.021 },
      { id: "v4", name: "Side-by-side", weight: 0.5, visitor_count: 2551, conversion_rate: 0.028 },
    ],
    created_at: "2026-02-18T10:00:00Z",
    updated_at: "2026-02-26T10:00:00Z",
  },
  {
    id: "exp-3",
    name: "Onboarding Flow",
    status: "running",
    visitor_count: 3224,
    variants: [
      { id: "v5", name: "Classic", weight: 0.33, visitor_count: 1074, conversion_rate: 0.058 },
      { id: "v6", name: "Progressive", weight: 0.33, visitor_count: 1075, conversion_rate: 0.071 },
      { id: "v7", name: "Minimal", weight: 0.34, visitor_count: 1075, conversion_rate: 0.063 },
    ],
    created_at: "2026-02-22T10:00:00Z",
    updated_at: "2026-02-26T10:00:00Z",
  },
  {
    id: "exp-4",
    name: "Newsletter Popup Timing",
    status: "completed",
    visitor_count: 8930,
    variants: [
      { id: "v8", name: "5 seconds", weight: 0.33, visitor_count: 2977, conversion_rate: 0.012 },
      { id: "v9", name: "30 seconds", weight: 0.33, visitor_count: 2977, conversion_rate: 0.034 },
      { id: "v10", name: "Exit intent", weight: 0.34, visitor_count: 2976, conversion_rate: 0.041 },
    ],
    created_at: "2026-02-01T10:00:00Z",
    updated_at: "2026-02-15T10:00:00Z",
  },
  {
    id: "exp-5",
    name: "Checkout Button Text",
    status: "draft",
    visitor_count: 0,
    variants: [
      { id: "v11", name: "Buy Now", weight: 0.5, visitor_count: 0 },
      { id: "v12", name: "Add to Cart", weight: 0.5, visitor_count: 0 },
    ],
    created_at: "2026-02-25T10:00:00Z",
    updated_at: "2026-02-25T10:00:00Z",
  },
  {
    id: "exp-6",
    name: "Footer Redesign",
    status: "paused",
    visitor_count: 1240,
    variants: [
      { id: "v13", name: "Minimal", weight: 0.5, visitor_count: 620, conversion_rate: 0.015 },
      { id: "v14", name: "Expanded", weight: 0.5, visitor_count: 620, conversion_rate: 0.018 },
    ],
    created_at: "2026-02-10T10:00:00Z",
    updated_at: "2026-02-20T10:00:00Z",
  },
];

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-zinc-800", text: "text-zinc-400", dot: "bg-zinc-500" },
  running: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  paused: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  completed: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
};

type FilterStatus = "all" | "running" | "completed" | "draft" | "paused";

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    const timer = setTimeout(() => {
      setExperiments(mockExperiments);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const filtered =
    filter === "all"
      ? experiments
      : experiments.filter((e) => e.status === filter);

  const counts = {
    all: experiments.length,
    running: experiments.filter((e) => e.status === "running").length,
    completed: experiments.filter((e) => e.status === "completed").length,
    draft: experiments.filter((e) => e.status === "draft").length,
    paused: experiments.filter((e) => e.status === "paused").length,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Experiments</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Manage and monitor your AB tests
          </p>
        </div>
        <button className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          New Experiment
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-850 border border-zinc-800 rounded-lg p-1 w-fit">
        {(["all", "running", "completed", "draft", "paused"] as FilterStatus[]).map(
          (status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filter === status
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-1.5 text-zinc-600">
                {counts[status]}
              </span>
            </button>
          )
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="skeleton h-5 w-48" />
                <div className="skeleton h-5 w-20" />
                <div className="skeleton h-5 w-16" />
                <div className="skeleton h-5 w-24" />
                <div className="skeleton h-5 w-32 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3">
                  Name
                </th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3">
                  Variants
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3">
                  Visitors
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3">
                  Best Conv. Rate
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((exp) => {
                const status = statusColors[exp.status] || statusColors.draft;
                const bestRate = Math.max(
                  ...(exp.variants ?? []).map((v) => v.conversion_rate || 0)
                );
                return (
                  <tr
                    key={exp.id}
                    className="hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dashboard/experiments/${exp.id}`}
                        className="text-sm font-medium text-zinc-100 hover:text-violet-300 transition-colors"
                      >
                        {exp.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {exp.status.charAt(0).toUpperCase() + exp.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-zinc-400">
                      {exp.variants?.length ?? 0}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-zinc-300 text-right">
                      {(exp.visitor_count ?? 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-zinc-300 text-right">
                      {bestRate > 0
                        ? `${(bestRate * 100).toFixed(1)}%`
                        : "-"}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-zinc-500 text-right">
                      {exp.updated_at ? new Date(exp.updated_at).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-zinc-500 text-sm">
                No experiments match this filter.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
