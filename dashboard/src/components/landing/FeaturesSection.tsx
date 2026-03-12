const features = [
  {
    title: "Bayesian Stats",
    description:
      "Works with tiny samples. No minimum traffic required — get answers with 50 visitors, not 50,000.",
    side: "blue" as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path
          d="M3 20h18M5 20V10m4 10V4m4 16v-8m4 8V7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: "Smart Bandits",
    description:
      "Auto-allocate traffic to winning variants. Thompson sampling means fewer losers see the losing variant.",
    side: "orange" as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path
          d="M4 12h3m10 0h3M12 4v3m0 10v3m-5.657-2.343l2.121-2.121m7.072-7.072l2.121-2.121M6.343 6.343l2.121 2.121m7.072 7.072l2.121 2.121"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: "3 Lines of Code",
    description:
      "React hooks, vanilla JS, or server-side. Import, call, ship. The SDK does the rest.",
    side: "blue" as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path
          d="M8 7l-5 5 5 5m8-10l5 5-5 5M14 4l-4 16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "CLI + AI Agent Tools",
    description:
      "AI-native workflow. Let Claude create experiments, check results, and ship winners from your terminal.",
    side: "orange" as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path
          d="M4 17l6-6-6-6m8 14h8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Real-time Dashboard",
    description:
      "Watch conversions, confidence intervals, and winner decisions update live. No refresh needed.",
    side: "blue" as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path
          d="M2 12c2-4 5.5-7 10-7s8 3 10 7c-2 4-5.5 7-10 7s-8-3-10-7z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "Privacy First",
    description:
      "No cookies, no PII, no third-party scripts. Just anonymous event counts and math.",
    side: "orange" as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path
          d="M12 2l8 4v6c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V6l8-4z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M9 12l2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="relative z-10 py-24 px-6">
      {/* Section decorations */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 hidden md:block"
          data-bifurcation-target="features-left-decorations"
          data-bifurcation-side="blue"
        >
          {/* Geometric: circuit path (left) */}
          <svg
            className="absolute left-[3%] top-[10%] w-[14%] h-[30%]"
            data-bifurcation-target="features-left-decoration"
            data-bifurcation-side="blue"
            viewBox="0 0 200 150"
            fill="none"
          >
            <path
              d="M10,130 L10,80 L80,80 L80,40 L150,40 L150,10"
              stroke="#60a5fa"
              strokeWidth="1.5"
              opacity="0.08"
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x="6"
              y="126"
              width="8"
              height="8"
              fill="#60a5fa"
              opacity="0.1"
            />
            <rect
              x="76"
              y="76"
              width="8"
              height="8"
              fill="#60a5fa"
              opacity="0.1"
            />
            <rect
              x="146"
              y="6"
              width="8"
              height="8"
              fill="#60a5fa"
              opacity="0.1"
            />
          </svg>
        </div>

        <div
          className="absolute inset-0 hidden md:block"
          data-bifurcation-target="features-right-decorations"
          data-bifurcation-side="orange"
        >
          {/* Organic: sine wave (right) */}
          <svg
            className="absolute right-[3%] top-[50%] w-[16%] h-[12%]"
            data-bifurcation-target="features-right-decoration"
            data-bifurcation-side="orange"
            viewBox="0 0 200 60"
            fill="none"
          >
            <path
              d="M0,30 C25,8 50,52 75,30 C100,8 125,52 150,30 C175,8 200,52 200,30"
              stroke="#fb923c"
              strokeWidth="1.5"
              opacity="0.08"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="text-zinc-500 text-lg">
            Built for indie devs, small teams, and anyone who ships fast.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              data-bifurcation-target={`feature-card-${index + 1}`}
              data-bifurcation-side={feature.side}
              className={`bg-zinc-850 border rounded-xl p-6 transition-colors hover:bg-zinc-800/50 ${
                feature.side === "blue"
                  ? "border-blue-500/10 hover:border-blue-500/20"
                  : "border-orange-500/10 hover:border-orange-500/20"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
                  feature.side === "blue"
                    ? "bg-blue-500/10 text-blue-400"
                    : "bg-orange-500/10 text-orange-400"
                }`}
              >
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
