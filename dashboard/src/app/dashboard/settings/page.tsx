"use client";

import { useEffect, useState } from "react";
import type { ApiKey } from "@/lib/api";

interface ProjectSettings {
  id: string;
  name: string;
  token: string;
}

const mockProject: ProjectSettings = {
  id: "proj-abc123",
  name: "My SaaS App",
  token: "vv_proj_a1b2c3d4e5f6g7h8i9j0",
};

const mockApiKeys: ApiKey[] = [
  {
    id: "key-1",
    name: "Production Server",
    prefix: "vv_sk_prod_",
    created_at: "2026-02-10T10:00:00Z",
    last_used_at: "2026-02-26T08:30:00Z",
  },
  {
    id: "key-2",
    name: "Staging",
    prefix: "vv_sk_stag_",
    created_at: "2026-02-15T10:00:00Z",
    last_used_at: "2026-02-25T14:22:00Z",
  },
];

export default function SettingsPage() {
  const [project, setProject] = useState<ProjectSettings | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProject(mockProject);
      setProjectName(mockProject.name);
      setApiKeys(mockApiKeys);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleCopyToken = async () => {
    if (project) {
      await navigator.clipboard.writeText(project.token);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const handleSaveProject = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 500));
    setProject((prev) => (prev ? { ...prev, name: projectName } : null));
    setSaving(false);
  };

  const handleCreateKey = () => {
    if (!newKeyName.trim()) return;
    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name: newKeyName.trim(),
      prefix: `vv_sk_${newKeyName.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 4)}_`,
      created_at: new Date().toISOString(),
      last_used_at: null,
    };
    setApiKeys((prev) => [...prev, newKey]);
    setShowNewKey(`vv_sk_${Date.now()}_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`);
    setNewKeyName("");
  };

  const handleRevokeKey = (id: string) => {
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
  };

  if (loading) {
    return (
      <div>
        <div className="skeleton h-8 w-32 mb-2" />
        <div className="skeleton h-4 w-64 mb-8" />
        <div className="space-y-6">
          <div className="skeleton h-48 w-full rounded-xl" />
          <div className="skeleton h-48 w-full rounded-xl" />
          <div className="skeleton h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Manage your project configuration and API keys
        </p>
      </div>

      <div className="space-y-8">
        {/* Project Token */}
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-1">
            Project Token
          </h2>
          <p className="text-zinc-500 text-sm mb-4">
            Use this token in your SDK initialization to identify your project.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 font-mono text-sm text-zinc-300">
              {project?.token}
            </div>
            <button
              onClick={handleCopyToken}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tokenCopied
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300"
              }`}
            >
              {tokenCopied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="mt-4 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            <p className="text-xs text-zinc-500 mb-2">Quick start:</p>
            <pre className="text-xs text-zinc-400 font-mono overflow-x-auto">
              <code>{`import { VibeVariant } from '@vibevariant/sdk';

VibeVariant.init({
  token: '${project?.token}',
});`}</code>
            </pre>
          </div>
        </div>

        {/* Project Configuration */}
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-1">
            Project Configuration
          </h2>
          <p className="text-zinc-500 text-sm mb-4">
            Update your project settings.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Project ID
              </label>
              <p className="text-sm text-zinc-500 font-mono">{project?.id}</p>
            </div>
            <button
              onClick={handleSaveProject}
              disabled={saving || projectName === project?.name}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-1">
            API Keys
          </h2>
          <p className="text-zinc-500 text-sm mb-4">
            Manage server-side API keys for backend integration.
          </p>

          {/* New key creation */}
          <div className="flex items-center gap-3 mb-6">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateKey();
              }}
              placeholder="Key name (e.g., Production Server)"
              className="flex-1 max-w-sm bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
            />
            <button
              onClick={handleCreateKey}
              disabled={!newKeyName.trim()}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Create Key
            </button>
          </div>

          {/* Show newly created key */}
          {showNewKey && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-300">
                    API key created! Copy it now - you won&apos;t see it again.
                  </p>
                  <code className="block mt-2 text-xs text-zinc-300 font-mono bg-zinc-900 px-3 py-2 rounded break-all">
                    {showNewKey}
                  </code>
                </div>
                <button
                  onClick={() => setShowNewKey(null)}
                  className="text-zinc-500 hover:text-zinc-400 flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Key list */}
          <div className="space-y-3">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    {key.name}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <code className="text-xs text-zinc-500 font-mono">
                      {key.prefix}...
                    </code>
                    <span className="text-xs text-zinc-600">
                      Created{" "}
                      {new Date(key.created_at).toLocaleDateString()}
                    </span>
                    {key.last_used_at && (
                      <>
                        <span className="text-xs text-zinc-700">|</span>
                        <span className="text-xs text-zinc-600">
                          Last used{" "}
                          {new Date(key.last_used_at).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeKey(key.id)}
                  className="text-red-400/60 hover:text-red-400 text-xs font-medium transition-colors"
                >
                  Revoke
                </button>
              </div>
            ))}

            {apiKeys.length === 0 && (
              <div className="text-center py-8">
                <p className="text-zinc-500 text-sm">
                  No API keys yet. Create one to get started with backend
                  integration.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
