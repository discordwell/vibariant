"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { ExperimentDetail, VariantResult } from "@/lib/api";

const mockExperimentDetail: Record<string, ExperimentDetail> = {
  "exp-1": {
    id: "exp-1",
    name: "Hero CTA Color",
    status: "running",
    visitor_count: 4521,
    variants: [
      { id: "v1", name: "Original", weight: 0.5, visitor_count: 2260, conversion_rate: 0.032 },
      { id: "v2", name: "Green Button", weight: 0.5, visitor_count: 2261, conversion_rate: 0.047 },
    ],
    goal_id: "g1",
    goal_name: "CTA Click",
    days_running: 6,
    confidence: 0.92,
    recommendation:
      "Green Button is outperforming the Original by 46.9%. With 92% confidence, we recommend adopting Green Button. Consider running for 2 more days to reach 95% confidence.",
    results: [
      {
        variant_id: "v1",
        variant_name: "Original",
        visitors: 2260,
        conversions: 72,
        conversion_rate: 0.032,
        improvement_over_control: null,
        probability_of_being_best: 0.08,
        credible_interval: [0.025, 0.040],
      },
      {
        variant_id: "v2",
        variant_name: "Green Button",
        visitors: 2261,
        conversions: 106,
        conversion_rate: 0.047,
        improvement_over_control: 0.469,
        probability_of_being_best: 0.92,
        credible_interval: [0.038, 0.056],
      },
    ],
    created_at: "2026-02-20T10:00:00Z",
    updated_at: "2026-02-26T10:00:00Z",
  },
  "exp-2": {
    id: "exp-2",
    name: "Pricing Layout",
    status: "running",
    visitor_count: 5102,
    variants: [
      { id: "v3", name: "Stacked", weight: 0.5, visitor_count: 2551, conversion_rate: 0.021 },
      { id: "v4", name: "Side-by-side", weight: 0.5, visitor_count: 2551, conversion_rate: 0.028 },
    ],
    goal_id: "g2",
    goal_name: "Plan Selection",
    days_running: 8,
    confidence: 0.87,
    recommendation:
      "Side-by-side layout shows a 33.3% improvement over Stacked. Confidence is at 87% - we recommend continuing the experiment for 3-5 more days before making a decision.",
    results: [
      {
        variant_id: "v3",
        variant_name: "Stacked",
        visitors: 2551,
        conversions: 54,
        conversion_rate: 0.021,
        improvement_over_control: null,
        probability_of_being_best: 0.13,
        credible_interval: [0.016, 0.027],
      },
      {
        variant_id: "v4",
        variant_name: "Side-by-side",
        visitors: 2551,
        conversions: 71,
        conversion_rate: 0.028,
        improvement_over_control: 0.333,
        probability_of_being_best: 0.87,
        credible_interval: [0.022, 0.035],
      },
    ],
    created_at: "2026-02-18T10:00:00Z",
    updated_at: "2026-02-26T10:00:00Z",
  },
  "exp-3": {
    id: "exp-3",
    name: "Onboarding Flow",
    status: "running",
    visitor_count: 3224,
    variants: [
      { id: "v5", name: "Classic", weight: 0.33, visitor_count: 1074, conversion_rate: 0.058 },
      { id: "v6", name: "Progressive", weight: 0.33, visitor_count: 1075, conversion_rate: 0.071 },
      { id: "v7", name: "Minimal", weight: 0.34, visitor_count: 1075, conversion_rate: 0.063 },
    ],
    goal_id: "g3",
    goal_name: "Onboarding Complete",
    days_running: 4,
    confidence: 0.68,
    recommendation:
      "Progressive disclosure shows early promise with a 22.4% lift over Classic, but confidence is only 68%. The Minimal variant is also performing well. Continue running for at least 5 more days to get a clearer picture.",
    results: [
      {
        variant_id: "v5",
        variant_name: "Classic",
        visitors: 1074,
        conversions: 62,
        conversion_rate: 0.058,
        improvement_over_control: null,
        probability_of_being_best: 0.12,
        credible_interval: [0.044, 0.073],
      },
      {
        variant_id: "v6",
        variant_name: "Progressive",
        visitors: 1075,
        conversions: 76,
        conversion_rate: 0.071,
        improvement_over_control: 0.224,
        probability_of_being_best: 0.56,
        credible_interval: [0.056, 0.088],
      },
      {
        variant_id: "v7",
        variant_name: "Minimal",
        visitors: 1075,
        conversions: 68,
        conversion_rate: 0.063,
        improvement_over_control: 0.086,
        probability_of_being_best: 0.32,
        credible_interval: [0.049, 0.079],
      },
    ],
    created_at: "2026-02-22T10:00:00Z",
    updated_at: "2026-02-26T10:00:00Z",
  },
};

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
  const [experiment, setExperiment] = useState<ExperimentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExperiment(mockExperimentDetail[id] || null);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [id]);

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
  const maxRate = Math.max(
    ...(experiment.results ?? []).map((r) => r.credible_interval[1]),
    0.01
  );
  const controlResult = (experiment.results ?? []).find(
    (r) => r.improvement_over_control === null
  );

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
          <p className="text-zinc-500 text-sm mt-1">
            Tracking goal: {experiment.goal_name}
          </p>
        </div>
        <div className="flex gap-2">
          {experiment.status === "running" && (
            <button className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Pause
            </button>
          )}
          {experiment.status === "paused" && (
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Resume
            </button>
          )}
          <button className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Edit
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Visitors
          </p>
          <p className="text-2xl font-bold text-zinc-100 mt-1">
            {experiment.visitor_count?.toLocaleString()}
          </p>
        </div>
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Days Running
          </p>
          <p className="text-2xl font-bold text-zinc-100 mt-1">
            {experiment.days_running}
          </p>
        </div>
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Confidence
          </p>
          <p className="text-2xl font-bold text-zinc-100 mt-1">
            {((experiment.confidence ?? 0) * 100).toFixed(0)}%
          </p>
        </div>
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Variants
          </p>
          <p className="text-2xl font-bold text-zinc-100 mt-1">
            {experiment.variants?.length}
          </p>
        </div>
      </div>

      {/* Variant Comparison Table */}
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
                vs. Control
              </th>
              <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-2.5">
                P(Best)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {(experiment.results ?? []).map((result) => {
              const isBest = (experiment.results ?? []).every(
                (r) =>
                  r.variant_id === result.variant_id ||
                  (r.probability_of_being_best ?? 0) <=
                    (result.probability_of_being_best ?? 0)
              );
              const isControl = result.improvement_over_control === null;

              return (
                <tr
                  key={result.variant_id}
                  className={isBest ? "bg-violet-500/5" : ""}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          isBest ? "text-violet-300" : "text-zinc-200"
                        }`}
                      >
                        {result.variant_name}
                      </span>
                      {isControl && (
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
                  <td className="px-5 py-3 text-sm text-right">
                    {result.improvement_over_control != null ? (
                      <span
                        className={
                          (result.improvement_over_control ?? 0) > 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }
                      >
                        {(result.improvement_over_control ?? 0) > 0 ? "+" : ""}
                        {((result.improvement_over_control ?? 0) * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-zinc-600">baseline</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-zinc-300 text-right font-medium">
                    {((result.probability_of_being_best ?? 0) * 100).toFixed(0)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Credible Intervals Visualization */}
      <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-zinc-200 mb-4">
          Credible Intervals (95%)
        </h2>
        <div className="space-y-4">
          {(experiment.results ?? []).map((result) => (
            <div key={result.variant_id}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-zinc-300">
                  {result.variant_name}
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

      {/* Recommendation */}
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
              {experiment.recommendation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
