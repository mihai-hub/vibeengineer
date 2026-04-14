'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Zap } from 'lucide-react';

const STARTERS = [
  { label: 'What stack for a SaaS booking app?', lane: 'fast' },
  { label: 'Build me a landing page with auth', lane: 'build' },
  { label: 'How should I price my product?', lane: 'fast' },
  { label: 'Deploy my app to Vercel', lane: 'build' },
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
        <div className="flex items-center gap-2 text-xs" style={{ color: '#6b7280' }}>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
            Fast answers
          </span>
          <span className="opacity-30">|</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
            Builds & deploys
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center flex-1">
        {/* Background glow */}
        <div aria-hidden style={{ position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)', width: '800px', height: '400px', background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.18) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />

        <div className="relative z-10 flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.25)', color: '#a78bfa' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          Powered by Jeff ASI + Claude
        </div>

        <h1 className="relative z-10 max-w-3xl text-5xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl mb-4">
          Describe what you want.
          <br />
          <span style={{ background: 'linear-gradient(135deg, #7c3aed 20%, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            I&rsquo;ll build and ship it.
          </span>
        </h1>

        <p className="relative z-10 mt-2 max-w-md text-base leading-relaxed" style={{ color: '#6b7280' }}>
          Ask a question &rarr; instant answer in seconds.<br />
          Say &ldquo;build&rdquo; &rarr; Jeff codes and deploys it for you.
        </p>

        {/* Main chat input */}
        <div className="relative z-10 mt-10 w-full max-w-2xl">
          <div className="flex items-end gap-3 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.40)', boxShadow: '0 0 60px rgba(124,58,237,0.10)' }}>
            <textarea
              value={input}
              onChange={e => {
                setInput(e.target.value);
                const el = e.target;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder="What do you want to build? Ask anything or say 'build me a…'"
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
        </div>

        {/* Speed lane explanation */}
        <div className="relative z-10 mt-12 flex gap-6 justify-center">
          <div className="flex flex-col items-center gap-2 max-w-[180px]">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.25)' }}>
              <span className="text-sm">⚡</span>
            </div>
            <p className="text-xs font-semibold text-white">Fast answers</p>
            <p className="text-xs text-center leading-relaxed" style={{ color: '#6b7280' }}>Strategy, advice, architecture decisions — instant response</p>
          </div>
          <div className="w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="flex flex-col items-center gap-2 max-w-[180px]">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)' }}>
              <span className="text-sm">🔨</span>
            </div>
            <p className="text-xs font-semibold text-white">Build mode</p>
            <p className="text-xs text-center leading-relaxed" style={{ color: '#6b7280' }}>Code, generate, deploy — Jeff takes over and ships it</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-5 text-center text-xs" style={{ borderColor: 'rgba(255,255,255,0.05)', color: '#4b5563' }}>
        Built by <span style={{ color: '#7c3aed' }}>Jeff ASI</span> + Claude &mdash; your autonomous engineering team
      </footer>
    </div>
  );
}
