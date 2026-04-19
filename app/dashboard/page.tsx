'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Zap, LogOut, ExternalLink } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { Tier } from '@/lib/billing';

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  power: 'Power',
  payg: 'Pay as you go',
  owner: 'Owner',
};

const TIER_LIMITS: Record<string, number | null> = {
  free: 3,
  pro: 50,
  power: null,
  payg: null,
  owner: null,
};

interface VibeProject {
  id: string;
  name?: string;
  prompt?: string;
  createdAt?: string;
  url?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>('free');
  const [builds, setBuilds] = useState<VibeProject[]>([]);
  const [loadingSignout, setLoadingSignout] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/auth');
        return;
      }
      setUserEmail(data.user.email ?? null);
      setUserId(data.user.id);
      setCheckingAuth(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/auth');
    });

    return () => { listener.subscription.unsubscribe(); };
  }, [router]);

  useEffect(() => {
    // Load tier from localStorage
    const storedTier = (localStorage.getItem('vibe_tier') as Tier) ?? 'free';
    setTier(storedTier);

    // Load recent builds from localStorage
    try {
      const raw = localStorage.getItem('vibe_projects');
      if (raw) setBuilds(JSON.parse(raw) as VibeProject[]);
    } catch {
      setBuilds([]);
    }
  }, []);

  const handleSignOut = async () => {
    setLoadingSignout(true);
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace('/');
  };

  const handleUpgrade = async (targetTier: 'pro' | 'power') => {
    if (!userId || !userEmail) return;
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier: targetTier,
        userId,
        email: userEmail,
        returnUrl: window.location.origin + '/dashboard',
      }),
    });
    if (!res.ok) { alert('Could not start checkout.'); return; }
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  const limit = TIER_LIMITS[tier];
  const usedBuilds = builds.filter(b => b.url).length;
  const usedPercent = limit ? Math.min(100, Math.round((usedBuilds / limit) * 100)) : 0;

  if (checkingAuth) {
    return (
      <div style={{ backgroundColor: '#080810', minHeight: '100vh' }} className="flex items-center justify-center">
        <div className="text-zinc-500 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  return (
    <div
      style={{ backgroundColor: '#080810', color: '#e5e7eb', minHeight: '100vh' }}
      className="flex flex-col font-sans antialiased"
    >
      {/* Header */}
      <header
        style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5" style={{ color: '#8b5cf6' }} />
          <span className="text-lg font-bold text-white">
            Vibe<span style={{ color: '#8b5cf6' }}>Engineer</span>
          </span>
        </div>
        <button
          onClick={handleSignOut}
          disabled={loadingSignout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <LogOut className="w-3 h-3" />
          {loadingSignout ? 'Signing out…' : 'Sign out'}
        </button>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-white">My Dashboard</h1>
          {userEmail && (
            <p className="text-sm mt-1" style={{ color: '#6b7280' }}>{userEmail}</p>
          )}
        </div>

        {/* Tier + Usage */}
        <div
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  background: tier === 'power' ? 'rgba(6,182,212,0.15)' : tier === 'pro' ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.06)',
                  color: tier === 'power' ? '#06b6d4' : tier === 'pro' ? '#a78bfa' : '#9ca3af',
                  border: `1px solid ${tier === 'power' ? 'rgba(6,182,212,0.30)' : tier === 'pro' ? 'rgba(139,92,246,0.30)' : 'rgba(255,255,255,0.10)'}`,
                }}
              >
                {TIER_LABELS[tier] ?? 'Free'}
              </span>
              <span className="text-sm text-zinc-400">Current plan</span>
            </div>
            {tier !== 'power' && tier !== 'owner' && (
              <button
                onClick={() => handleUpgrade(tier === 'pro' ? 'power' : 'pro')}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold hover:brightness-110 transition-all"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', color: '#fff' }}
              >
                Upgrade →
              </button>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span style={{ color: '#9ca3af' }}>This month</span>
              <span className="text-white font-medium">
                {limit === null ? `${usedBuilds} builds (unlimited)` : `${usedBuilds} / ${limit} builds used`}
              </span>
            </div>
            {limit !== null && (
              <div className="w-full rounded-full h-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${usedPercent}%`,
                    background: usedPercent >= 90 ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg, #06b6d4, #8b5cf6)',
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/chat"
            className="flex items-center justify-between rounded-xl px-5 py-4 text-sm font-semibold transition-all hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.10))',
              border: '1px solid rgba(139,92,246,0.25)',
              color: '#e5e7eb',
            }}
          >
            New build
            <span style={{ color: '#8b5cf6' }}>→</span>
          </Link>
          <Link
            href="/pricing"
            className="flex items-center justify-between rounded-xl px-5 py-4 text-sm font-semibold transition-all hover:brightness-110"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#9ca3af',
            }}
          >
            Pricing
            <span>→</span>
          </Link>
        </div>

        {/* Recent builds */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Recent builds</h2>
          {builds.length === 0 ? (
            <div
              className="rounded-2xl px-6 py-10 text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-sm" style={{ color: '#4b5563' }}>No builds yet.</p>
              <Link href="/chat" className="text-sm mt-2 inline-block" style={{ color: '#8b5cf6' }}>
                Start your first build →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {builds.slice(0, 10).map((b, i) => (
                <div
                  key={b.id ?? i}
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">
                      {b.name ?? b.prompt ?? `Build #${i + 1}`}
                    </p>
                    {b.createdAt && (
                      <p className="text-xs mt-0.5" style={{ color: '#4b5563' }}>
                        {new Date(b.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {b.url && (
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 ml-3 text-xs flex items-center gap-1 hover:text-cyan-300 transition-colors"
                      style={{ color: '#06b6d4' }}
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer
        className="border-t py-5 text-center text-xs"
        style={{ borderColor: 'rgba(255,255,255,0.05)', color: '#4b5563' }}
      >
        Built by <span style={{ color: '#8b5cf6' }}>Jeff ASI</span> + Claude
      </footer>
    </div>
  );
}
