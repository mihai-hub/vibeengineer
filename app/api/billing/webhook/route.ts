/**
 * POST /api/billing/webhook
 * Stripe webhook — updates vibe_subscriptions table on payment events
 * Set in Stripe Dashboard: endpoint = https://.../api/billing/webhook
 */

export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE ?? '',
    { auth: { persistSession: false } },
  );
}

export async function POST(req: Request): Promise<Response> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey) return new Response('Stripe not configured', { status: 400 });

  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  // Verify signature if secret is set
  if (webhookSecret) {
    const valid = await verifyStripeSignature(body, sig, webhookSecret);
    if (!valid) return new Response('Invalid signature', { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body) as typeof event;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const sb = getSupabase();
  const obj = event.data.object;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const meta = obj.metadata as Record<string, string> | undefined;
        const userId = (obj.client_reference_id ?? meta?.userId) as string;
        const tier = (obj.metadata as Record<string, string>)?.tier ?? 'pro';
        const email = obj.customer_email as string;
        const customerId = obj.customer as string;
        const subId = obj.subscription as string | undefined;

        await sb.from('vibe_subscriptions').upsert({
          user_id: userId,
          email,
          tier,
          stripe_customer_id: customerId,
          stripe_subscription_id: subId ?? null,
          stripe_status: 'active',
          period_start: new Date().toISOString(),
          period_end: subId ? null : new Date(Date.now() + 30 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subId = obj.id as string;
        const status = obj.status as string;
        const periodEnd = obj.current_period_end as number;
        const tier = (obj.metadata as Record<string, string>)?.tier ?? 'pro';

        await sb.from('vibe_subscriptions')
          .update({
            stripe_status: status === 'active' ? 'active' : status === 'canceled' ? 'canceled' : 'past_due',
            tier: status === 'active' ? tier : 'free',
            period_end: new Date(periodEnd * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subId);
        break;
      }

      case 'invoice.payment_failed': {
        const customerId = obj.customer as string;
        await sb.from('vibe_subscriptions')
          .update({ stripe_status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', customerId);
        break;
      }
    }
  } catch (err) {
    console.error('[webhook]', event.type, err);
  }

  return new Response('ok', { status: 200 });
}

async function verifyStripeSignature(payload: string, sig: string, secret: string): Promise<boolean> {
  try {
    const parts = sig.split(',').reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split('=');
      acc[k] = v;
      return acc;
    }, {});
    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature) return false;

    // Reject signatures older than 5 minutes (Stripe spec)
    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (age > 300) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
    return expected === signature;
  } catch {
    return false;
  }
}
