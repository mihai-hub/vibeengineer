'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';

const FAQS = [
  {
    q: 'Can I bring my own API key?',
    a: 'Yes. Pro/Power users can use their own Anthropic key.',
  },
  {
    q: "What's the difference between CDN and Real App?",
    a: 'CDN = instant HTML app, works anywhere. Real App = full Next.js project with TypeScript, proper structure, ready to deploy to Vercel/Railway/GCP.',
  },
  {
    q: 'How do I deploy my app?',
    a: 'Download ZIP and deploy yourself to any platform. We guide you — Vercel, Railway, GCP all work great.',
  },
];

async function startCheckout(tier: 'pro' | 'power') {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tier,
      userId: 'guest',
      email: '',
      returnUrl: window.location.origin + '/dashboard',
    }),
  });
  if (!res.ok) {
    alert('Could not start checkout. Please try again.');
    return;
  }
  const data = await res.json();
  if (data.url) window.location.href = data.url;
}

export default function PricingPage() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleCheckout = async (tier: 'pro' | 'power') => {
    setLoadingTier(tier);
    await startCheckout(tier);
    setLoadingTier(null);
  };

  return (
    <div
      style={{ backgroundColor: '#080810', color: '#e5e7eb', minHeight: '100vh' }}
      className="flex flex-col font-sans antialiased"
    >
      {/* Header */}
      <header
        style={{ borderBottom: '1px solid rgba(124,58,237,0.15)' }}
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md"
      >
        <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors text-sm">
          ← Back
        </Link>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5" style={{ color: '#8b5cf6' }} />
          <span className="text-lg font-bold tracking-tight text-white">
            Vibe<span style={{ color: '#8b5cf6' }}>Engineer</span>
          </span>
        </div>
        <div className="w-16" />
      </header>

      {/* Hero */}
      <section className="pt-20 pb-10 text-center px-6">
        <div
          className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full text-xs font-medium"
          style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          Simple, transparent pricing
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-3">
          Simple, transparent pricing
        </h1>
        <p className="text-base" style={{ color: '#6b7280' }}>
          Build anything. Ship in seconds.
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="px-6 pb-16 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">

          {/* FREE */}
          <div
            className="flex flex-col rounded-2xl p-6 transition-transform duration-200 hover:scale-[1.02]"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="mb-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Free</p>
              <p className="text-4xl font-extrabold text-white">$0<span className="text-base font-normal text-zinc-500">/mo</span></p>
            </div>
            <ul className="flex-1 space-y-3 mb-6 text-sm" style={{ color: '#9ca3af' }}>
              {[
                '3 builds per month',
                'CDN HTML apps (instant)',
                'Fast AI answers',
                'ZIP download',
              ].map(f => (
                <li key={f} className="flex items-start gap-2">
                  <span style={{ color: '#10b981' }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <Link
              href="/chat"
              className="block text-center py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#e5e7eb',
              }}
            >
              Start free →
            </Link>
          </div>

          {/* PRO — highlighted */}
          <div
            className="flex flex-col rounded-2xl p-6 transition-transform duration-200 hover:scale-[1.02] relative"
            style={{
              background: 'rgba(139,92,246,0.06)',
              border: '1px solid rgba(139,92,246,0.40)',
              boxShadow: '0 0 40px rgba(139,92,246,0.20), 0 0 80px rgba(139,92,246,0.08)',
            }}
          >
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', color: '#fff' }}
            >
              Most Popular
            </div>
            <div className="mb-4">
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#a78bfa' }}>Pro</p>
              <p className="text-4xl font-extrabold text-white">$29<span className="text-base font-normal text-zinc-500">/mo</span></p>
            </div>
            <ul className="flex-1 space-y-3 mb-6 text-sm" style={{ color: '#9ca3af' }}>
              {[
                '50 builds per month',
                'Real Next.js apps (multi-file)',
                'Design Mode (luxury UI)',
                'Download ZIP + Deploy guide',
                'Priority Sonnet model',
              ].map(f => (
                <li key={f} className="flex items-start gap-2">
                  <span style={{ color: '#8b5cf6' }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout('pro')}
              disabled={loadingTier === 'pro'}
              className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                color: '#fff',
              }}
            >
              {loadingTier === 'pro' ? 'Loading…' : 'Start Pro →'}
            </button>
          </div>

          {/* POWER */}
          <div
            className="flex flex-col rounded-2xl p-6 transition-transform duration-200 hover:scale-[1.02]"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="mb-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Power</p>
              <p className="text-4xl font-extrabold text-white">$79<span className="text-base font-normal text-zinc-500">/mo</span></p>
            </div>
            <ul className="flex-1 space-y-3 mb-6 text-sm" style={{ color: '#9ca3af' }}>
              {[
                'Unlimited builds',
                'Claude Opus 4.6 (best quality)',
                'All features',
                'Business data connectors (Shopify etc)',
              ].map(f => (
                <li key={f} className="flex items-start gap-2">
                  <span style={{ color: '#06b6d4' }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout('power')}
              disabled={loadingTier === 'power'}
              className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-60"
              style={{
                background: 'rgba(6,182,212,0.15)',
                border: '1px solid rgba(6,182,212,0.35)',
                color: '#06b6d4',
              }}
            >
              {loadingTier === 'power' ? 'Loading…' : 'Start Power →'}
            </button>
          </div>
        </div>

        {/* PAYG card */}
        <div
          className="rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div>
            <p className="text-sm font-semibold text-white mb-1">Pay as you go — no subscription</p>
            <div className="flex flex-wrap gap-4 text-xs" style={{ color: '#6b7280' }}>
              <span>CDN build: <strong className="text-zinc-300">$0.10</strong></span>
              <span>Real App build: <strong className="text-zinc-300">$0.50</strong></span>
              <span>Fast answers: <strong className="text-zinc-300">free</strong></span>
            </div>
          </div>
          <Link
            href="/chat"
            className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 whitespace-nowrap"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: '#e5e7eb',
            }}
          >
            Get started →
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-16 max-w-2xl mx-auto w-full">
        <h2 className="text-xl font-bold text-white text-center mb-8">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-white hover:bg-white/5 transition-colors"
              >
                {faq.q}
                <span style={{ color: '#8b5cf6', fontSize: '1.1rem', lineHeight: 1 }}>
                  {openFaq === i ? '−' : '+'}
                </span>
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm" style={{ color: '#6b7280' }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 py-16 text-center">
        <h2 className="text-3xl font-extrabold text-white mb-4">Ready to build?</h2>
        <p className="text-sm mb-8" style={{ color: '#6b7280' }}>
          Start for free. Upgrade when you need more.
        </p>
        <Link
          href="/chat"
          className="inline-block px-8 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', color: '#fff' }}
        >
          Start for free
        </Link>
      </section>

      {/* Footer */}
      <footer
        className="border-t py-5 text-center text-xs"
        style={{ borderColor: 'rgba(255,255,255,0.05)', color: '#4b5563' }}
      >
        Built by <span style={{ color: '#8b5cf6' }}>Jeff ASI</span> + Claude &mdash; your autonomous engineering team
      </footer>
    </div>
  );
}
