/**
 * GET /api/billing/status?userId=xxx
 * Returns the user's current tier and usage.
 */
import { getUserTier, getUsageSummary } from '../../../../lib/billing';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return Response.json({ error: 'userId required' }, { status: 400 });
  }

  const tier = await getUserTier(userId);
  const { used, limit, resetDate } = await getUsageSummary(userId, tier);

  return Response.json({ tier, used, limit, resetDate });
}
