"use client";

import { useEffect, useState, useCallback } from "react";
import type { Goal } from "@/lib/api";
import { api } from "@/lib/api";
import { useProject } from "@/lib/hooks";

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
  const { projectId, loading: projectLoading, error: projectError } = useProject();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    if (!projectId) {
      if (!projectLoading) setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.getGoals(projectId);
      setGoals(data);
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr.detail || "Failed to load goals");
    } finally {
      setLoading(false);
    }
  }, [projectId, projectLoading]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleConfirm = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await api.confirmGoal(id);
      setGoals((prev) =>
        prev.map((g) => (g.id === id ? { ...g, ...updated } : g))
      );
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr.detail || "Failed to confirm goal");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (id: string) => {
    setActionLoading(id);
    try {
      // Dismiss = set confirmed to false (we don't delete, just mark unconfirmed)
      // But since it's already unconfirmed, we filter it from view.
      // If the API supported deletion, we'd call delete here. For now, just
      // confirm with false to acknowledge we've seen it.
      await api.updateGoal(id, { confirmed: false });
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr.detail || "Failed to dismiss goal");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setEditLabel(goal.label ?? goal.name ?? "");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editLabel.trim()) {
      setEditingId(null);
      return;
    }
    setActionLoading(id);
    try {
      const updated = await api.updateGoal(id, { label: editLabel.trim() });
      setGoals((prev) =>
        prev.map((g) => (g.id === id ? { ...g, ...updated, label: updated.label } : g))
      );
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr.detail || "Failed to update goal");
    } finally {
      setEditingId(null);
      setActionLoading(null);
    }
  };

  const isLoading = projectLoading || loading;
  const displayError = projectError || error;

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

      {/* Error state */}
      {displayError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-400">{displayError}</p>
        </div>
      )}

      {isLoading ? (
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
                  const isActioning = actionLoading === goal.id;
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
                            {goal.label || goal.name || "Untitled Goal"}
                          </h3>
                          <span className="text-xs bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">
                            auto-detected
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs ${config.color}`}>
                            {config.label}
                          </span>
                          {goal.trigger && (
                            <>
                              <span className="text-xs text-zinc-600">|</span>
                              <code className="text-xs text-zinc-500 font-mono truncate max-w-[200px]">
                                {JSON.stringify(goal.trigger)}
                              </code>
                            </>
                          )}
                          {goal.confidence != null && (
                            <>
                              <span className="text-xs text-zinc-600">|</span>
                              <span className="text-xs text-zinc-500">
                                {(goal.confidence * 100).toFixed(0)}% confidence
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleConfirm(goal.id)}
                          disabled={isActioning}
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {isActioning ? "..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => handleDismiss(goal.id)}
                          disabled={isActioning}
                          className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
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
                const isActioning = actionLoading === goal.id;
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
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(goal.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(goal.id)}
                            disabled={isActioning}
                            className="text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50"
                          >
                            {isActioning ? "..." : "Save"}
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
                            {goal.label || goal.name || "Untitled Goal"}
                          </h3>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs ${config.color}`}>
                          {config.label}
                        </span>
                        {goal.trigger && (
                          <>
                            <span className="text-xs text-zinc-600">|</span>
                            <code className="text-xs text-zinc-500 font-mono truncate max-w-[200px]">
                              {JSON.stringify(goal.trigger)}
                            </code>
                          </>
                        )}
                        {goal.confidence != null && (
                          <>
                            <span className="text-xs text-zinc-600">|</span>
                            <span className="text-xs text-zinc-500">
                              {(goal.confidence * 100).toFixed(0)}% confidence
                            </span>
                          </>
                        )}
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

          {/* Empty state for no goals at all */}
          {goals.length === 0 && (
            <div className="text-center py-16 bg-zinc-850 border border-zinc-800 rounded-xl">
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
                No goals detected yet
              </h3>
              <p className="text-zinc-500 text-sm max-w-md mx-auto">
                Goals will appear here once the SDK detects conversion events on your site. Make sure the SDK is installed and tracking.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
