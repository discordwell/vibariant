"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Experiment, CreateExperimentPayload } from "@/lib/api";
import { api } from "@/lib/api";
import { useProject } from "@/lib/hooks";

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-zinc-800", text: "text-zinc-400", dot: "bg-zinc-500" },
  running: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  paused: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  completed: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
};

type FilterStatus = "all" | "running" | "completed" | "draft" | "paused";

export default function ExperimentsPage() {
  const router = useRouter();
  const { projectId, loading: projectLoading, error: projectError } = useProject();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newVariants, setNewVariants] = useState("control, variant");
  const [newTraffic, setNewTraffic] = useState("100");

  const fetchExperiments = useCallback(async () => {
    if (!projectId) {
      if (!projectLoading) setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const exps = await api.getExperiments(projectId);
      setExperiments(exps);
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr.detail || "Failed to load experiments");
    } finally {
      setLoading(false);
    }
  }, [projectId, projectLoading]);

  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !newName.trim() || !newKey.trim()) return;

    setCreating(true);
    try {
      const payload: CreateExperimentPayload = {
        project_id: projectId,
        key: newKey.trim(),
        name: newName.trim(),
        variant_keys: newVariants.split(",").map((v) => v.trim()).filter(Boolean),
        traffic_percentage: Math.min(1, Math.max(0, parseFloat(newTraffic) / 100)),
      };
      const created = await api.createExperiment(payload);
      setShowCreateModal(false);
      setNewName("");
      setNewKey("");
      setNewVariants("control, variant");
      setNewTraffic("100");
      // Navigate to the new experiment
      router.push(`/dashboard/experiments/${created.id}`);
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr.detail || "Failed to create experiment");
    } finally {
      setCreating(false);
    }
  };

  const isLoading = projectLoading || loading;
  const displayError = projectError || error;

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
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          New Experiment
        </button>
      </div>

      {/* Error state */}
      {displayError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-400">{displayError}</p>
        </div>
      )}

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
      {isLoading ? (
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
                  Key
                </th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3">
                  Variants
                </th>
                <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3">
                  Traffic
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((exp) => {
                const status = statusColors[exp.status] || statusColors.draft;
                return (
                  <tr
                    key={exp.id}
                    className="hover:bg-zinc-800/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/dashboard/experiments/${exp.id}`)}
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dashboard/experiments/${exp.id}`}
                        className="text-sm font-medium text-zinc-100 hover:text-violet-300 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {exp.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <code className="text-xs text-zinc-500 font-mono">
                        {exp.key || "-"}
                      </code>
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
                      {(exp.variant_keys ?? []).join(", ")}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-zinc-300 text-right">
                      {((exp.traffic_percentage ?? 1) * 100).toFixed(0)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-zinc-500 text-sm">
                {experiments.length === 0
                  ? "No experiments yet. Create your first one!"
                  : "No experiments match this filter."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create Experiment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">
              Create Experiment
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Experiment Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Hero CTA Color"
                  required
                  className="w-full bg-zinc-850 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Experiment Key
                </label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g., hero-cta-color"
                  required
                  className="w-full bg-zinc-850 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                />
                <p className="text-xs text-zinc-600 mt-1">
                  Used in SDK code to reference this experiment
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Variant Keys (comma-separated)
                </label>
                <input
                  type="text"
                  value={newVariants}
                  onChange={(e) => setNewVariants(e.target.value)}
                  placeholder="control, variant"
                  className="w-full bg-zinc-850 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Traffic Percentage
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={newTraffic}
                    onChange={(e) => setNewTraffic(e.target.value)}
                    min="1"
                    max="100"
                    className="w-24 bg-zinc-850 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                  />
                  <span className="text-sm text-zinc-500">%</span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newName.trim() || !newKey.trim()}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
