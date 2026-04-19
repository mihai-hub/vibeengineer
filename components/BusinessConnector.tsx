'use client';

/**
 * components/BusinessConnector.tsx — VibeEngineer Phase 4 business data connector
 *
 * Modal/panel with tabs: Shopify | WooCommerce | Manual
 * Fetches product data and injects formatted context into the next build.
 */

import { useState } from 'react';
import type { ShopifyProduct } from '@/lib/shopify-connector';

interface BusinessConnectorProps {
  onConnected: (context: string) => void; // injects context into next build
  onClose: () => void;
}

type Tab = 'shopify' | 'woocommerce' | 'manual';

type ConnectState = 'idle' | 'loading' | 'done' | 'error';

function Spinner() {
  return (
    <svg
      className="animate-spin w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active
          ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-700/60'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function InputField({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-zinc-400 text-xs">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-zinc-200 text-xs placeholder-zinc-600 focus:outline-none focus:border-cyan-600 transition-colors"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shopify Tab
// ---------------------------------------------------------------------------

function ShopifyTab({ onConnected }: { onConnected: (ctx: string) => void }) {
  const [storeUrl, setStoreUrl] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [state, setState] = useState<ConnectState>('idle');
  const [productCount, setProductCount] = useState<number | null>(null);
  const [formatted, setFormatted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!storeUrl.trim()) return;
    setState('loading');
    setError(null);

    try {
      const res = await fetch('/api/vibe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'shopify',
          storeUrl: storeUrl.trim(),
          adminToken: adminToken.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        products: ShopifyProduct[];
        formatted: string;
      };

      setProductCount(data.products.length);
      setFormatted(data.formatted);
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  };

  return (
    <div className="space-y-3">
      <InputField
        label="Store URL"
        placeholder="mystore.myshopify.com"
        value={storeUrl}
        onChange={setStoreUrl}
      />
      <InputField
        label="Admin Token (optional — for private stores)"
        placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
        value={adminToken}
        onChange={setAdminToken}
        type="password"
      />

      <button
        className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-cyan-700/60 hover:bg-cyan-600/60 border border-cyan-600/60 text-cyan-100 text-xs font-semibold transition-colors disabled:opacity-50"
        onClick={handleConnect}
        disabled={state === 'loading' || !storeUrl.trim()}
      >
        {state === 'loading' ? (
          <>
            <Spinner />
            <span>Connecting\u2026</span>
          </>
        ) : (
          <span>Connect</span>
        )}
      </button>

      {state === 'error' && error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}

      {state === 'done' && productCount !== null && (
        <div className="space-y-2">
          <p className="text-emerald-400 text-xs">
            \u2713 Connected — {productCount} product{productCount !== 1 ? 's' : ''} loaded
          </p>
          {formatted && (
            <button
              className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-violet-700/60 hover:bg-violet-600/60 border border-violet-600/60 text-violet-100 text-xs font-semibold transition-colors"
              onClick={() => onConnected(formatted)}
            >
              Use in next build
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WooCommerce Tab
// ---------------------------------------------------------------------------

function WooCommerceTab({ onConnected }: { onConnected: (ctx: string) => void }) {
  const [siteUrl, setSiteUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [state, setState] = useState<ConnectState>('idle');
  const [productCount, setProductCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!siteUrl.trim() || !consumerKey.trim() || !consumerSecret.trim()) return;
    setState('loading');
    setError(null);

    try {
      const host = siteUrl.trim().replace(/\/$/, '');
      const url = `${host}/wp-json/wc/v3/products?per_page=50&consumer_key=${encodeURIComponent(consumerKey)}&consumer_secret=${encodeURIComponent(consumerSecret)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`WooCommerce API error: ${res.status}`);

      const products = (await res.json()) as {
        name: string;
        price: string;
        description: string;
      }[];

      setProductCount(products.length);

      const header = '| Title | Price | Description |\n|-------|-------|-------------|';
      const rows = products
        .map((p) => {
          const desc = (p.description ?? '').replace(/<[^>]+>/g, '').slice(0, 100);
          return `| ${p.name} | ${p.price} | ${desc} |`;
        })
        .join('\n');

      const formatted = `## WooCommerce Products (${products.length} total)\n\n${header}\n${rows}`;
      setState('done');

      onConnected(formatted);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  };

  return (
    <div className="space-y-3">
      <InputField
        label="Site URL"
        placeholder="https://mystore.com"
        value={siteUrl}
        onChange={setSiteUrl}
      />
      <InputField
        label="Consumer Key"
        placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        value={consumerKey}
        onChange={setConsumerKey}
      />
      <InputField
        label="Consumer Secret"
        placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        value={consumerSecret}
        onChange={setConsumerSecret}
        type="password"
      />

      <button
        className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-cyan-700/60 hover:bg-cyan-600/60 border border-cyan-600/60 text-cyan-100 text-xs font-semibold transition-colors disabled:opacity-50"
        onClick={handleConnect}
        disabled={
          state === 'loading' ||
          !siteUrl.trim() ||
          !consumerKey.trim() ||
          !consumerSecret.trim()
        }
      >
        {state === 'loading' ? (
          <>
            <Spinner />
            <span>Connecting\u2026</span>
          </>
        ) : (
          <span>Connect</span>
        )}
      </button>

      {state === 'error' && error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}

      {state === 'done' && productCount !== null && (
        <p className="text-emerald-400 text-xs">
          \u2713 Connected — {productCount} product{productCount !== 1 ? 's' : ''} injected into next build
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual Tab
// ---------------------------------------------------------------------------

function ManualTab({ onConnected }: { onConnected: (ctx: string) => void }) {
  const [data, setData] = useState('');

  const handleUse = () => {
    if (!data.trim()) return;
    onConnected(`## Business Data (manual)\n\n${data.trim()}`);
  };

  return (
    <div className="space-y-3">
      <label className="text-zinc-400 text-xs">
        Paste any CSV, JSON, or plain-text business data
      </label>
      <textarea
        className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-zinc-200 text-xs placeholder-zinc-600 focus:outline-none focus:border-cyan-600 transition-colors resize-none font-mono"
        rows={8}
        value={data}
        onChange={(e) => setData(e.target.value)}
        placeholder={'Product,Price,Revenue\nPro Plan,$49,12000\nStarter,$9,3200\n...'}
      />
      <button
        className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-violet-700/60 hover:bg-violet-600/60 border border-violet-600/60 text-violet-100 text-xs font-semibold transition-colors disabled:opacity-50"
        onClick={handleUse}
        disabled={!data.trim()}
      >
        Use in next build
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BusinessConnector({ onConnected, onClose }: BusinessConnectorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('shopify');

  const handleConnected = (ctx: string) => {
    onConnected(ctx);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div>
            <h2 className="text-zinc-100 text-sm font-semibold">Connect Business Data</h2>
            <p className="text-zinc-500 text-xs mt-0.5">
              Inject real product data into your next build
            </p>
          </div>
          <button
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-lg leading-none"
            onClick={onClose}
          >
            \u00D7
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 px-4 pt-3">
          <TabButton
            label="\uD83D\uDECD Shopify"
            active={activeTab === 'shopify'}
            onClick={() => setActiveTab('shopify')}
          />
          <TabButton
            label="\uD83D\uDED2 WooCommerce"
            active={activeTab === 'woocommerce'}
            onClick={() => setActiveTab('woocommerce')}
          />
          <TabButton
            label="\uD83D\uDCCB Manual"
            active={activeTab === 'manual'}
            onClick={() => setActiveTab('manual')}
          />
        </div>

        {/* Tab Content */}
        <div className="px-4 py-4">
          {activeTab === 'shopify' && <ShopifyTab onConnected={handleConnected} />}
          {activeTab === 'woocommerce' && <WooCommerceTab onConnected={handleConnected} />}
          {activeTab === 'manual' && <ManualTab onConnected={handleConnected} />}
        </div>
      </div>
    </div>
  );
}
