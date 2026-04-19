/**
 * lib/shopify-connector.ts — VibeEngineer Phase 4 business connector
 *
 * Reads product data from a Shopify store via:
 *   - Admin REST API (if adminToken provided)
 *   - Storefront GraphQL API (public, fallback)
 */

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  imageUrl?: string;
  variants: { title: string; price: string; sku?: string }[];
}

// ---------------------------------------------------------------------------
// Admin API (REST)
// ---------------------------------------------------------------------------

interface AdminVariant {
  id: number;
  title: string;
  price: string;
  sku?: string;
}

interface AdminImage {
  src: string;
}

interface AdminProduct {
  id: number;
  title: string;
  body_html: string;
  variants: AdminVariant[];
  images: AdminImage[];
}

interface AdminProductsResponse {
  products: AdminProduct[];
}

async function fetchViaAdminApi(
  storeUrl: string,
  adminToken: string,
): Promise<ShopifyProduct[]> {
  const url = `https://${storeUrl}/admin/api/2024-01/products.json?limit=50`;
  const res = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': adminToken,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Admin API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as AdminProductsResponse;

  return (data.products ?? []).map((p) => ({
    id: String(p.id),
    title: p.title,
    description: stripHtml(p.body_html ?? ''),
    price: p.variants?.[0]?.price ?? '0.00',
    currency: 'USD', // Admin API v1 doesn't return currency per product; use presentment_price if needed
    imageUrl: p.images?.[0]?.src,
    variants: (p.variants ?? []).map((v) => ({
      title: v.title,
      price: v.price,
      sku: v.sku ?? undefined,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Storefront GraphQL API (public)
// ---------------------------------------------------------------------------

interface StorefrontVariantNode {
  title: string;
  sku?: string;
  price: { amount: string; currencyCode: string };
}

interface StorefrontProductNode {
  id: string;
  title: string;
  description: string;
  featuredImage?: { url: string };
  variants: { edges: { node: StorefrontVariantNode }[] };
}

interface StorefrontResponse {
  data?: {
    products?: {
      edges?: { node: StorefrontProductNode }[];
    };
  };
  errors?: { message: string }[];
}

const STOREFRONT_QUERY = `{
  products(first: 50) {
    edges {
      node {
        id
        title
        description
        featuredImage { url }
        variants(first: 10) {
          edges {
            node {
              title
              sku
              price { amount currencyCode }
            }
          }
        }
      }
    }
  }
}`;

async function fetchViaStorefrontApi(storeUrl: string): Promise<ShopifyProduct[]> {
  const url = `https://${storeUrl}/api/2024-01/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Public access token header — stores must have Storefront API enabled
      'X-Shopify-Storefront-Access-Token': 'public',
    },
    body: JSON.stringify({ query: STOREFRONT_QUERY }),
  });

  if (!res.ok) {
    throw new Error(`Storefront API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as StorefrontResponse;

  if (data.errors && data.errors.length > 0) {
    throw new Error(`Storefront GraphQL error: ${data.errors[0]?.message}`);
  }

  const edges = data.data?.products?.edges ?? [];

  return edges.map(({ node: p }) => {
    const firstVariant = p.variants.edges[0]?.node;
    return {
      id: p.id,
      title: p.title,
      description: p.description ?? '',
      price: firstVariant?.price.amount ?? '0.00',
      currency: firstVariant?.price.currencyCode ?? 'USD',
      imageUrl: p.featuredImage?.url,
      variants: p.variants.edges.map(({ node: v }) => ({
        title: v.title,
        price: v.price.amount,
        sku: v.sku ?? undefined,
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches products from a Shopify store.
 * Uses Admin API if adminToken is provided, otherwise Storefront GraphQL.
 * Returns [] on any error.
 */
export async function fetchShopifyProducts(
  storeUrl: string,
  adminToken?: string,
): Promise<ShopifyProduct[]> {
  // Normalise URL: strip https:// and trailing slashes
  const host = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  try {
    if (adminToken) {
      return await fetchViaAdminApi(host, adminToken);
    }
    return await fetchViaStorefrontApi(host);
  } catch (err) {
    console.error('[shopify-connector] fetch failed:', err);
    return [];
  }
}

/**
 * Formats a list of Shopify products as a markdown table for Claude system prompt injection.
 */
export function formatProductsForPrompt(products: ShopifyProduct[]): string {
  if (products.length === 0) return 'No Shopify products available.';

  const header = '| Title | Price | Description |\n|-------|-------|-------------|';
  const rows = products
    .map((p) => {
      const desc = truncate(p.description, 100);
      const price = `${p.currency} ${p.price}`;
      return `| ${p.title} | ${price} | ${desc} |`;
    })
    .join('\n');

  return `## Shopify Products (${products.length} total)\n\n${header}\n${rows}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}
