"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Experiment, ExperimentResults, VariantResult } from "@/lib/api";
import { api } from "@/lib/api";
import { DecisionStatusBadge } from "@/components/experiments/DecisionStatusBadge";
import { ExpectedLossHero } from "@/components/experiments/ExpectedLossHero";
import { RopeCredibleIntervalBar } from "@/components/experiments/RopeCredibleIntervalBar";
import { StructuredRecommendation } from "@/components/experiments/StructuredRecommendation";

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-zinc-800", text: "text-zinc-400", dot: "bg-zinc-500" },
  running: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  paused: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  completed: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
};

export default function ExperimentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setResults(null);
    } finally {
      setResultsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchExperiment();
    fetchResults();
  }, [fetchExperiment, fetchResults]);

  // Auto-refresh every 30s for running experiments
  useEffect(() => {
    if (experiment?.status === "running") {
      refreshRef.current = setInterval(() => {
        fetchResults();
      }, 30_000);
    }
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [experiment?.status, fetchResults]);

  const handleStatusChange = async (newStatus: "running" | "paused" | "completed") => {
    if (!experiment) return;
    setUpdating(true);
    try {
      const updated = await api.updateExperiment(id, { status: newStatus });
      setExperiment(updated);
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
        <p className="text-zinc-500 mt-2">{error}</p>
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

  const maxRate = hasResults
    ? Math.max(
        ...results.variants.map((r) => r.credible_interval[1]),
        0.01
      )
    : 0;

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
            {hasResults && results.decision && (
              <DecisionStatusBadge decision={results.decision} />
            )}
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

      {/* Stats summary */}
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

      {/* Decision Progress Hero (replaces old expected loss section) */}
      {hasResults && results.expected_loss && (
        <ExpectedLossHero results={results} />
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

      {/* Credible Intervals with ROPE overlay */}
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
                <RopeCredibleIntervalBar
                  result={result}
                  maxRate={maxRate * 1.2}
                  ropeAnalysis={results.rope_analysis}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-600 mt-3">
            The bar shows the 95% credible interval. The line marks the observed
            conversion rate.
            {results.rope_analysis && (
              <> The amber band shows the ROPE (Region of Practical Equivalence).</>
            )}
          </p>
        </div>
      )}

      {/* Winner's Curse: Raw vs Shrunk Effect Size */}
      {hasResults && results.raw_effect_size != null && results.shrunk_effect_size != null && (
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-zinc-200 mb-3">
            Effect Size (Winner&apos;s Curse Correction)
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Raw Effect</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-500 rounded-full"
                    style={{
                      width: `${Math.min(100, results.raw_effect_size * 1000)}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium text-zinc-300 w-16 text-right">
                  {(results.raw_effect_size * 100).toFixed(2)}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">
                Shrunk Effect{" "}
                <span className="text-zinc-600">(corrected)</span>
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full"
                    style={{
                      width: `${Math.min(100, results.shrunk_effect_size * 1000)}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium text-violet-300 w-16 text-right">
                  {(results.shrunk_effect_size * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-600 mt-2">
            Shrinkage corrects for winner&apos;s curse by pulling extreme estimates toward the project average.
          </p>
        </div>
      )}

      {/* Structured Recommendation (replaces plain text) */}
      {hasResults && results.recommendation && (
        <StructuredRecommendation results={results} />
      )}

      {/* Expandable Statistical Details */}
      {hasResults && (
        <div className="mt-6">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showDetails ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            Statistical Details
          </button>

          {showDetails && (
            <div className="mt-3 bg-zinc-850 border border-zinc-800 rounded-xl p-5 space-y-3">
              {results.prior_used && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Prior Source</span>
                  <span className="text-zinc-300 font-mono">{results.prior_used}</span>
                </div>
              )}
              {results.probability_best && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">P(best)</span>
                  <span className="text-zinc-300 font-mono">
                    [{results.probability_best.map((p) => (p * 100).toFixed(1) + "%").join(", ")}]
                  </span>
                </div>
              )}
              {results.suggested_allocation && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Suggested Allocation</span>
                  <span className="text-zinc-300 font-mono">
                    {Object.entries(results.suggested_allocation)
                      .map(([k, v]) => `${k}: ${(v * 100).toFixed(0)}%`)
                      .join(", ")}
                  </span>
                </div>
              )}
              {results.decision?.decision_status && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Decision Status</span>
                  <span className="text-zinc-300 font-mono">{results.decision.decision_status}</span>
                </div>
              )}
              {results.rope_analysis?.hdi && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Difference HDI (95%)</span>
                  <span className="text-zinc-300 font-mono">
                    [{(results.rope_analysis.hdi[0] * 100).toFixed(2)}%, {(results.rope_analysis.hdi[1] * 100).toFixed(2)}%]
                  </span>
                </div>
              )}
              {experiment.loss_threshold != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Loss Threshold (epsilon)</span>
                  <span className="text-zinc-300 font-mono">{(experiment.loss_threshold * 100).toFixed(3)}%</span>
                </div>
              )}
              {experiment.rope_width != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">ROPE Width</span>
                  <span className="text-zinc-300 font-mono">+/-{(experiment.rope_width * 100).toFixed(3)}%</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
