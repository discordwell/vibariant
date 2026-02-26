"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Experiment } from "@/lib/api";
import { api } from "@/lib/api";
import { useProject } from "@/lib/hooks";
import ExperimentCard from "@/components/experiment-card";

export default function DashboardHome() {
  const { projectId, loading: projectLoading, error: projectError } = useProject();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      if (!projectLoading) setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const exps = await api.getExperiments(projectId);
        if (!cancelled) setExperiments(exps);
      } catch (err: unknown) {
        if (!cancelled) {
          const apiErr = err as { detail?: string };
          setError(apiErr.detail || "Failed to load experiments");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [projectId, projectLoading]);

  const isLoading = projectLoading || loading;
  const displayError = projectError || error;

  // Derived stats
  const totalExperiments = experiments.length;
  const activeExperiments = experiments.filter((e) => e.status === "running").length;
  const variantCount = experiments.reduce(
    (sum, e) => sum + (e.variant_keys?.length ?? 0),
    0
  );

  // Show running experiments as "active" on the overview
  const runningExperiments = experiments.filter((e) => e.status === "running");

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Project overview and experiment summary
          </p>
        </div>
        <Link
          href="/dashboard/experiments"
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          View Experiments
        </Link>
      </div>

      {/* Error state */}
      {displayError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-400">{displayError}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-zinc-850 border border-zinc-800 rounded-xl p-5">
                <div className="skeleton h-4 w-24 mb-3" />
                <div className="skeleton h-8 w-16" />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Total Experiments
              </p>
              <p className="text-3xl font-bold text-zinc-100 mt-2">
                {totalExperiments}
              </p>
            </div>
            <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Active (Running)
              </p>
              <p className="text-3xl font-bold text-emerald-400 mt-2">
                {activeExperiments}
              </p>
            </div>
            <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Total Variants
              </p>
              <p className="text-3xl font-bold text-zinc-100 mt-2">
                {variantCount}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Active Experiments */}
        <div className="col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-100">
            Running Experiments
          </h2>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-zinc-850 border border-zinc-800 rounded-xl p-5">
                  <div className="skeleton h-5 w-48 mb-3" />
                  <div className="skeleton h-4 w-32 mb-4" />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="skeleton h-10 w-full" />
                    <div className="skeleton h-10 w-full" />
                    <div className="skeleton h-10 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : runningExperiments.length === 0 ? (
            <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-zinc-500 text-sm">
                No experiments are currently running.
              </p>
              <Link
                href="/dashboard/experiments"
                className="text-violet-400 hover:text-violet-300 text-sm mt-2 inline-block"
              >
                Create your first experiment
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {runningExperiments.map((exp) => (
                <ExperimentCard key={exp.id} experiment={exp} />
              ))}
            </div>
          )}
        </div>

        {/* Experiment Summary Sidebar */}
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">
            By Status
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-14 w-full" />
              ))}
            </div>
          ) : (
            <div className="bg-zinc-850 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
              {(["running", "paused", "draft", "completed"] as const).map((status) => {
                const count = experiments.filter((e) => e.status === status).length;
                const colors: Record<string, { dot: string; text: string }> = {
                  running: { dot: "bg-emerald-400", text: "text-emerald-400" },
                  paused: { dot: "bg-amber-400", text: "text-amber-400" },
                  draft: { dot: "bg-zinc-500", text: "text-zinc-400" },
                  completed: { dot: "bg-blue-400", text: "text-blue-400" },
                };
                const c = colors[status];
                return (
                  <div key={status} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                      <span className={`text-sm font-medium ${c.text}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-zinc-300">{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* All experiments link */}
          {!isLoading && experiments.length > 0 && (
            <Link
              href="/dashboard/experiments"
              className="block mt-4 text-center text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              View all {experiments.length} experiments
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
