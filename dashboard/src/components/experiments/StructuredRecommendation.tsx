import type { ExperimentResults } from "@/lib/api";
import { DecisionStatusBadge } from "./DecisionStatusBadge";

export function StructuredRecommendation({
  results,
}: {
  results: ExperimentResults;
}) {
  const { recommendation, decision, rope_analysis, expected_loss } = results;

  if (!recommendation) return null;

  const ropeDecision = rope_analysis?.decision;
  const isEquivalent = decision?.decision_status === "practically_equivalent";
  const isReady = decision?.decision_status === "ready_to_ship";

  return (
    <div
      className={`bg-zinc-850 border rounded-xl p-5 ${
        isReady
          ? "border-emerald-500/30"
          : isEquivalent
          ? "border-blue-500/20"
          : "border-violet-500/20"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
            isReady
              ? "bg-emerald-500/10"
              : isEquivalent
              ? "bg-blue-500/10"
              : "bg-violet-500/10"
          }`}
        >
          {isReady ? (
            <svg
              className="w-4 h-4 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : isEquivalent ? (
            <svg
              className="w-4 h-4 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          ) : (
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
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h2
              className={`text-sm font-semibold ${
                isReady
                  ? "text-emerald-300"
                  : isEquivalent
                  ? "text-blue-300"
                  : "text-violet-300"
              }`}
            >
              Recommendation
            </h2>
            <DecisionStatusBadge decision={decision} />
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">
            {recommendation}
          </p>

          {/* ROPE context */}
          {ropeDecision && ropeDecision !== "undecided" && (
            <p className="text-xs text-zinc-500 mt-2">
              ROPE analysis:{" "}
              {ropeDecision === "equivalent"
                ? "Difference is within the region of practical equivalence."
                : ropeDecision === "ship_a" || ropeDecision === "ship_b"
                ? "Difference is outside the ROPE — a meaningful difference exists."
                : ropeDecision}
            </p>
          )}

          {/* Prior info */}
          {results.prior_used && (
            <p className="text-xs text-zinc-600 mt-1">
              Prior:{" "}
              {results.prior_used === "user_specified"
                ? "User-specified"
                : results.prior_used === "project_historical"
                ? "Project historical (empirical Bayes)"
                : "Platform default"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
