/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout session for subscription or PAYG top-up
 * Body: { tier: 'pro' | 'power' | 'payg', userId, email, returnUrl }
 */

export const runtime = 'nodejs';

const PRICE_IDS: Record<string, string> = {
  pro: process.env.STRIPE_PRICE_PRO ?? '',      // $29/mo recurring
  power: process.env.STRIPE_PRICE_POWER ?? '',  // $79/mo recurring
  payg: process.env.STRIPE_PRICE_PAYG ?? '',    // $10 credit top-up
};

export async function POST(req: Request): Promise<Response> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return Response.json({ error: 'Stripe not configured' }, { status: 400 });

  let body: { tier?: string; userId?: string; email?: string; returnUrl?: string };
  try { body = await req.json() as typeof body; } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { tier, userId, email, returnUrl = 'https://vibeengineer-918891972282.europe-west1.run.app/chat' } = body;
  if (!tier || !userId) return Response.json({ error: 'tier and userId required' }, { status: 400 });

  const priceId = PRICE_IDS[tier];
  if (!priceId) return Response.json({ error: `No price configured for tier: ${tier}. Set STRIPE_PRICE_${tier.toUpperCase()} env var.` }, { status: 400 });

  try {
    const isSubscription = tier !== 'payg';

    const sessionBody = {
      mode: isSubscription ? 'subscription' : 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId,
      success_url: `${returnUrl}?upgraded=1`,
      cancel_url: returnUrl,
      metadata: { userId, tier },
      ...(isSubscription ? {
        subscription_data: { metadata: { userId, tier } },
      } : {}),
    };

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(flattenStripeParams(sessionBody)).toString(),
    });

    const session = await res.json() as { url?: string; error?: { message: string } };
    if (!res.ok || !session.url) {
      return Response.json({ error: session.error?.message ?? 'Stripe error' }, { status: 500 });
    }

    return Response.json({ url: session.url });
  } catch (err: unknown) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// Stripe API needs flat form-encoded params
function flattenStripeParams(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (val === null || val === undefined) continue;
    if (typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenStripeParams(val as Record<string, unknown>, fullKey));
    } else if (Array.isArray(val)) {
      val.forEach((item, i) => {
        if (typeof item === 'object') {
          Object.assign(result, flattenStripeParams(item as Record<string, unknown>, `${fullKey}[${i}]`));
        } else {
          result[`${fullKey}[${i}]`] = String(item);
        }
      });
    } else {
      result[fullKey] = String(val);
    }
  }
  return result;
}
