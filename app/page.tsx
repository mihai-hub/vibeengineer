'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
    router.push(`/builder?prompt=${encodeURIComponent(text)}`);
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

        <div
          className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
          style={{
            background: 'rgba(124,58,237,0.15)',
            border: '1px solid rgba(124,58,237,0.45)',
            color: '#a78bfa',
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Powered by Claude
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-24 text-center">
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '720px',
            height: '320px',
            background:
              'radial-gradient(ellipse at center, rgba(124,58,237,0.22) 0%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <h1 className="relative z-10 max-w-3xl text-5xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
          Describe your app.{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Watch it get built.
          </span>
        </h1>

        <p
          className="relative z-10 mt-5 max-w-xl text-lg leading-relaxed"
          style={{ color: '#9ca3af' }}
        >
          VibeEngineer uses Claude AI to generate full-stack Next.js apps in real time.
        </p>
      </section>

      {/* Template Grid */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <h2
          className="mb-8 text-center text-sm font-semibold uppercase tracking-widest"
          style={{ color: '#6b7280' }}
        >
          Start from a template
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

      {/* Prompt Section */}
      <section id="prompt-section" className="mx-auto w-full max-w-3xl px-6 pb-24">
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
              ⌘ + Enter to build
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
              Build with Claude
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
