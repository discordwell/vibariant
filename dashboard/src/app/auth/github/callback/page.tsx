"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { completeLogin } from "@/lib/auth";

function GitHubCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("No authorization code received from GitHub.");
      return;
    }

    let cancelled = false;

    async function exchangeCode() {
      try {
        const result = await api.loginWithGithub(code!);
        if (cancelled) return;
        await completeLogin(result);
        if (cancelled) return;
        router.push("/dashboard");
      } catch (err: unknown) {
        if (cancelled) return;
        const apiErr = err as { detail?: string };
        setError(apiErr.detail || "Failed to sign in with GitHub. Please try again.");
      }
    }

    exchangeCode();
    return () => { cancelled = true; };
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-red-400 mb-2">Sign in failed</h2>
            <p className="text-sm text-zinc-400">{error}</p>
            <a href="/login" className="text-violet-400 hover:text-violet-300 text-sm mt-4 inline-block">
              Back to login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400 text-sm">Signing in with GitHub...</p>
      </div>
    </div>
  );
}

export default function GitHubCallbackPage() {
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
      <GitHubCallbackInner />
    </Suspense>
  );
}
