"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ------------------------------------------------------------------ */
/*  Beta distribution Monte Carlo sampling                             */
/* ------------------------------------------------------------------ */

function randn(): number {
  const u1 = Math.max(Math.random(), Number.EPSILON);
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function gammaRandom(shape: number): number {
  if (shape < 1) {
    return gammaRandom(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      x = randn();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function betaRandom(a: number, b: number): number {
  const x = gammaRandom(a);
  const y = gammaRandom(b);
  return x / (x + y);
}

function calcProbBBeatsA(
  aConv: number,
  aTotal: number,
  bConv: number,
  bTotal: number
): number {
  const samples = 2000;
  let wins = 0;
  const alphaA = aConv + 1;
  const betaA = aTotal - aConv + 1;
  const alphaB = bConv + 1;
  const betaB = bTotal - bConv + 1;
  for (let i = 0; i < samples; i++) {
    if (betaRandom(alphaB, betaB) > betaRandom(alphaA, betaA)) wins++;
  }
  return wins / samples;
}

/* ------------------------------------------------------------------ */
/*  Demo component                                                     */
/* ------------------------------------------------------------------ */

interface VariantState {
  visitors: number;
  conversions: number;
}

const TRUE_RATE_A = 0.04;
const TRUE_RATE_B = 0.06;

export default function DemoSection() {
  const [a, setA] = useState<VariantState>({ visitors: 0, conversions: 0 });
  const [b, setB] = useState<VariantState>({ visitors: 0, conversions: 0 });
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(false);
  const hasStarted = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);

  const tick = useCallback(() => {
    setA((prev) => ({
      visitors: prev.visitors + 1,
      conversions:
        prev.conversions + (Math.random() < TRUE_RATE_A ? 1 : 0),
    }));
    setB((prev) => ({
      visitors: prev.visitors + 1,
      conversions:
        prev.conversions + (Math.random() < TRUE_RATE_B ? 1 : 0),
    }));
  }, []);

  // Auto-start when section becomes visible
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted.current) {
          hasStarted.current = true;
          setRunning(true);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Simulation loop
  useEffect(() => {
    if (!running) return;
    const ms = speed === 1 ? 600 : speed === 5 ? 120 : 50;
    const interval = setInterval(tick, ms);
    return () => clearInterval(interval);
  }, [running, speed, tick]);

  const prob = useMemo(() => {
    if (a.visitors > 5 && b.visitors > 5) {
      return calcProbBBeatsA(a.conversions, a.visitors, b.conversions, b.visitors);
    }
    return 0.5;
  }, [a, b]);

  const reset = () => {
    setA({ visitors: 0, conversions: 0 });
    setB({ visitors: 0, conversions: 0 });
    setRunning(true);
  };

  const rateA =
    a.visitors > 0 ? ((a.conversions / a.visitors) * 100).toFixed(1) : "0.0";
  const rateB =
    b.visitors > 0 ? ((b.conversions / b.visitors) * 100).toFixed(1) : "0.0";

  const probPct = (prob * 100).toFixed(0);
  const confident = prob > 0.95 || prob < 0.05;
  const winnerLabel = confident
    ? prob > 0.95 ? " — B wins!" : " — A wins!"
    : "";

  return (
    <section id="demo" ref={sectionRef} className="relative z-10 py-24 px-6">
      {/* Section decorations */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 hidden md:block"
          data-bifurcation-target="demo-left-decorations"
          data-bifurcation-side="blue"
        >
          <svg
            className="absolute left-[2%] top-[15%] w-[10%] h-[20%]"
            data-bifurcation-target="demo-left-decoration"
            data-bifurcation-side="blue"
            viewBox="0 0 100 60"
          >
            <rect x="10" y="10" width="6" height="6" fill="#60a5fa" opacity="0.08" />
            <rect x="38" y="28" width="6" height="6" fill="#3b82f6" opacity="0.06" />
            <rect x="62" y="5" width="6" height="6" fill="#60a5fa" opacity="0.09" />
            <rect x="82" y="42" width="6" height="6" fill="#60a5fa" opacity="0.07" />
          </svg>
        </div>
        <div
          className="absolute inset-0 hidden md:block"
          data-bifurcation-target="demo-right-decorations"
          data-bifurcation-side="orange"
        >
          <svg
            className="absolute right-[3%] top-[10%] w-[12%] h-[20%]"
            data-bifurcation-target="demo-right-decoration"
            data-bifurcation-side="orange"
            viewBox="0 0 200 200"
            fill="none"
          >
            <path
              d="M100,100 C100,68 135,48 165,60 C195,72 205,115 182,145 C159,175 115,180 85,158 C55,136 50,92 72,62"
              stroke="#fb923c"
              strokeWidth="1.5"
              opacity="0.07"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Watch it work
          </h2>
          <p className="text-zinc-500 text-lg">
            Live simulation: Variant B converts at 6% vs A&apos;s 4%. Watch
            Bayesian stats find the winner.
          </p>
        </div>

        {/* Variant cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          {/* Variant A */}
          <div
            data-bifurcation-target="demo-variant-a-card"
            data-bifurcation-side="blue"
            className="bg-zinc-850 border border-blue-500/20 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Variant A
              </span>
              <span className="text-xs text-zinc-600">True rate: 4%</span>
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 rounded-lg mb-5 cursor-default transition-colors" tabIndex={-1} aria-disabled="true">
              Sign Up Free
            </button>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Visitors</div>
                <div className="text-lg font-semibold text-zinc-200 tabular-nums">
                  {a.visitors}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Conversions</div>
                <div className="text-lg font-semibold text-zinc-200 tabular-nums">
                  {a.conversions}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Rate</div>
                <div className="text-lg font-semibold text-blue-400 tabular-nums">
                  {rateA}%
                </div>
              </div>
            </div>
          </div>

          {/* Variant B */}
          <div
            data-bifurcation-target="demo-variant-b-card"
            data-bifurcation-side="orange"
            className="bg-zinc-850 border border-orange-500/20 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Variant B
              </span>
              <span className="text-xs text-zinc-600">True rate: 6%</span>
            </div>
            <button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium py-2.5 rounded-lg mb-5 cursor-default transition-colors" tabIndex={-1} aria-disabled="true">
              Sign Up Free
            </button>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Visitors</div>
                <div className="text-lg font-semibold text-zinc-200 tabular-nums">
                  {b.visitors}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Conversions</div>
                <div className="text-lg font-semibold text-zinc-200 tabular-nums">
                  {b.conversions}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Rate</div>
                <div className="text-lg font-semibold text-orange-400 tabular-nums">
                  {rateB}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Probability bar + controls */}
        <div className="bg-zinc-850 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-zinc-400">P(B beats A)</span>
            <span
              className={`text-sm font-semibold tabular-nums ${
                confident ? "text-emerald-400" : "text-zinc-200"
              }`}
            >
              {probPct}%{winnerLabel}
            </span>
          </div>

          {/* Probability gauge */}
          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden mb-5" role="progressbar" aria-valuenow={Math.round(prob * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Probability that Variant B beats Variant A">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                confident
                  ? "bg-emerald-500"
                  : "bg-gradient-to-r from-blue-500 to-orange-500"
              }`}
              style={{ width: `${probPct}%` }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Speed:</span>
              {[1, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  aria-pressed={speed === s}
                  className={`text-xs px-2.5 py-1 rounded transition-colors ${
                    speed === s
                      ? "bg-zinc-700 text-zinc-200"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
            <button
              onClick={reset}
              className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 hover:border-zinc-600 px-3 py-1 rounded transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
