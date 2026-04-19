export const runtime = 'nodejs';

/**
 * GET /api/billing/setup
 * Returns the billing SQL to run in Supabase SQL Editor.
 * Protected by x-owner-secret header.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('x-owner-secret');
  if (authHeader !== process.env.VIBE_OWNER_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = `-- VibeEngineer Billing Tables
-- Run in Supabase SQL Editor

-- Subscriptions (Stripe manages recurring billing)
create table if not exists vibe_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  email text,
  tier text not null default 'free',        -- free | pro | power | payg
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_status text default 'inactive',    -- active | canceled | past_due
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Usage tracking (per build)
create table if not exists vibe_usage (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  build_type text not null,   -- cdn | real | fast
  tier text not null,
  tokens_used int default 0,
  cost_cents int default 0,   -- for PAYG billing
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_vibe_usage_user_month
  on vibe_usage(user_id, created_at);

create index if not exists idx_vibe_subscriptions_user
  on vibe_subscriptions(user_id);

-- RLS: users can only see their own data
alter table vibe_subscriptions enable row level security;
alter table vibe_usage enable row level security;

-- Service role bypasses RLS (used by backend)
-- Frontend can read own subscription
create policy "users read own subscription"
  on vibe_subscriptions for select
  using (auth.uid()::text = user_id);

create policy "users read own usage"
  on vibe_usage for select
  using (auth.uid()::text = user_id);`;

  return Response.json({
    sql,
    instructions:
      'Run this SQL in your Supabase SQL Editor at ' +
      'https://supabase.com/dashboard/project/sxlgpsrbmkvzjfxitezn/sql',
  });
}
