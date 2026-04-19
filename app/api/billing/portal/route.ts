export const runtime = 'nodejs';

/**
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session.
 * Body: { customerId: string }
 * Returns: { url: string }
 */
export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return Response.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  let customerId: string;
  try {
    const body = (await req.json()) as { customerId?: string };
    if (!body.customerId) throw new Error('missing customerId');
    customerId = body.customerId;
  } catch {
    return Response.json({ error: 'customerId required' }, { status: 400 });
  }

  const returnUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://vibeengineer-918891972282.europe-west1.run.app/dashboard';

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      customer: customerId,
      return_url: returnUrl,
    }).toString(),
  });

  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    return Response.json(
      { error: err?.error?.message ?? 'Stripe error' },
      { status: res.status },
    );
  }

  const session = (await res.json()) as { url: string };
  return Response.json({ url: session.url });
}
