/**
 * app/api/vibe/connect/route.ts — Business data connector endpoint
 *
 * POST { type: 'shopify', storeUrl, adminToken? }
 * Returns { products, formatted }
 */

import { fetchShopifyProducts, formatProductsForPrompt } from '@/lib/shopify-connector';

interface ConnectBody {
  type: 'shopify';
  storeUrl: string;
  adminToken?: string;
}

export async function POST(req: Request): Promise<Response> {
  let body: ConnectBody;

  try {
    body = (await req.json()) as ConnectBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { type, storeUrl, adminToken } = body;

  if (!type || !storeUrl) {
    return Response.json({ error: 'type and storeUrl are required' }, { status: 400 });
  }

  if (type !== 'shopify') {
    return Response.json({ error: `Unsupported connector type: ${type}` }, { status: 400 });
  }

  const products = await fetchShopifyProducts(storeUrl, adminToken);
  const formatted = formatProductsForPrompt(products);

  return Response.json({ products, formatted });
}
