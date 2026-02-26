"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { completeLogin } from "@/lib/auth";

function VerifyMagicLinkInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("No verification token found. Please request a new magic link.");
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const result = await api.verifyMagicLink(token!);
        if (cancelled) return;
        await completeLogin(result);
        if (cancelled) return;
        router.push("/dashboard");
      } catch (err: unknown) {
        if (cancelled) return;
        const apiErr = err as { detail?: string };
        setError(apiErr.detail || "Magic link expired or invalid. Please request a new one.");
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-red-400 mb-2">Verification failed</h2>
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
        <p className="text-zinc-400 text-sm">Verifying your magic link...</p>
      </div>
    </div>
  );
}

export default function VerifyMagicLinkPage() {
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
      <VerifyMagicLinkInner />
    </Suspense>
  );
}
