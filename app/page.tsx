'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Zap, Brain, Briefcase, Wrench, Globe } from 'lucide-react';

const TEAM = [
  {
    icon: '🧠',
    role: 'CTO',
    label: 'Tech Lead',
    color: 'rgba(124,58,237,0.12)',
    border: 'rgba(124,58,237,0.35)',
    tag: 'Stack · Architecture · Tech decisions',
    tagColor: '#a78bfa',
    mode: 'cto',
    quote: 'Tell me what you want to build — I\'ll give you the stack, architecture, and a plan.',
  },
  {
    icon: '💼',
    role: 'COO',
    label: 'Operations Lead',
    color: 'rgba(249,115,22,0.10)',
    border: 'rgba(249,115,22,0.35)',
    tag: 'GTM · Pricing · Growth strategy',
    tagColor: '#fb923c',
    mode: 'coo',
    quote: 'Who\'s your customer and what problem are you solving? I\'ll handle positioning and pricing.',
  },
  {
    icon: '⚡',
    role: 'Builder',
    label: 'AI Developer',
    color: 'rgba(6,182,212,0.10)',
    border: 'rgba(6,182,212,0.35)',
    tag: 'Generate · Preview · Deploy',
    tagColor: '#67e8f9',
    mode: null,
    href: '/builder',
    quote: 'Describe your app — I\'ll generate working code with live preview in seconds.',
  },
  {
    icon: '🖥️',
    role: 'Operator',
    label: 'Browser Agent',
    color: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.35)',
    tag: 'Click · Navigate · Operate any site',
    tagColor: '#34d399',
    mode: 'operate',
    quote: 'Give me a URL and tell me what to do — I\'ll operate the browser for you.',
  },
];

const STARTERS = [
  { label: '🧠 What stack should I use?', mode: 'cto' },
  { label: '💼 Help me price my SaaS', mode: 'coo' },
  { label: '⚡ Build me a landing page', mode: 'cto' },
  { label: '🌐 Check a website for me', mode: 'operate' },
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
    <div style={{ backgroundColor: '#0a0a0f', color: '#e5e7eb', minHeight: '100vh' }} className="flex flex-col font-sans antialiased">

      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(124,58,237,0.15)' }} className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5" style={{ color: '#7c3aed' }} />
          <span className="text-lg font-bold tracking-tight text-white">Vibe<span style={{ color: '#7c3aed' }}>Engineer</span></span>
        </div>
        <a href="/builder" className="text-sm font-medium px-4 py-1.5 rounded-full transition-colors" style={{ color: '#67e8f9', border: '1px solid rgba(6,182,212,0.4)', background: 'rgba(6,182,212,0.08)' }}>
          Builder ⚡
        </a>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-20 pb-16 text-center">
        {/* Background glow */}
        <div aria-hidden style={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', width: '700px', height: '350px', background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.22) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

        <div className="relative z-10 flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          Your AI co-founding team — CTO · COO · Builder · Operator
        </div>

        <h1 className="relative z-10 max-w-2xl text-5xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
          Build smarter.<br />
          <span style={{ background: 'linear-gradient(135deg, #7c3aed, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Your whole team is AI.
          </span>
        </h1>

        <p className="relative z-10 mt-5 max-w-lg text-lg leading-relaxed" style={{ color: '#9ca3af' }}>
          One chat. Ask anything — strategy, code, pricing, or let the AI operate a browser for you.
        </p>

        {/* Main chat input */}
        <div className="relative z-10 mt-10 w-full max-w-2xl">
          <div className="flex items-end gap-3 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.35)', boxShadow: '0 0 40px rgba(124,58,237,0.12)' }}>
            <textarea
              value={input}
              onChange={e => { setInput(e.target.value); const el = e.target; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything — 'What stack for a booking app?' or 'Check my competitor's pricing at…'"
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Quick starters */}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {STARTERS.map(s => (
              <button
                key={s.label}
                onClick={() => handleSend(s.label.slice(3))}
                className="px-3 py-1.5 rounded-full text-xs transition-all hover:brightness-110"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Team cards */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-20">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest" style={{ color: '#4b5563' }}>Your AI team</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map(m => (
            <button
              key={m.role}
              onClick={() => m.href ? router.push(m.href) : router.push(`/chat?mode=${m.mode}`)}
              className="flex flex-col gap-3 rounded-2xl p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:brightness-110"
              style={{ background: m.color, border: `1px solid ${m.border}` }}
            >
              <div className="text-2xl">{m.icon}</div>
              <div>
                <p className="font-bold text-white text-sm">{m.role}</p>
                <p className="text-[11px] mt-0.5" style={{ color: m.tagColor }}>{m.tag}</p>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>&ldquo;{m.quote}&rdquo;</p>
            </button>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t py-6 text-center text-xs" style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#4b5563' }}>
        Made with ♥ by <span style={{ color: '#7c3aed' }}>Jeff</span> + Claude
      </footer>
    </div>
  );
}
