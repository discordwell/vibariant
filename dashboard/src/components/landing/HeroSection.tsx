"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function HeroSection() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation after mount
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative z-10 min-h-[90vh] flex flex-col items-center justify-center px-6 pt-20 pb-16">
      {/* Section decorations */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 hidden md:block"
          data-bifurcation-target="hero-left-decorations"
          data-bifurcation-side="blue"
        >
          {/* Geometric: pixel grid (left) */}
          <svg
            className="absolute left-[2%] top-[8%] w-[15%] h-[40%]"
            data-bifurcation-target="hero-left-decoration"
            data-bifurcation-side="blue"
            viewBox="0 0 200 200"
          >
            <defs>
              <pattern
                id="hero-grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <rect width="3" height="3" fill="#60a5fa" />
              </pattern>
            </defs>
            <rect
              width="200"
              height="200"
              fill="url(#hero-grid)"
              opacity="0.06"
            />
          </svg>

          {/* Geometric: stepped waveform (left) */}
          <svg
            className="absolute left-[4%] bottom-[20%] w-[18%] h-[15%]"
            viewBox="0 0 200 80"
            fill="none"
          >
            <polyline
              points="0,60 25,60 25,25 50,25 50,45 75,45 75,15 100,15 100,55 125,55 125,35 150,35 150,70 175,70 175,20 200,20"
              stroke="#60a5fa"
              strokeWidth="2"
              opacity="0.1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        <div
          className="absolute inset-0 hidden md:block"
          data-bifurcation-target="hero-right-decorations"
          data-bifurcation-side="orange"
        >
          {/* Organic: S-curve (right) */}
          <svg
            className="absolute right-[2%] top-[5%] w-[16%] h-[50%]"
            data-bifurcation-target="hero-right-decoration"
            data-bifurcation-side="orange"
            viewBox="0 0 200 200"
            fill="none"
          >
            <path
              d="M20,185 C60,185 55,15 100,15 C145,15 140,185 180,185"
              stroke="#fb923c"
              strokeWidth="2"
              opacity="0.1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Organic: circles (right) */}
          <svg
            className="absolute right-[6%] bottom-[15%] w-[12%] h-[25%]"
            viewBox="0 0 200 200"
            fill="none"
          >
            <circle
              cx="80"
              cy="100"
              r="65"
              stroke="#fb923c"
              strokeWidth="1.5"
              opacity="0.07"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="125"
              cy="85"
              r="48"
              stroke="#fb923c"
              strokeWidth="1"
              opacity="0.05"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>

      {/* Headline */}
      <div
        className={`text-center max-w-3xl mx-auto mb-14 transition-all duration-700 ${
          visible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-6"
        }`}
      >
        {/* human-requested: full headline blue→white→orange gradient, scale to screen width */}
        <h1 className="font-bold tracking-tight mb-6 leading-[1.1] bg-gradient-to-r from-blue-400 via-white to-orange-400 bg-clip-text text-transparent text-[clamp(2rem,5.5vw,4.5rem)]">
          A/B testing for apps with 12 users and a dream
        </h1>
        <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto">
          Bayesian stats that work with tiny samples. Ship experiments in 3
          lines of code. Know what&apos;s winning before your traffic does.
        </p>
        {/* human-requested: buttons match their side's color */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <Link
            href="/login"
            data-bifurcation-target="hero-start-cta"
            data-bifurcation-side="blue"
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-lg transition-all duration-150 text-sm"
          >
            Start Free
          </Link>
          <a
            href="#demo"
            data-bifurcation-target="hero-watch-cta"
            data-bifurcation-side="orange"
            className="bg-orange-600 hover:bg-orange-500 text-white font-medium px-6 py-3 rounded-lg transition-all duration-150 text-sm"
          >
            Watch Demo
          </a>
        </div>
      </div>

      {/* Two cards: Code (left/blue) + Dashboard preview (right/orange) */}
      <div
        className={`w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-700 delay-300 ${
          visible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-8"
        }`}
      >
        {/* Code snippet card */}
        <div className="bg-zinc-850 border border-blue-500/20 rounded-xl p-5 font-mono text-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
            <span className="text-zinc-600 text-xs ml-2">
              signup-button.tsx
            </span>
          </div>
          <pre className="text-zinc-300 whitespace-pre leading-relaxed overflow-x-auto">
            <code>
              <span className="text-violet-400">import</span>
              {" { "}
              <span className="text-blue-300">useVariant</span>
              {" } "}
              <span className="text-violet-400">from</span>
              <span className="text-emerald-400">
                {" '"}@vibariant/sdk{"'"}
              </span>
              {"\n\n"}
              <span className="text-violet-400">function</span>
              {" "}
              <span className="text-blue-300">SignupButton</span>
              {"() {\n"}
              {"  "}
              <span className="text-violet-400">const</span>
              {" color = "}
              <span className="text-blue-300">useVariant</span>
              {"("}
              <span className="text-emerald-400">{"'signup-color'"}</span>
              {")\n\n"}
              {"  "}
              <span className="text-violet-400">return</span>
              {" (\n"}
              {"    <"}
              <span className="text-blue-300">button</span>
              {" "}
              <span className="text-orange-300">style</span>
              {"={{ "}
              <span className="text-zinc-400">background</span>
              {": color }}>\n"}
              {"      Sign Up Free\n"}
              {"    </"}
              <span className="text-blue-300">button</span>
              {">\n"}
              {"  )\n}"}
            </code>
          </pre>
        </div>

        {/* Dashboard preview card */}
        <div className="bg-zinc-850 border border-orange-500/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-300">signup-color</h3>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Running
            </span>
          </div>

          {/* Variant bars */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400">Variant A &middot; Blue</span>
                <span className="text-zinc-500">4.2%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500/60 rounded-full transition-all duration-1000"
                  style={{ width: "42%" }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-400">
                  Variant B &middot; Orange
                </span>
                <span className="text-orange-400 font-medium">6.1%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500/60 rounded-full transition-all duration-1000"
                  style={{ width: "61%" }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
            <div className="text-xs text-zinc-500">
              P(B beats A):{" "}
              <span className="text-orange-400 font-medium">87.3%</span>
            </div>
            <div className="text-xs text-zinc-500">284 visitors</div>
          </div>
        </div>
      </div>
    </section>
  );
}
