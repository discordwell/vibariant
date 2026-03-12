"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Wordmark from "@/components/brand/Wordmark";
import { api } from "@/lib/api";
import { setToken, setUser } from "@/lib/auth";
import type { User } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Decorative SVG layers for the bifurcation background              */
/* ------------------------------------------------------------------ */

function GeometricSide({ patternId }: { patternId: string }) {
  return (
    <div
      className="absolute inset-0 bifurcation-a pointer-events-none select-none"
      aria-hidden="true"
    >
      {/* Faint "A" watermark */}
      <span className="absolute left-[6%] top-[4%] md:left-[3%] md:top-[6%] text-[22vw] md:text-[14vw] font-bold text-blue-500/[0.03] leading-none">
        A
      </span>

      {/* Pixel dot grid */}
      <svg
        className="absolute left-[2%] top-[10%] w-[42%] h-[35%] md:w-[22%] md:h-[75%]"
        viewBox="0 0 200 200"
      >
        <defs>
          <pattern
            id={patternId}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <rect width="3" height="3" fill="#60a5fa" />
          </pattern>
        </defs>
        <rect width="200" height="200" fill={`url(#${patternId})`} opacity="0.06" />
      </svg>

      {/* Stepped waveform — digital signal */}
      <svg
        className="absolute left-[8%] top-[42%] w-[38%] h-[10%] md:left-[4%] md:top-[22%] md:w-[20%] md:h-[20%]"
        viewBox="0 0 200 80"
        fill="none"
      >
        <polyline
          points="0,60 25,60 25,25 50,25 50,45 75,45 75,15 100,15 100,55 125,55 125,35 150,35 150,70 175,70 175,20 200,20"
          stroke="#60a5fa"
          strokeWidth="2"
          opacity="0.12"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Second stepped waveform, offset */}
      <svg
        className="absolute left-[15%] bottom-[32%] w-[30%] h-[8%] md:left-[6%] md:top-[55%] md:w-[16%] md:h-[12%]"
        viewBox="0 0 180 60"
        fill="none"
      >
        <polyline
          points="0,45 20,45 20,20 45,20 45,40 70,40 70,10 95,10 95,50 120,50 120,25 145,25 145,55 180,55"
          stroke="#3b82f6"
          strokeWidth="1.5"
          opacity="0.07"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Circuit path with square nodes */}
      <svg
        className="absolute left-[12%] bottom-[10%] w-[32%] h-[18%] md:left-[6%] md:bottom-[8%] md:w-[16%] md:h-[28%]"
        viewBox="0 0 200 150"
        fill="none"
      >
        <path
          d="M10,130 L10,80 L80,80 L80,40 L150,40 L150,10"
          stroke="#60a5fa"
          strokeWidth="1.5"
          opacity="0.1"
          vectorEffect="non-scaling-stroke"
        />
        <rect x="6" y="126" width="8" height="8" fill="#60a5fa" opacity="0.12" />
        <rect x="76" y="76" width="8" height="8" fill="#60a5fa" opacity="0.12" />
        <rect x="146" y="6" width="8" height="8" fill="#60a5fa" opacity="0.12" />
      </svg>

      {/* Angular brackets */}
      <svg
        className="absolute right-[8%] top-[6%] w-[22%] h-[12%] md:left-[24%] md:top-[68%] md:w-[10%] md:h-[12%]"
        viewBox="0 0 100 80"
        fill="none"
      >
        <polyline
          points="15,10 50,10 50,40 85,40"
          stroke="#3b82f6"
          strokeWidth="1.5"
          opacity="0.08"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points="25,30 60,30 60,60 95,60"
          stroke="#60a5fa"
          strokeWidth="1"
          opacity="0.06"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Scattered pixel squares */}
      <svg
        className="absolute left-[28%] top-[22%] w-[18%] h-[10%] md:left-[16%] md:top-[42%] md:w-[8%] md:h-[10%]"
        viewBox="0 0 100 60"
      >
        <rect x="10" y="10" width="6" height="6" fill="#60a5fa" opacity="0.09" />
        <rect x="38" y="28" width="6" height="6" fill="#3b82f6" opacity="0.07" />
        <rect x="62" y="5" width="6" height="6" fill="#60a5fa" opacity="0.1" />
        <rect x="82" y="42" width="6" height="6" fill="#60a5fa" opacity="0.08" />
        <rect x="22" y="48" width="6" height="6" fill="#3b82f6" opacity="0.06" />
      </svg>
    </div>
  );
}

function OrganicSide() {
  return (
    <div
      className="absolute inset-0 bifurcation-b pointer-events-none select-none"
      aria-hidden="true"
    >
      {/* Faint "B" watermark */}
      <span className="absolute right-[6%] bottom-[4%] md:right-[3%] md:bottom-[6%] text-[22vw] md:text-[14vw] font-bold text-orange-500/[0.03] leading-none">
        B
      </span>

      {/* Large flowing S-curve */}
      <svg
        className="absolute right-[2%] bottom-[8%] w-[42%] h-[38%] md:right-[2%] md:top-[4%] md:w-[22%] md:h-[72%]"
        viewBox="0 0 200 200"
        fill="none"
      >
        <path
          d="M20,185 C60,185 55,15 100,15 C145,15 140,185 180,185"
          stroke="#fb923c"
          strokeWidth="2"
          opacity="0.12"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M35,195 C72,195 70,35 110,35 C150,35 148,195 185,195"
          stroke="#f97316"
          strokeWidth="1"
          opacity="0.06"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Overlapping circles */}
      <svg
        className="absolute right-[14%] top-[55%] w-[28%] h-[28%] md:right-[8%] md:top-[12%] md:w-[16%] md:h-[28%]"
        viewBox="0 0 200 200"
        fill="none"
      >
        <circle
          cx="80"
          cy="100"
          r="65"
          stroke="#fb923c"
          strokeWidth="1.5"
          opacity="0.08"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx="125"
          cy="85"
          r="48"
          stroke="#fb923c"
          strokeWidth="1"
          opacity="0.06"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx="100"
          cy="135"
          r="38"
          stroke="#f97316"
          strokeWidth="1"
          opacity="0.05"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Smooth sine wave */}
      <svg
        className="absolute left-[8%] bottom-[28%] w-[42%] h-[10%] md:right-[4%] md:left-auto md:top-[48%] md:w-[20%] md:h-[14%]"
        viewBox="0 0 200 60"
        fill="none"
      >
        <path
          d="M0,30 C25,8 50,52 75,30 C100,8 125,52 150,30 C175,8 200,52 200,30"
          stroke="#fb923c"
          strokeWidth="1.5"
          opacity="0.1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M0,42 C25,20 50,60 75,42 C100,20 125,60 150,42 C175,20 200,60 200,42"
          stroke="#f97316"
          strokeWidth="1"
          opacity="0.06"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Spiral */}
      <svg
        className="absolute right-[22%] bottom-[6%] w-[22%] h-[22%] md:right-[14%] md:bottom-[8%] md:w-[14%] md:h-[22%]"
        viewBox="0 0 200 200"
        fill="none"
      >
        <path
          d="M100,100 C100,68 135,48 165,60 C195,72 205,115 182,145 C159,175 115,180 85,158 C55,136 50,92 72,62"
          stroke="#fb923c"
          strokeWidth="1.5"
          opacity="0.08"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Soft ellipses */}
      <svg
        className="absolute right-[4%] top-[58%] w-[18%] h-[12%] md:right-[28%] md:top-[72%] md:w-[10%] md:h-[12%]"
        viewBox="0 0 100 80"
        fill="none"
      >
        <ellipse
          cx="50"
          cy="28"
          rx="42"
          ry="20"
          stroke="#fb923c"
          strokeWidth="1"
          opacity="0.06"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="45"
          cy="58"
          rx="32"
          ry="15"
          stroke="#f97316"
          strokeWidth="1"
          opacity="0.04"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Login page                                                        */
/* ------------------------------------------------------------------ */

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

  const pixelGridId = useId();

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* ===== BIFURCATION BACKGROUND ===== */}
      <GeometricSide patternId={pixelGridId} />
      <OrganicSide />

      {/* Dividing line — vertical on desktop, horizontal on mobile */}
      <div
        className="absolute z-[1] pointer-events-none
          left-0 right-0 top-1/2 h-px
          md:top-0 md:bottom-0 md:left-1/2 md:right-auto md:w-px md:h-auto
          bg-zinc-600/20"
      />

      {/* ===== LOGIN CONTENT ===== */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Logo / Brand — bifurcated colors */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight">
              <Wordmark />
            </h1>
            <p className="text-zinc-500 mt-2 text-sm">
              AB testing that understands your product
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-6 space-y-6">
            {emailSent ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-zinc-700/20 border border-zinc-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-6 h-6 text-zinc-300"
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
                  className="text-zinc-400 hover:text-zinc-300 text-sm mt-4 transition-colors"
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
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500/40 focus:border-zinc-500/40 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-500 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150"
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
    </div>
  );
}
