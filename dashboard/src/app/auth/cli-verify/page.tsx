"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

type Status = "verifying" | "success" | "error";

function CLIVerifyInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const deviceCode = searchParams.get("device_code");
    const token = searchParams.get("token");

    if (!deviceCode || !token) {
      setStatus("error");
      setError("Invalid verification link. Please request a new one from the CLI.");
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        await api.cliComplete(deviceCode!, token!);
        if (cancelled) return;
        setStatus("success");
      } catch (err: unknown) {
        if (cancelled) return;
        const apiErr = err as { detail?: string };
        setStatus("error");
        setError(apiErr.detail || "Verification failed. The link may have expired.");
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [searchParams]);

  if (status === "verifying") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Verifying CLI login...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-red-400 mb-2">Verification failed</h2>
            <p className="text-sm text-zinc-400">{error}</p>
            <p className="text-zinc-500 text-xs mt-4">
              Run <code className="text-zinc-400">vibariant auth login</code> to try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-emerald-400 mb-2">CLI authenticated</h2>
          <p className="text-sm text-zinc-400">
            Your terminal is now logged in. You can close this tab.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CLIVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-400 text-sm">Loading...</p>
          </div>
        </div>
      }
    >
      <CLIVerifyInner />
    </Suspense>
  );
}
