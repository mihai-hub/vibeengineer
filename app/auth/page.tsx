'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase-client';

type Tab = 'signin' | 'signup';

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // If already signed in, go to /chat
  useEffect(() => {
    const supabase = getSupabaseClient();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace('/chat');
    });
    // Also check immediately
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace('/chat');
    });
    return () => { listener.subscription.unsubscribe(); };
  }, [router]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const supabase = getSupabaseClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/chat`,
        },
      });
      if (authError) {
        setError(authError.message);
      } else {
        setSent(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{ backgroundColor: '#080810', color: '#e5e7eb', minHeight: '100vh' }}
      className="flex flex-col items-center justify-center font-sans antialiased px-4"
    >
      {/* Back link */}
      <Link
        href="/"
        className="absolute top-6 left-6 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        ← Back to home
      </Link>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(139,92,246,0.20)',
          boxShadow: '0 0 60px rgba(139,92,246,0.08)',
        }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" style={{ color: '#8b5cf6' }} />
            <span className="text-xl font-bold text-white">
              Vibe<span style={{ color: '#8b5cf6' }}>Engineer</span>
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex rounded-xl p-1 mb-6"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          {(['signin', 'signup'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSent(false); setError(''); }}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: tab === t ? 'rgba(139,92,246,0.20)' : 'transparent',
                color: tab === t ? '#a78bfa' : '#6b7280',
                border: tab === t ? '1px solid rgba(139,92,246,0.30)' : '1px solid transparent',
              }}
            >
              {t === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        {sent ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-3">📬</div>
            <p className="text-white font-semibold mb-2">Check your email</p>
            <p className="text-sm" style={{ color: '#6b7280' }}>
              We sent a magic link to <strong className="text-zinc-300">{email}</strong>.
              Click it to sign in.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="mt-4 text-xs underline"
              style={{ color: '#8b5cf6' }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(139,92,246,0.25)',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(139,92,246,0.60)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(139,92,246,0.25)')}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', color: '#fff' }}
            >
              {loading ? 'Sending…' : tab === 'signin' ? 'Send magic link' : 'Create account'}
            </button>

            <p className="text-center text-xs" style={{ color: '#4b5563' }}>
              No password needed. We&apos;ll email you a secure link.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
