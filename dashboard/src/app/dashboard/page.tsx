"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardOverview, Experiment } from "@/lib/api";
import ExperimentCard from "@/components/experiment-card";

// Placeholder data for development
const mockOverview: DashboardOverview = {
  active_experiments: 3,
  total_visitors: 12_847,
  total_events: 45_231,
  recent_events: [
    {
      id: "1",
      type: "conversion",
      experiment_name: "Hero CTA Color",
      variant_name: "Green Button",
      timestamp: new Date(Date.now() - 120000).toISOString(),
    },
    {
      id: "2",
      type: "pageview",
      experiment_name: "Pricing Layout",
      variant_name: "Side-by-side",
      timestamp: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: "3",
      type: "click",
      experiment_name: "Onboarding Flow",
      variant_name: "Progressive",
      timestamp: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: "4",
      type: "conversion",
      experiment_name: "Hero CTA Color",
      variant_name: "Original",
      timestamp: new Date(Date.now() - 900000).toISOString(),
    },
    {
      id: "5",
      type: "form_submit",
      experiment_name: "Pricing Layout",
      variant_name: "Stacked",
      timestamp: new Date(Date.now() - 1200000).toISOString(),
    },
  ],
  top_experiments: [],
};

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
];

function timeAgo(timestamp: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(timestamp).getTime()) / 1000
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const eventTypeIcons: Record<string, { color: string; label: string }> = {
  conversion: { color: "text-emerald-400", label: "Conversion" },
  pageview: { color: "text-blue-400", label: "Pageview" },
  click: { color: "text-violet-400", label: "Click" },
  form_submit: { color: "text-amber-400", label: "Form Submit" },
};

export default function DashboardHome() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call with placeholder data
    const timer = setTimeout(() => {
      setOverview(mockOverview);
      setExperiments(mockExperiments);
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Project overview and recent activity
          </p>
        </div>
        <Link
          href="/dashboard/experiments"
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          New Experiment
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {loading ? (
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
                Active Experiments
              </p>
              <p className="text-3xl font-bold text-zinc-100 mt-2">
                {overview?.active_experiments}
              </p>
            </div>
            <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Total Visitors
              </p>
              <p className="text-3xl font-bold text-zinc-100 mt-2">
                {overview?.total_visitors.toLocaleString()}
              </p>
            </div>
            <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Total Events
              </p>
              <p className="text-3xl font-bold text-zinc-100 mt-2">
                {overview?.total_events.toLocaleString()}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Active Experiments */}
        <div className="col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-100">
            Active Experiments
          </h2>
          {loading ? (
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
          ) : (
            <div className="space-y-4">
              {experiments.map((exp) => (
                <ExperimentCard key={exp.id} experiment={exp} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Events */}
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">
            Recent Events
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton h-14 w-full" />
              ))}
            </div>
          ) : (
            <div className="bg-zinc-850 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
              {overview?.recent_events.map((event) => {
                const typeInfo = eventTypeIcons[event.type] || {
                  color: "text-zinc-400",
                  label: event.type,
                };
                return (
                  <div key={event.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {timeAgo(event.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 mt-0.5 truncate">
                      {event.experiment_name}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {event.variant_name}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
