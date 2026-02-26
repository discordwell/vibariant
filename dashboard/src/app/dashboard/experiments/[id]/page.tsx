"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Experiment, ExperimentResults, VariantResult } from "@/lib/api";
import { api } from "@/lib/api";

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-zinc-800", text: "text-zinc-400", dot: "bg-zinc-500" },
  running: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  paused: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  completed: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
};

function CredibleIntervalBar({ result, maxRate }: { result: VariantResult; maxRate: number }) {
  const scale = maxRate > 0 ? 100 / maxRate : 0;
  const left = result.credible_interval[0] * scale;
  const right = result.credible_interval[1] * scale;
  const point = result.conversion_rate * scale;

  return (
    <div className="relative h-6 bg-zinc-800 rounded-full overflow-hidden">
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

export default function ExperimentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchExperiment = useCallback(async () => {
    try {
      const exp = await api.getExperiment(id);
      setExperiment(exp);
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr.detail || "Failed to load experiment");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchResults = useCallback(async () => {
    setResultsLoading(true);
    try {
      const res = await api.getExperimentResults(id);
      setResults(res);
    } catch {
      // Results might not exist yet (experiment just created or no events) -- that's ok
      setResults(null);
    } finally {
      setResultsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchExperiment();
    fetchResults();
  }, [fetchExperiment, fetchResults]);

  const handleStatusChange = async (newStatus: "running" | "paused" | "completed") => {
    if (!experiment) return;
    setUpdating(true);
    try {
      const updated = await api.updateExperiment(id, { status: newStatus });
      setExperiment(updated);
      // Refetch results if we started the experiment
      if (newStatus === "running") fetchResults();
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr.detail || "Failed to update experiment");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="skeleton h-8 w-64 mb-2" />
        <div className="skeleton h-4 w-48 mb-8" />
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-64 w-full rounded-xl mb-6" />
        <div className="skeleton h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (error && !experiment) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-zinc-300">
          Experiment not found
        </h2>
        <p className="text-zinc-500 mt-2">
          {error}
        </p>
        <Link
          href="/dashboard/experiments"
          className="text-violet-400 hover:text-violet-300 text-sm mt-4 inline-block"
        >
          Back to experiments
        </Link>
      </div>
    );
  }

  if (!experiment) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-zinc-300">
          Experiment not found
        </h2>
        <p className="text-zinc-500 mt-2">
          The experiment you&apos;re looking for doesn&apos;t exist or has been deleted.
        </p>
        <Link
          href="/dashboard/experiments"
          className="text-violet-400 hover:text-violet-300 text-sm mt-4 inline-block"
        >
          Back to experiments
        </Link>
      </div>
    );
  }

  const status = statusColors[experiment.status] || statusColors.draft;
  const variantKeys = experiment.variant_keys ?? [];
  const hasResults = results && results.variants.length > 0 && results.total_visitors > 0;

  // Compute max rate for credible interval visualization
  const maxRate = hasResults
    ? Math.max(
        ...results.variants.map((r) => r.credible_interval[1]),
        0.01
      )
    : 0;

  // Find the best variant (highest posterior mean or conversion rate)
  const bestVariant = hasResults
    ? results.variants.reduce((best, v) =>
        (v.posterior_mean ?? v.conversion_rate) > (best.posterior_mean ?? best.conversion_rate) ? v : best
      , results.variants[0])
    : null;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
        <Link
          href="/dashboard/experiments"
          className="hover:text-zinc-300 transition-colors"
        >
          Experiments
        </Link>
        <span>/</span>
        <span className="text-zinc-300">{experiment.name}</span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-100">
              {experiment.name}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {experiment.status.charAt(0).toUpperCase() +
                experiment.status.slice(1)}
            </span>
          </div>
          <p className="text-zinc-500 text-sm mt-1 font-mono">
            {experiment.key}
          </p>
        </div>
        <div className="flex gap-2">
          {experiment.status === "draft" && (
            <button
              onClick={() => handleStatusChange("running")}
              disabled={updating}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {updating ? "Starting..." : "Start"}
            </button>
          )}
          {experiment.status === "running" && (
            <>
              <button
                onClick={() => handleStatusChange("paused")}
                disabled={updating}
                className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {updating ? "..." : "Pause"}
              </button>
              <button
                onClick={() => handleStatusChange("completed")}
                disabled={updating}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {updating ? "..." : "Complete"}
              </button>
            </>
          )}
          {experiment.status === "paused" && (
            <>
              <button
                onClick={() => handleStatusChange("running")}
                disabled={updating}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {updating ? "..." : "Resume"}
              </button>
              <button
                onClick={() => handleStatusChange("completed")}
                disabled={updating}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {updating ? "..." : "Complete"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Total Visitors
          </p>
          <p className="text-2xl font-bold text-zinc-100 mt-1">
            {hasResults ? results.total_visitors.toLocaleString() : "0"}
          </p>
        </div>
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Variants
          </p>
          <p className="text-2xl font-bold text-zinc-100 mt-1">
            {variantKeys.length}
          </p>
        </div>
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Traffic
          </p>
          <p className="text-2xl font-bold text-zinc-100 mt-1">
            {((experiment.traffic_percentage ?? 1) * 100).toFixed(0)}%
          </p>
        </div>
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            P(B beats A)
          </p>
          <p className="text-2xl font-bold text-zinc-100 mt-1">
            {results?.probability_b_beats_a != null
              ? `${(results.probability_b_beats_a * 100).toFixed(0)}%`
              : "-"}
          </p>
        </div>
      </div>

      {/* No results yet state */}
      {!hasResults && !resultsLoading && (
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-8 text-center mb-6">
          <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-300 mb-1">
            No results yet
          </h3>
          <p className="text-zinc-500 text-sm max-w-md mx-auto">
            {experiment.status === "draft"
              ? "Start this experiment to begin collecting data. Results will appear here once visitors are assigned to variants."
              : "This experiment is active but hasn't received any events yet. Make sure your SDK is configured with the correct project token."}
          </p>
        </div>
      )}

      {/* Results loading */}
      {resultsLoading && !hasResults && (
        <div className="space-y-6 mb-6">
          <div className="skeleton h-64 w-full rounded-xl" />
          <div className="skeleton h-48 w-full rounded-xl" />
        </div>
      )}

      {/* Variant Comparison Table */}
      {hasResults && (
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-200">
              Variant Results
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-2.5">
                  Variant
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-2.5">
                  Visitors
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-2.5">
                  Conversions
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-2.5">
                  Rate
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-2.5">
                  Posterior Mean
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-2.5">
                  Engagement
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {results.variants.map((result) => {
                const isBest = bestVariant?.variant_key === result.variant_key;
                const isFirst = result.variant_key === variantKeys[0];

                return (
                  <tr
                    key={result.variant_key}
                    className={isBest ? "bg-violet-500/5" : ""}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${
                            isBest ? "text-violet-300" : "text-zinc-200"
                          }`}
                        >
                          {result.variant_key}
                        </span>
                        {isFirst && (
                          <span className="text-xs bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
                            control
                          </span>
                        )}
                        {isBest && (
                          <span className="text-xs bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded">
                            leading
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-300 text-right">
                      {result.visitors.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-300 text-right">
                      {result.conversions.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-200 text-right font-medium">
                      {(result.conversion_rate * 100).toFixed(2)}%
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-300 text-right">
                      {result.posterior_mean != null
                        ? (result.posterior_mean * 100).toFixed(2) + "%"
                        : "-"}
                    </td>
                    <td className="px-5 py-3 text-sm text-zinc-300 text-right">
                      {result.engagement_score != null
                        ? result.engagement_score.toFixed(2)
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Credible Intervals Visualization */}
      {hasResults && (
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">
            Credible Intervals (95%)
          </h2>
          <div className="space-y-4">
            {results.variants.map((result) => (
              <div key={result.variant_key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-zinc-300">
                    {result.variant_key}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {(result.credible_interval[0] * 100).toFixed(1)}% -{" "}
                    {(result.credible_interval[1] * 100).toFixed(1)}%
                  </span>
                </div>
                <CredibleIntervalBar result={result} maxRate={maxRate * 1.2} />
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-600 mt-3">
            The bar shows the 95% credible interval. The line marks the observed
            conversion rate.
          </p>
        </div>
      )}

      {/* Expected Loss */}
      {hasResults && results.expected_loss && (
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-zinc-200 mb-3">
            Expected Loss
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {typeof results.expected_loss === "object" &&
              Object.entries(results.expected_loss).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-2.5">
                  <span className="text-sm text-zinc-300 font-mono">{key}</span>
                  <span className="text-sm font-medium text-zinc-200">
                    {(value * 100).toFixed(3)}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      {hasResults && results.recommendation && (
        <div className="bg-zinc-850 border border-violet-500/20 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-violet-500/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg
                className="w-4 h-4 text-violet-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-violet-300 mb-1">
                Recommendation
              </h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {results.recommendation}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
