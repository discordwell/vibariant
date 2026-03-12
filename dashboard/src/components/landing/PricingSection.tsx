import Link from "next/link";

const tiers = [
  {
    name: "Free",
    side: "blue" as const,
    price: "$0",
    period: "forever",
    description: "Kick the tires. No credit card.",
    cta: "Start Free",
    highlighted: false,
    features: [
      "1 project",
      "2 concurrent experiments",
      "1K events / month",
      "Bayesian stats engine",
      "Real-time dashboard",
    ],
  },
  {
    name: "Pro",
    side: "bridge" as const,
    price: "$29",
    period: "/mo",
    description: "For solo devs and small teams shipping fast.",
    cta: "Start Free",
    highlighted: true,
    features: [
      "Unlimited projects",
      "Unlimited experiments",
      "100K events / month",
      "Advanced stats + bandits",
      "CLI + AI agent tools",
      "Priority support",
    ],
  },
  {
    name: "Team",
    side: "orange" as const,
    price: "$99",
    period: "/mo",
    description: "Collaborate, control, and scale.",
    cta: "Start Free",
    highlighted: false,
    features: [
      "Everything in Pro",
      "1M events / month",
      "SSO + team management",
      "Collaborative experiments",
      "Audit logs",
      "Dedicated support",
    ],
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="relative z-10 py-24 px-6">
      {/* Section decorations */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 hidden md:block"
          data-bifurcation-target="pricing-left-decorations"
          data-bifurcation-side="blue"
        >
          <svg
            className="absolute left-[4%] bottom-[15%] w-[14%] h-[18%]"
            data-bifurcation-target="pricing-left-decoration"
            data-bifurcation-side="blue"
            viewBox="0 0 200 80"
            fill="none"
          >
            <polyline
              points="0,45 20,45 20,20 45,20 45,40 70,40 70,10 95,10 95,50 120,50 120,25 145,25 145,55 180,55"
              stroke="#3b82f6"
              strokeWidth="1.5"
              opacity="0.06"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <div
          className="absolute inset-0 hidden md:block"
          data-bifurcation-target="pricing-right-decorations"
          data-bifurcation-side="orange"
        >
          <svg
            className="absolute right-[4%] top-[20%] w-[14%] h-[30%]"
            data-bifurcation-target="pricing-right-decoration"
            data-bifurcation-side="orange"
            viewBox="0 0 200 200"
            fill="none"
          >
            <circle
              cx="100"
              cy="100"
              r="80"
              stroke="#fb923c"
              strokeWidth="1"
              opacity="0.05"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="100"
              cy="100"
              r="50"
              stroke="#fb923c"
              strokeWidth="1"
              opacity="0.04"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Simple pricing. No enterprise sales call.
          </h2>
          <p className="text-zinc-500 text-lg">
            Start free. Upgrade when you&apos;re ready.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              data-bifurcation-target={`pricing-${tier.name.toLowerCase()}-tier`}
              data-bifurcation-side={
                tier.side === "bridge" ? undefined : tier.side
              }
              className={`bg-zinc-850 border rounded-xl p-6 flex flex-col ${
                tier.side === "blue"
                  ? "border-blue-500/20 ring-1 ring-blue-500/8 bg-blue-500/[0.03]"
                  : tier.side === "orange"
                    ? "border-orange-500/20 ring-1 ring-orange-500/8 bg-orange-500/[0.03]"
                    : "border-orange-500/30 ring-1 ring-orange-500/10 bg-gradient-to-br from-blue-500/[0.04] via-zinc-850 to-orange-500/[0.06]"
              }`}
            >
              {tier.highlighted && (
                <div className="text-xs font-medium text-orange-400 uppercase tracking-wider mb-3">
                  Most Popular
                </div>
              )}

              <h3 className="text-xl font-bold text-zinc-100">{tier.name}</h3>
              <div className="mt-2 mb-1">
                <span className="text-3xl font-bold text-zinc-100">
                  {tier.price}
                </span>
                <span className="text-zinc-500 text-sm">{tier.period}</span>
              </div>
              <p className="text-sm text-zinc-500 mb-6">{tier.description}</p>

              <ul className="space-y-2.5 mb-8 flex-1">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm text-zinc-300"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        tier.highlighted ? "text-orange-400" : "text-zinc-600"
                      }`}
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/login"
                className={`w-full text-center text-sm font-medium py-2.5 rounded-lg transition-all duration-150 ${
                  tier.highlighted
                    ? "bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-500 hover:to-orange-500 text-white"
                    : "bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-zinc-200"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
