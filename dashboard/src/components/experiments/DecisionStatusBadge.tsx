import type { DecisionInfo } from "@/lib/api";

const statusStyles: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  collecting_data: {
    bg: "bg-zinc-800",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
    label: "Collecting Data",
  },
  keep_testing: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    dot: "bg-amber-400",
    label: "Keep Testing",
  },
  ready_to_ship: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
    label: "Ready to Ship",
  },
  practically_equivalent: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    dot: "bg-blue-400",
    label: "Equivalent",
  },
};

export function DecisionStatusBadge({ decision }: { decision: DecisionInfo | null }) {
  if (!decision) return null;

  const style =
    statusStyles[decision.decision_status] || statusStyles.collecting_data;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
      {decision.winning_variant && (
        <span className="opacity-70 ml-0.5">
          &middot; {decision.winning_variant}
        </span>
      )}
    </span>
  );
}
