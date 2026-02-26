"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setToken, setUser } from "@/lib/auth";
import type { User } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGithubLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/github/callback`;
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email`;
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await api.sendMagicLink(email);
      setEmailSent(true);
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr.detail || "Failed to send magic link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // For development: simulate login
  const handleDevLogin = async () => {
    const mockToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXYtdXNlciIsImV4cCI6OTk5OTk5OTk5OX0.mock";
    const mockUser: User = {
      id: "dev-user",
      email: "dev@vibariant.com",
      name: "Dev User",
    };
    setToken(mockToken);
    setUser(mockUser);
    // Attempt to load project info after login; the dashboard useProject hook
    // will also handle the case where this fails or no project is cached yet.
    try {
      const projects = await api.getProjects();
      if (projects.length > 0) {
        const { setProject } = await import("@/lib/auth");
        setProject({
          id: projects[0].id,
          name: projects[0].name,
          project_token: projects[0].project_token,
          api_key: projects[0].api_key,
        });
      }
    } catch {
      // If project fetch fails (e.g. mock token), the useProject hook will retry later
    }
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-violet-400">Vib</span>
            <span className="text-zinc-100">ariant</span>
          </h1>
          <p className="text-zinc-500 mt-2 text-sm">
            AB testing that understands your product
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-6 space-y-6">
          {emailSent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-violet-500/10 border border-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-violet-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-zinc-100">
                Check your email
              </h2>
              <p className="text-zinc-400 text-sm mt-2">
                We sent a sign-in link to{" "}
                <span className="text-zinc-200">{email}</span>
              </p>
              <button
                onClick={() => setEmailSent(false)}
                className="text-violet-400 hover:text-violet-300 text-sm mt-4 transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              {/* GitHub OAuth */}
              <button
                onClick={handleGithubLogin}
                className="w-full flex items-center justify-center gap-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-zinc-100 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Continue with GitHub
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-zinc-850 px-3 text-zinc-500">or</span>
                </div>
              </div>

              {/* Email Magic Link */}
              <form onSubmit={handleMagicLink} className="space-y-3">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-medium text-zinc-400 mb-1.5"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    "Send magic link"
                  )}
                </button>
              </form>

              {error && (
                <p className="text-red-400 text-xs text-center">{error}</p>
              )}
            </>
          )}
        </div>

        {/* Dev login (only in development) */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-4 text-center">
            <button
              onClick={handleDevLogin}
              className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
            >
              Dev: Skip login
            </button>
          </div>
        )}

        <p className="text-zinc-600 text-xs text-center mt-6">
          By signing in, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
