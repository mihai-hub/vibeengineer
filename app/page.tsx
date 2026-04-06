'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingCart,
  BarChart3,
  Rocket,
  FileText,
  MessageSquare,
  Layout,
  Users,
  CreditCard,
  Sparkles,
  Zap,
} from 'lucide-react';

const TEMPLATES = [
  {
    id: 'ecommerce-store',
    name: 'E-Commerce Store',
    description: 'Full-featured online store with cart, checkout, and payments',
    icon: ShoppingCart,
    gradient: 'from-purple-500 to-pink-500',
    prompt:
      'Create a modern e-commerce store with product listings, shopping cart, user authentication, and Stripe payment integration. Use Next.js, Tailwind CSS, and Supabase for the database.',
  },
  {
    id: 'saas-dashboard',
    name: 'SaaS Dashboard',
    description: 'Analytics dashboard with charts, tables, and user management',
    icon: BarChart3,
    gradient: 'from-blue-500 to-cyan-500',
    prompt:
      'Build a SaaS analytics dashboard with real-time charts, data tables, user role management, and a settings panel. Include dark mode and responsive design.',
  },
  {
    id: 'landing-page',
    name: 'Startup Landing Page',
    description: 'Beautiful landing page with hero, features, and CTA sections',
    icon: Rocket,
    gradient: 'from-orange-500 to-red-500',
    prompt:
      'Create a stunning startup landing page with animated hero section, feature grid with icons, customer testimonials carousel, pricing table, and newsletter signup form.',
  },
  {
    id: 'blog-platform',
    name: 'Blog Platform',
    description: 'Full blog with posts, categories, comments, and admin panel',
    icon: FileText,
    gradient: 'from-green-500 to-emerald-500',
    prompt:
      'Build a blog platform with markdown support, categories, comments system, and an admin panel for content management. Include SEO optimization.',
  },
  {
    id: 'chat-app',
    name: 'Real-Time Chat',
    description: 'Chat application with rooms, direct messages, and file sharing',
    icon: MessageSquare,
    gradient: 'from-violet-500 to-purple-500',
    prompt:
      'Create a real-time chat application with chat rooms, direct messaging, file sharing, online/offline status, and message history. Use WebSockets for real-time updates.',
  },
  {
    id: 'admin-panel',
    name: 'Admin Dashboard',
    description: 'Complete admin panel with CRUD operations and user management',
    icon: Layout,
    gradient: 'from-slate-500 to-gray-600',
    prompt:
      'Build an admin dashboard with CRUD operations, user management, activity logs, and system settings. Include data export functionality.',
  },
  {
    id: 'portfolio',
    name: 'Developer Portfolio',
    description: 'Personal portfolio showcasing projects and skills',
    icon: Users,
    gradient: 'from-teal-500 to-cyan-500',
    prompt:
      'Create a developer portfolio with animated project showcase, skills section with progress bars, contact form, and optional blog section.',
  },
  {
    id: 'booking-system',
    name: 'Booking System',
    description: 'Appointment booking with calendar and payment integration',
    icon: CreditCard,
    gradient: 'from-indigo-500 to-blue-500',
    prompt:
      'Build a booking/appointment system with calendar view, available time slots, Stripe payment integration, and email notifications for confirmations.',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');

  const handleBuild = () => {
    const text = prompt.trim();
    if (!text) return;
    router.push(`/chat?mode=coo&prompt=${encodeURIComponent(text)}`);
  };

  const handleTemplateClick = (t: typeof TEMPLATES[0]) => {
    setPrompt(t.prompt);
    document.getElementById('prompt-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleBuild();
  };

  return (
    <div
      style={{ backgroundColor: '#0a0a0f', color: '#e5e7eb', minHeight: '100vh' }}
      className="flex flex-col font-sans antialiased"
    >
      {/* Header */}
      <header
        style={{ borderBottom: '1px solid rgba(124,58,237,0.18)' }}
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6" style={{ color: '#7c3aed' }} />
          <span className="text-xl font-bold tracking-tight text-white">
            Vibe<span style={{ color: '#7c3aed' }}>Engineer</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/chat"
            className="text-sm font-medium px-4 py-1.5 rounded-full transition-colors"
            style={{ color: '#a78bfa', border: '1px solid rgba(124,58,237,0.45)', background: 'rgba(124,58,237,0.15)' }}
          >
            AI Chat
          </a>
          <a
            href="/builder"
            className="text-sm font-medium px-4 py-1.5 rounded-full transition-colors"
            style={{ color: '#67e8f9', border: '1px solid rgba(6,182,212,0.45)', background: 'rgba(6,182,212,0.1)' }}
          >
            Builder
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-24 text-center">
        {/* Orb 1 — main central purple glow, floating */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '-40px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '800px',
            height: '380px',
            background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.28) 0%, rgba(124,58,237,0.08) 50%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
            animation: 'float-orb 8s ease-in-out infinite',
          }}
        />
        {/* Orb 2 — blue accent, offset right */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '20px',
            left: 'calc(50% + 180px)',
            transform: 'translateX(-50%)',
            width: '480px',
            height: '280px',
            background: 'radial-gradient(ellipse at center, rgba(96,165,250,0.18) 0%, transparent 65%)',
            pointerEvents: 'none',
            zIndex: 0,
            animation: 'float-orb-2 10s ease-in-out infinite',
          }}
        />
        {/* Orb 3 — pink accent, offset left */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '10px',
            left: 'calc(50% - 180px)',
            transform: 'translateX(-50%)',
            width: '420px',
            height: '240px',
            background: 'radial-gradient(ellipse at center, rgba(236,72,153,0.13) 0%, transparent 65%)',
            pointerEvents: 'none',
            zIndex: 0,
            animation: 'float-orb-2 12s ease-in-out infinite reverse',
          }}
        />
        {/* Dot-grid overlay — pulses softly */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(124,58,237,0.05) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            pointerEvents: 'none',
            zIndex: 0,
            animation: 'pulse-glow 6s ease-in-out infinite',
          }}
        />

        <h1 className="relative z-10 max-w-3xl text-5xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
          Meet your{' '}
          <span className="hero-gradient-text">CTO and COO</span>{' '}
          before you build.
        </h1>

        <p
          className="relative z-10 mt-5 max-w-xl text-lg leading-relaxed"
          style={{ color: '#9ca3af' }}
        >
          VibeEngineer gives you an AI technical co-founder and operator — before you write a single line of code.
        </p>

        {/* Advisor CTA Buttons */}
        <div className="relative z-10 mt-10 flex flex-col items-center gap-0">
          {/* Soft glow ring behind buttons */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '440px',
              height: '90px',
              background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.18) 0%, transparent 70%)',
              pointerEvents: 'none',
              filter: 'blur(8px)',
              animation: 'pulse-glow 4s ease-in-out infinite',
            }}
          />
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link
              href="/chat?mode=cto"
              className="hero-cta-pulse flex items-center gap-3 rounded-2xl px-6 py-4 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
              }}
            >
              <span className="text-lg">🧠</span>
              Talk to the CTO
            </Link>
            <Link
              href="/chat?mode=coo"
              className="flex items-center gap-3 rounded-2xl px-6 py-4 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
                boxShadow: '0 4px 24px rgba(249,115,22,0.35)',
              }}
            >
              <span className="text-lg">💼</span>
              Talk to the COO
            </Link>
          </div>
        </div>
      </section>

      {/* Advisor Cards */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-16">
        <h2
          className="mb-8 text-center text-sm font-semibold uppercase tracking-widest"
          style={{ color: '#6b7280' }}
        >
          Your AI co-founders
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* CTO Card */}
          <Link
            href="/chat?mode=cto"
            className="group flex flex-col gap-4 rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1"
            style={{
              background: 'rgba(124,58,237,0.07)',
              border: '1px solid rgba(124,58,237,0.25)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.border = '1px solid rgba(124,58,237,0.55)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.12)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.border = '1px solid rgba(124,58,237,0.25)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.07)';
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)' }}
              >
                🧠
              </div>
              <div>
                <p className="font-bold text-white text-base">CTO Advisor</p>
                <p className="text-xs mt-0.5" style={{ color: '#a78bfa' }}>Stack · Architecture · Tech decisions</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#9ca3af' }}>
              &ldquo;Tell me about the app you want to build — I will help you choose the right stack and architecture.&rdquo;
            </p>
            <span
              className="self-end text-xs font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              style={{ color: '#a78bfa' }}
            >
              Start conversation →
            </span>
          </Link>

          {/* COO Card */}
          <Link
            href="/chat?mode=coo"
            className="group flex flex-col gap-4 rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1"
            style={{
              background: 'rgba(249,115,22,0.07)',
              border: '1px solid rgba(249,115,22,0.25)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.border = '1px solid rgba(249,115,22,0.55)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.12)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.border = '1px solid rgba(249,115,22,0.25)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.07)';
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)' }}
              >
                💼
              </div>
              <div>
                <p className="font-bold text-white text-base">COO Advisor</p>
                <p className="text-xs mt-0.5" style={{ color: '#fb923c' }}>GTM · Pricing · Growth strategy</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#9ca3af' }}>
              &ldquo;What problem are you solving and who is your customer? Let me help you with positioning and pricing.&rdquo;
            </p>
            <span
              className="self-end text-xs font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              style={{ color: '#fb923c' }}
            >
              Start conversation →
            </span>
          </Link>
        </div>
      </section>

      {/* Template Grid */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <h2
          className="mb-8 text-center text-sm font-semibold uppercase tracking-widest"
          style={{ color: '#6b7280' }}
        >
          Or start from a template
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => handleTemplateClick(t)}
                className="group relative flex flex-col gap-3 rounded-2xl p-5 text-left transition-all duration-200 hover:-translate-y-1"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.border =
                    '1px solid rgba(124,58,237,0.45)';
                  (e.currentTarget as HTMLElement).style.background =
                    'rgba(124,58,237,0.07)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.border =
                    '1px solid rgba(255,255,255,0.07)';
                  (e.currentTarget as HTMLElement).style.background =
                    'rgba(255,255,255,0.03)';
                }}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${t.gradient}`}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>

                <div>
                  <p className="font-semibold text-white">{t.name}</p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: '#6b7280' }}>
                    {t.description}
                  </p>
                </div>

                <span
                  className="absolute right-4 top-4 text-xs opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  style={{ color: '#7c3aed' }}
                >
                  Use →
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-20">
        <h2
          className="mb-12 text-center text-sm font-semibold uppercase tracking-widest"
          style={{ color: '#6b7280' }}
        >
          Simple pricing
        </h2>

        <div className="grid gap-6 lg:grid-cols-3">

          {/* FREE */}
          <div
            className="flex flex-col gap-6 rounded-2xl p-8"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div>
              <p className="text-xl font-bold text-white">Free</p>
              <p className="mt-1 text-3xl font-extrabold text-white">
                $0<span className="text-base font-medium" style={{ color: '#6b7280' }}> / mo</span>
              </p>
              <p className="mt-1 text-sm" style={{ color: '#6b7280' }}>Get started, no credit card</p>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} className="pt-6 flex flex-col gap-3">
              {[
                '3 AI advisor sessions / month',
                '2 app generations',
                'Community templates',
                'CTO + COO chat',
              ].map((f) => (
                <div key={f} className="flex items-start gap-3 text-sm" style={{ color: '#d1d5db' }}>
                  <span style={{ color: '#6b7280', flexShrink: 0 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>

            <button
              className="mt-auto w-full rounded-xl py-3 text-sm font-semibold text-white transition-all duration-200"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              Start Free
            </button>
          </div>

          {/* PRO */}
          <div
            className="relative flex flex-col gap-6 rounded-2xl p-8"
            style={{
              background: 'rgba(124,58,237,0.08)',
              border: '1px solid rgba(124,58,237,0.45)',
              boxShadow: '0 0 40px rgba(124,58,237,0.18)',
            }}
          >
            <div
              className="absolute -top-3 right-6 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: 'rgba(124,58,237,0.2)',
                border: '1px solid rgba(124,58,237,0.45)',
                color: '#a78bfa',
              }}
            >
              Most Popular
            </div>

            <div>
              <p className="text-xl font-bold text-white">Pro</p>
              <p
                className="mt-1 text-3xl font-extrabold"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                $29<span
                  className="text-base font-medium"
                  style={{ WebkitTextFillColor: '#6b7280' }}
                > / mo</span>
              </p>
              <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>For serious builders</p>
            </div>

            <div style={{ borderTop: '1px solid rgba(124,58,237,0.2)' }} className="pt-6 flex flex-col gap-3">
              {[
                'Unlimited advisor sessions',
                'Unlimited app generations',
                'Priority Claude generation',
                'Advanced templates library',
                'Export full source code',
                '1-click deploy to Vercel',
              ].map((f) => (
                <div key={f} className="flex items-start gap-3 text-sm" style={{ color: '#d1d5db' }}>
                  <span style={{ color: '#a78bfa', flexShrink: 0 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>

            <button
              className="mt-auto w-full rounded-xl py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
                boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
              }}
            >
              Get Pro
            </button>
          </div>

          {/* ENTERPRISE */}
          <div
            className="flex flex-col gap-6 rounded-2xl p-8"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div>
              <p className="text-xl font-bold text-white">Enterprise</p>
              <p className="mt-1 text-3xl font-extrabold text-white">Custom</p>
              <p className="mt-1 text-sm" style={{ color: '#6b7280' }}>For teams and agencies</p>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} className="pt-6 flex flex-col gap-3">
              {[
                'Everything in Pro',
                'Dedicated AI instance',
                'Custom integrations',
                'SLA + priority support',
                'Team seats & permissions',
                'White-label option',
              ].map((f) => (
                <div key={f} className="flex items-start gap-3 text-sm" style={{ color: '#d1d5db' }}>
                  <span style={{ color: '#6b7280', flexShrink: 0 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>

            <button
              className="mt-auto w-full rounded-xl py-3 text-sm font-semibold text-white transition-all duration-200"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              Contact Sales
            </button>
          </div>

        </div>
      </section>

      {/* Prompt Section */}
      <section id="prompt-section" className="mx-auto w-full max-w-3xl px-6 pb-24">
        <h2
          className="mb-6 text-center text-sm font-semibold uppercase tracking-widest"
          style={{ color: '#6b7280' }}
        >
          Or describe your idea
        </h2>
        <div
          className="rounded-3xl p-6"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(124,58,237,0.3)',
            boxShadow: '0 0 60px rgba(124,58,237,0.12)',
          }}
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your app idea…"
            rows={5}
            className="w-full resize-none rounded-xl bg-transparent text-base leading-relaxed placeholder-gray-600 outline-none"
            style={{ color: '#e5e7eb' }}
          />

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs" style={{ color: '#4b5563' }}>
              ⌘ + Enter to send
            </p>

            <button
              onClick={handleBuild}
              disabled={!prompt.trim()}
              className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                boxShadow: '0 4px 24px rgba(124,58,237,0.4)',
              }}
            >
              <Sparkles className="h-4 w-4" />
              Get AI Strategy →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="mt-auto py-6 text-center text-sm"
        style={{
          color: '#4b5563',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        Made with <span style={{ color: '#7c3aed' }}>♥</span> by{' '}
        <span className="text-white">Jeff</span> +{' '}
        <span className="text-white">Claude</span>
      </footer>
    </div>
  );
}
