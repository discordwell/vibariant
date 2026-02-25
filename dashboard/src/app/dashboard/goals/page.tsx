"use client";

import { useEffect, useState } from "react";
import type { Goal } from "@/lib/api";

const mockGoals: Goal[] = [
  {
    id: "g1",
    name: "CTA Click",
    type: "click",
    selector: "button.cta-primary",
    auto_detected: true,
    confirmed: true,
    event_count: 1243,
    created_at: "2026-02-15T10:00:00Z",
  },
  {
    id: "g2",
    name: "Plan Selection",
    type: "click",
    selector: ".pricing-card .select-plan",
    auto_detected: true,
    confirmed: true,
    event_count: 487,
    created_at: "2026-02-16T10:00:00Z",
  },
  {
    id: "g3",
    name: "Onboarding Complete",
    type: "pageview",
    url_pattern: "/onboarding/complete",
    auto_detected: true,
    confirmed: true,
    event_count: 312,
    created_at: "2026-02-17T10:00:00Z",
  },
  {
    id: "g4",
    name: "Newsletter Signup",
    type: "form_submit",
    selector: "form#newsletter",
    auto_detected: true,
    confirmed: false,
    event_count: 89,
    created_at: "2026-02-20T10:00:00Z",
  },
  {
    id: "g5",
    name: "Checkout Page View",
    type: "pageview",
    url_pattern: "/checkout*",
    auto_detected: true,
    confirmed: false,
    event_count: 156,
    created_at: "2026-02-21T10:00:00Z",
  },
  {
    id: "g6",
    name: "Add to Cart",
    type: "click",
    selector: "button.add-to-cart",
    auto_detected: true,
    confirmed: false,
    event_count: 734,
    created_at: "2026-02-22T10:00:00Z",
  },
  {
    id: "g7",
    name: "Contact Form Submit",
    type: "form_submit",
    selector: "form#contact",
    auto_detected: false,
    confirmed: true,
    event_count: 42,
    created_at: "2026-02-23T10:00:00Z",
  },
];

const typeConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  click: {
    color: "text-violet-400",
    label: "Click",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
      </svg>
    ),
  },
  pageview: {
    color: "text-blue-400",
    label: "Pageview",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  form_submit: {
    color: "text-amber-400",
    label: "Form Submit",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  custom: {
    color: "text-emerald-400",
    label: "Custom",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setGoals(mockGoals);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleConfirm = (id: string) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, confirmed: true } : g))
    );
  };

  const handleDismiss = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const handleStartEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setEditName(goal.name ?? goal.label ?? "");
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      setGoals((prev) =>
        prev.map((g) => (g.id === id ? { ...g, name: editName.trim() } : g))
      );
    }
    setEditingId(null);
  };

  const confirmed = goals.filter((g) => g.confirmed);
  const unconfirmed = goals.filter((g) => !g.confirmed);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Goals</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Auto-detected conversion goals from your site. Confirm or edit them
            to use in experiments.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Unconfirmed goals (need review) */}
          {unconfirmed.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                Needs Review ({unconfirmed.length})
              </h2>
              <div className="space-y-3">
                {unconfirmed.map((goal) => {
                  const config = typeConfig[goal.type] || typeConfig.custom;
                  return (
                    <div
                      key={goal.id}
                      className="bg-zinc-850 border border-amber-500/20 rounded-xl p-4 flex items-center gap-4"
                    >
                      <div
                        className={`w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 ${config.color}`}
                      >
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-zinc-200">
                            {goal.name}
                          </h3>
                          <span className="text-xs bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">
                            auto-detected
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs ${config.color}`}>
                            {config.label}
                          </span>
                          <span className="text-xs text-zinc-600">|</span>
                          <code className="text-xs text-zinc-500 font-mono">
                            {goal.selector || goal.url_pattern}
                          </code>
                          <span className="text-xs text-zinc-600">|</span>
                          <span className="text-xs text-zinc-500">
                            {(goal.event_count ?? 0).toLocaleString()} events
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleConfirm(goal.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => handleDismiss(goal.id)}
                          className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Confirmed goals */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Confirmed Goals ({confirmed.length})
            </h2>
            <div className="space-y-3">
              {confirmed.map((goal) => {
                const config = typeConfig[goal.type] || typeConfig.custom;
                const isEditing = editingId === goal.id;
                return (
                  <div
                    key={goal.id}
                    className="bg-zinc-850 border border-zinc-800 rounded-xl p-4 flex items-center gap-4"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 ${config.color}`}
                    >
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(goal.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(goal.id)}
                            className="text-xs text-violet-400 hover:text-violet-300"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs text-zinc-500 hover:text-zinc-400"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-zinc-200">
                            {goal.name}
                          </h3>
                          {goal.auto_detected && (
                            <span className="text-xs bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
                              auto-detected
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="text-xs text-zinc-600">|</span>
                        <code className="text-xs text-zinc-500 font-mono">
                          {goal.selector || goal.url_pattern}
                        </code>
                        <span className="text-xs text-zinc-600">|</span>
                        <span className="text-xs text-zinc-500">
                          {(goal.event_count ?? 0).toLocaleString()} events
                        </span>
                      </div>
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => handleStartEdit(goal)}
                        className="text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0"
                        title="Edit goal"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}

              {confirmed.length === 0 && (
                <div className="text-center py-12 bg-zinc-850 border border-zinc-800 rounded-xl">
                  <p className="text-zinc-500 text-sm">
                    No confirmed goals yet. Review the auto-detected goals above.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
