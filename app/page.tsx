'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Zap } from 'lucide-react';

const STARTERS = [
  { label: 'Build me a SaaS dashboard with charts', lane: 'build' },
  { label: 'What stack for a real-time chat app?', lane: 'fast' },
  { label: 'Build me an e-commerce store', lane: 'build' },
  { label: 'How should I price my SaaS?', lane: 'fast' },
  { label: 'Build me a habit tracker with streaks', lane: 'build' },
  { label: 'Build me a Kanban board', lane: 'build' },
];

const FEATURES = [
  { icon: '🔨', title: 'Build anything', desc: 'Describe it. Claude writes the code — full Next.js apps with TypeScript, Tailwind, real backends.' },
  { icon: '🚀', title: 'Deploy in seconds', desc: 'Download ZIP and deploy to Vercel, Railway, or GCP. Or use our CDN for instant previews.' },
  { icon: '🎨', title: 'Design Mode', desc: 'Luxury UI generation — glassmorphism, micro-animations, gradient buttons. Looks like a $10k design system.' },
  { icon: '📊', title: 'Business tools', desc: 'Connect your Shopify store, paste your data. Claude builds custom dashboards on top of your business.' },
  { icon: '⚡', title: 'Instant answers', desc: 'Strategy, pricing, architecture — fast lane answers with live web sources in under 3 seconds.' },
  { icon: '🤖', title: 'Agentic coworker', desc: 'Watch Claude write files, run commands, iterate. Like Claude Code, but for building products.' },
];

const TESTIMONIALS = [
  { name: 'James K.', company: 'Founder @ Stackly', quote: 'I described my SaaS idea at 9pm. By 10pm I had a working app with auth and payments. Insane.' },
  { name: 'Priya M.', company: 'CEO @ Rapidform', quote: 'We replaced 3 weeks of dev work with a 20-minute VibeEngineer session. My team can focus on what matters.' },
  { name: 'Tom R.', company: 'Indie Hacker', quote: 'Finally something that actually builds and deploys, not just shows code. This is the tool I was waiting for.' },
];

export default function LandingPage() {
  const router = useRouter();
  const [input, setInput] = useState('');

  const handleSend = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    router.push(`/chat?prompt=${encodeURIComponent(msg)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{ backgroundColor: '#080810', color: '#e5e7eb', minHeight: '100vh' }} className="flex flex-col font-sans antialiased">

      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(124,58,237,0.15)' }} className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md bg-black/40">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5" style={{ color: '#7c3aed' }} />
          <span className="text-lg font-bold tracking-tight text-white">Vibe<span style={{ color: '#7c3aed' }}>Engineer</span></span>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          <a href="/chat" className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors">Chat</a>
          <a href="/pricing" className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors">Pricing</a>
          <a href="/dashboard" className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors">Dashboard</a>
          <a href="/auth" className="ml-2 px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all" style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>Sign in</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center">
        {/* Background glow */}
        <div aria-hidden style={{ position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)', width: '900px', height: '500px', background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.15) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />

        <div className="relative z-10 flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.25)', color: '#a78bfa' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          Powered by Claude Opus · Build → Deploy in 10 seconds
        </div>

        <h1 className="relative z-10 max-w-4xl text-5xl font-extrabold leading-tight tracking-tight text-white sm:text-7xl mb-6">
          Your AI engineering team.
          <br />
          <span style={{ background: 'linear-gradient(135deg, #7c3aed 20%, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Describe it. It ships.
          </span>
        </h1>

        <p className="relative z-10 max-w-xl text-lg leading-relaxed mb-10" style={{ color: '#6b7280' }}>
          Real Next.js apps. Full TypeScript. Deployed in seconds. No Vercel setup, no Dockerfile, no config hell. Just describe what you want and watch it build.
        </p>

        {/* Main chat input */}
        <div className="relative z-10 w-full max-w-2xl">
          <div className="flex items-end gap-3 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.40)', boxShadow: '0 0 80px rgba(124,58,237,0.12)' }}>
            <textarea
              value={input}
              onChange={e => {
                setInput(e.target.value);
                const el = e.target;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder="What do you want to build? Describe it in plain English…"
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
              style={{ minHeight: '40px', maxHeight: '120px' }}
              autoFocus
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Quick starters */}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {STARTERS.map(s => (
              <button
                key={s.label}
                onClick={() => handleSend(s.label)}
                className="px-3 py-1.5 rounded-full text-xs transition-all hover:brightness-110 flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.lane === 'fast' ? 'bg-yellow-400' : 'bg-cyan-400'}`} />
                {s.label}
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs text-zinc-600">Free plan: 3 builds/month · <a href="/pricing" className="text-violet-400 hover:text-violet-300">Upgrade for unlimited →</a></p>
        </div>
      </section>

      {/* Features grid */}
      <section className="px-6 py-20 max-w-6xl mx-auto w-full">
        <h2 className="text-center text-3xl font-bold text-white mb-3">Everything you need to ship</h2>
        <p className="text-center text-zinc-500 text-sm mb-12">Not just code generation — the full loop from idea to deployed product</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="rounded-2xl p-5 transition-all hover:scale-[1.02]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="text-sm font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-16 max-w-5xl mx-auto w-full">
        <h2 className="text-center text-2xl font-bold text-white mb-10">Founders shipping faster</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm leading-relaxed text-zinc-300 mb-4">&ldquo;{t.quote}&rdquo;</p>
              <div>
                <div className="text-xs font-semibold text-white">{t.name}</div>
                <div className="text-[11px] text-zinc-600">{t.company}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <div className="max-w-xl mx-auto rounded-2xl p-10" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
          <h2 className="text-3xl font-bold text-white mb-3">Ready to build?</h2>
          <p className="text-zinc-500 text-sm mb-8">Free forever for small projects. Scale when you need to.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/chat" className="px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
              Start building free →
            </a>
            <a href="/pricing" className="px-8 py-3 rounded-xl text-sm font-medium transition-all" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
              View pricing
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" style={{ color: '#7c3aed' }} />
            <span className="text-sm font-bold text-white">Vibe<span style={{ color: '#7c3aed' }}>Engineer</span></span>
          </div>
          <nav className="flex items-center gap-4 text-xs text-zinc-600">
            <a href="/chat" className="hover:text-zinc-400 transition-colors">Chat</a>
            <a href="/pricing" className="hover:text-zinc-400 transition-colors">Pricing</a>
            <a href="/dashboard" className="hover:text-zinc-400 transition-colors">Dashboard</a>
            <a href="/auth" className="hover:text-zinc-400 transition-colors">Sign in</a>
          </nav>
          <span className="text-xs text-zinc-700">Built with Claude Opus · © 2026 VibeEngineer</span>
        </div>
      </footer>
    </div>
  );
}
