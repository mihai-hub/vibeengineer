import React, { useState } from "react";

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const LightningIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L4.5 13.5H11L10 22L20 10H13.5L13 2Z" />
  </svg>
);

const SyncIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

// ─── Mock Dashboard ───────────────────────────────────────────────────────────
const MockDashboard = () => {
  const tasks = [
    { name: "Design system update", status: "In Progress", progress: 72, color: "bg-violet-500", user: "AK" },
    { name: "API rate limiting", status: "Review", progress: 90, color: "bg-cyan-500", user: "MJ" },
    { name: "Onboarding flow", status: "Todo", progress: 15, color: "bg-pink-500", user: "SR" },
    { name: "Deploy pipeline", status: "Done", progress: 100, color: "bg-emerald-500", user: "TL" },
  ];

  const statusColors: Record<string, string> = {
    "In Progress": "bg-violet-500/20 text-violet-300 border border-violet-500/30",
    "Review": "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
    "Todo": "bg-gray-500/20 text-gray-300 border border-gray-500/30",
    "Done": "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto mt-14 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-violet-500/10">
      {/* Glow */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-40 bg-violet-600/20 blur-3xl rounded-full pointer-events-none" />
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/10">
        <div className="w-3 h-3 rounded-full bg-red-500/70" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
        <span className="ml-3 text-xs text-white/30 font-mono">flowsync.app / workspace / sprint-12</span>
      </div>
      {/* Dashboard body */}
      <div className="bg-[#0d0d16] p-5">
        {/* Stat cards row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Active Tasks", value: "24", delta: "+3", color: "text-violet-400" },
            { label: "Completed", value: "138", delta: "+12", color: "text-emerald-400" },
            { label: "Team Velocity", value: "94%", delta: "+7%", color: "text-cyan-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white/5 border border-white/8 p-3">
              <p className="text-white/40 text-xs mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-emerald-400 text-xs mt-1">{s.delta} this week</p>
            </div>
          ))}
        </div>
        {/* Task list */}
        <div className="rounded-xl bg-white/3 border border-white/8 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <span className="text-white/70 text-sm font-semibold">Sprint Tasks</span>
            <span className="text-white/30 text-xs">Sprint 12 · 8 days left</span>
          </div>
          {tasks.map((t, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
              <div className={`w-7 h-7 rounded-full ${t.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                {t.user}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-sm truncate">{t.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full ${t.color} rounded-full transition-all`} style={{ width: `${t.progress}%` }} />
                  </div>
                  <span className="text-white/30 text-xs">{t.progress}%</span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColors[t.status]}`}>
                {t.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Feature Card ─────────────────────────────────────────────────────────────
const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="group relative rounded-2xl p-px bg-gradient-to-b from-white/10 to-transparent hover:from-violet-500/40 hover:to-cyan-500/10 transition-all duration-300">
    <div className="rounded-2xl bg-[#0d0d16] p-7 h-full">
      <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-5 group-hover:bg-violet-500/25 transition-colors">
        {icon}
      </div>
      <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
      <p className="text-white/50 text-sm leading-relaxed">{description}</p>
    </div>
  </div>
);

// ─── Pricing Card ─────────────────────────────────────────────────────────────
const PricingCard = ({
  name, price, description, features, cta, featured,
}: {
  name: string; price: string; description: string; features: string[]; cta: string; featured?: boolean;
}) => (
  <div className={`relative rounded-2xl p-px transition-all duration-300 ${featured
    ? "bg-gradient-to-b from-violet-500 via-violet-500/50 to-cyan-500/30 shadow-2xl shadow-violet-500/20 scale-105"
    : "bg-gradient-to-b from-white/10 to-transparent hover:from-white/20"
  }`}>
    {featured && (
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-xs font-bold px-4 py-1 rounded-full">
        MOST POPULAR
      </div>
    )}
    <div className="rounded-2xl bg-[#0d0d16] p-8 h-full flex flex-col">
      <div className="mb-6">
        <p className={`text-sm font-semibold mb-1 ${featured ? "text-violet-400" : "text-white/50"}`}>{name}</p>
        <div className="flex items-end gap-1 mb-2">
          <span className="text-4xl font-extrabold text-white">{price}</span>
          <span className="text-white/40 mb-1">/mo</span>
        </div>
        <p className="text-white/40 text-sm">{description}</p>
      </div>
      <ul className="space-y-3 flex-1 mb-8">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span className={featured ? "text-violet-400" : "text-emerald-400"}><CheckIcon /></span>
            <span className="text-white/70">{f}</span>
          </li>
        ))}
      </ul>
      <button className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${featured
        ? "bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500 hover:shadow-lg hover:shadow-violet-500/30"
        : "bg-white/8 text-white/80 border border-white/15 hover:bg-white/15"
      }`}>
        {cta}
      </button>
    </div>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────
export default function FlowSyncLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#080810] text-white font-sans antialiased">
      {/* Background radial glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-700/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-cyan-700/8 rounded-full blur-[100px]" />
      </div>

      {/* ── Navbar ───────────────────────────────────────────────────── */}
      <nav className="relative z-50 border-b border-white/8 bg-[#080810]/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white font-black text-sm">F</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">FlowSync</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {["Features", "Pricing", "Docs"].map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`}
                className="text-white/50 hover:text-white text-sm font-medium transition-colors">{l}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <a href="#" className="hidden md:block text-white/60 hover:text-white text-sm font-medium transition-colors">Sign in</a>
            <a href="#pricing"
              className="bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-cyan-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/30">
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-violet-300 text-xs font-medium">Now in public beta — free for 30 days</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
          Automate Your Team's
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Workflow. Ship Faster.
          </span>
        </h1>
        <p className="text-white/50 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          FlowSync intelligently routes tasks, syncs your tools, and gives your team a live pulse —
          so you spend less time managing and more time building.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="#pricing"
            className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-all duration-200 hover:shadow-xl hover:shadow-violet-500/30 hover:-translate-y-0.5">
            Start Free Trial
          </a>
          <a href="#"
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/15 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all duration-200">
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">▶</span>
            Watch Demo
          </a>
        </div>
        <MockDashboard />
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">Features</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">Everything your team needs</h2>
          <p className="text-white/40 max-w-xl mx-auto">Built for modern engineering teams who move fast and need their tools to keep up.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          <FeatureCard
            icon={<LightningIcon />}
            title="Smart Automation"
            description="Auto-assign tasks based on team capacity, skill match, and sprint goals. No more manual triage — FlowSync routes the right work to the right person, instantly."
          />
          <FeatureCard
            icon={<SyncIcon />}
            title="Real-time Sync"
            description="Every update propagates in milliseconds across all devices and integrations. GitHub, Slack, Jira — FlowSync keeps your entire stack in perfect sync, always."
          />
          <FeatureCard
            icon={<ChartIcon />}
            title="Deep Analytics"
            description="Burndown charts, velocity tracking, and bottleneck detection — all in one place. Spot blockers before they become incidents and keep your sprints on track."
          />
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section id="pricing" className="relative z-10 max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-cyan-400 text-sm font-semibold uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">Simple, transparent pricing</h2>
          <p className="text-white/40 max-w-xl mx-auto">No hidden fees. No per-seat surprises. Start free, upgrade when you're ready.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto items-center">
          <PricingCard
            name="Starter"
            price="$19"
            description="Perfect for small teams getting started"
            features={["Up to 5 users", "10 active projects", "Basic analytics", "Email support", "GitHub & Slack integration"]}
            cta="Get Started"
          />
          <PricingCard
            name="Pro"
            price="$49"
            description="For teams that move fast and scale"
            features={["Unlimited users", "Unlimited projects", "Advanced analytics & reporting", "Priority 24/7 support", "Custom integrations & API", "SSO & audit logs"]}
            cta="Start Free Trial"
            featured
          />
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/8 bg-white/2">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white font-black text-xs">F</span>
            </div>
            <span className="text-white font-bold">FlowSync</span>
            <span className="text-white/30 text-sm ml-2">— Ship faster, together.</span>
          </div>
          <p className="text-white/25 text-sm">© {new Date().getFullYear()} FlowSync Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
