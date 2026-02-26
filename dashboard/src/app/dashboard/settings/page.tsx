"use client";

import { useState } from "react";
import { useProject } from "@/lib/hooks";

export default function SettingsPage() {
  const { project, loading } = useProject();
  const [tokenCopied, setTokenCopied] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  const handleCopyToken = async () => {
    if (project?.project_token) {
      await navigator.clipboard.writeText(project.project_token);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const handleCopyApiKey = async () => {
    if (project?.api_key) {
      await navigator.clipboard.writeText(project.api_key);
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 2000);
    }
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
          Project configuration, tokens, and API keys
        </p>
      </div>

      <div className="space-y-8">
        {/* Project Info */}
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-1">
            Project Information
          </h2>
          <p className="text-zinc-500 text-sm mb-4">
            Your project details.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Project Name
              </label>
              <p className="text-sm text-zinc-200">{project?.name || "-"}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Project ID
              </label>
              <p className="text-sm text-zinc-500 font-mono">{project?.id || "-"}</p>
            </div>
          </div>
        </div>

        {/* Project Token */}
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-1">
            Project Token
          </h2>
          <p className="text-zinc-500 text-sm mb-4">
            Use this token in your SDK initialization to identify your project.
            This is a public token safe to include in client-side code.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 font-mono text-sm text-zinc-300">
              {project?.project_token || "-"}
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
              <code>{`import { Vibariant } from '@vibariant/sdk';

Vibariant.init({
  token: '${project?.project_token || "vv_proj_..."}',
});`}</code>
            </pre>
          </div>
        </div>

        {/* API Key */}
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-1">
            API Key
          </h2>
          <p className="text-zinc-500 text-sm mb-4">
            Use this key for server-side API access. Keep this secret and never
            expose it in client-side code.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 font-mono text-sm text-zinc-300">
              {project?.api_key || "-"}
            </div>
            <button
              onClick={handleCopyApiKey}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                apiKeyCopied
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300"
              }`}
            >
              {apiKeyCopied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="mt-4 bg-red-500/5 border border-red-500/10 rounded-lg p-3">
            <p className="text-xs text-red-400/80">
              This is a secret key. Do not share it publicly or commit it to version control.
              Use environment variables to store it securely.
            </p>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-zinc-850 border border-red-500/20 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-red-400 mb-1">
            Danger Zone
          </h2>
          <p className="text-zinc-500 text-sm mb-4">
            Irreversible actions. Proceed with caution.
          </p>
          <button
            className="bg-zinc-800 hover:bg-red-600/20 border border-zinc-700 hover:border-red-500/30 text-red-400 text-sm font-medium px-4 py-2 rounded-lg transition-all"
            disabled
            title="Not yet implemented"
          >
            Delete Project
          </button>
          <p className="text-xs text-zinc-600 mt-2">
            Project deletion is not yet available. Contact support if needed.
          </p>
        </div>
      </div>
    </div>
  );
}
