/**
 * VibeEngineer Billing System
 *
 * Tiers:
 *   free    — 3 CDN builds/month, fast lane only after that
 *   pro     — $29/mo — 50 builds/month, Sonnet, CDN + Real App
 *   power   — $79/mo — unlimited builds, Opus, all features
 *   payg    — pay-as-you-go: $0.10/CDN build, $0.50/Real App build
 *   owner   — VIBE_OWNER_SECRET check → unlimited, uses server ANTHROPIC_API_KEY
 *
 * Usage is tracked in Supabase table: vibe_usage
 */

import { createClient } from '@supabase/supabase-js';

export type Tier = 'free' | 'pro' | 'power' | 'payg' | 'owner';
export type BuildType = 'cdn' | 'real' | 'fast';

export interface TierConfig {
  label: string;
  price: number;  // monthly USD, 0 = free, -1 = payg
  buildsPerMonth: number | null;  // null = unlimited
  canUseOpus: boolean;
  canUseReal: boolean;
  canUseDesign: boolean;
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  free: {
    label: 'Free',
    price: 0,
    buildsPerMonth: 3,
    canUseOpus: false,
    canUseReal: false,
    canUseDesign: false,
  },
  pro: {
    label: 'Pro',
    price: 29,
    buildsPerMonth: 50,
    canUseOpus: false,
    canUseReal: true,
    canUseDesign: true,
  },
  power: {
    label: 'Power',
    price: 79,
    buildsPerMonth: null,  // unlimited
    canUseOpus: true,
    canUseReal: true,
    canUseDesign: true,
  },
  payg: {
    label: 'Pay as you go',
    price: -1,
    buildsPerMonth: null,
    canUseOpus: true,
    canUseReal: true,
    canUseDesign: true,
  },
  owner: {
    label: 'Owner',
    price: 0,
    buildsPerMonth: null,
    canUseOpus: true,
    canUseReal: true,
    canUseDesign: true,
  },
};

// Cost per build for PAYG (in USD cents)
export const PAYG_COST: Record<BuildType, number> = {
  fast: 0,    // fast lane is free (Haiku, cheap)
  cdn: 10,    // $0.10
  real: 50,   // $0.50
};

// ── Supabase client (server-side only) ────────────────────────────────────────
function getServerSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE ?? '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Owner check ───────────────────────────────────────────────────────────────
export function isOwnerRequest(ownerSecret?: string): boolean {
  const serverSecret = process.env.VIBE_OWNER_SECRET;
  if (!serverSecret) return false;
  return ownerSecret === serverSecret;
}

// ── Get user tier ─────────────────────────────────────────────────────────────
export async function getUserTier(userId: string): Promise<Tier> {
  const sb = getServerSupabase();
  if (!sb) return 'free';

  const { data } = await sb
    .from('vibe_subscriptions')
    .select('tier, stripe_status, period_end')
    .eq('user_id', userId)
    .single();

  if (!data) return 'free';
  if (data.stripe_status !== 'active') return 'free';
  if (data.period_end && new Date(data.period_end) < new Date()) return 'free';
  return (data.tier as Tier) ?? 'free';
}

// ── Check usage limit ─────────────────────────────────────────────────────────
export async function checkUsageLimit(
  userId: string,
  tier: Tier,
  buildType: BuildType,
): Promise<{ allowed: boolean; used: number; limit: number | null; reason?: string }> {
  const config = TIER_CONFIG[tier];

  // Owner + power + payg = always allowed
  if (tier === 'owner' || tier === 'power' || tier === 'payg') {
    return { allowed: true, used: 0, limit: null };
  }

  // Check feature access
  if (buildType === 'real' && !config.canUseReal) {
    return { allowed: false, used: 0, limit: 0, reason: 'Real App builds require Pro plan or higher.' };
  }

  if (config.buildsPerMonth === null) {
    return { allowed: true, used: 0, limit: null };
  }

  const sb = getServerSupabase();
  if (!sb) return { allowed: true, used: 0, limit: config.buildsPerMonth };

  // Count builds this calendar month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await sb
    .from('vibe_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('build_type', ['cdn', 'real'])
    .gte('created_at', startOfMonth.toISOString());

  const used = count ?? 0;
  const allowed = used < config.buildsPerMonth;

  return {
    allowed,
    used,
    limit: config.buildsPerMonth,
    reason: allowed ? undefined : `Monthly limit reached (${used}/${config.buildsPerMonth} builds). Upgrade to Pro for more.`,
  };
}

// ── Record usage ──────────────────────────────────────────────────────────────
export async function recordUsage(
  userId: string,
  buildType: BuildType,
  tier: Tier,
  tokensUsed?: number,
): Promise<void> {
  const sb = getServerSupabase();
  if (!sb || tier === 'owner') return;

  await sb.from('vibe_usage').insert({
    user_id: userId,
    build_type: buildType,
    tier,
    tokens_used: tokensUsed ?? 0,
    cost_cents: tier === 'payg' ? PAYG_COST[buildType] : 0,
  });
}

// ── Get usage summary ─────────────────────────────────────────────────────────
export async function getUsageSummary(userId: string, tier: Tier) {
  const config = TIER_CONFIG[tier];
  const sb = getServerSupabase();
  if (!sb) return { used: 0, limit: config.buildsPerMonth, resetDate: null };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const nextMonth = new Date(startOfMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const { count } = await sb
    .from('vibe_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('build_type', ['cdn', 'real'])
    .gte('created_at', startOfMonth.toISOString());

  return {
    used: count ?? 0,
    limit: config.buildsPerMonth,
    resetDate: nextMonth.toISOString(),
  };
}
