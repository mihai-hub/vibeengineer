/**
 * VibeEngineer Builder — CDN-first pipeline
 *
 * Everything generates a self-contained HTML file:
 *   - React via unpkg CDN + Babel standalone (no build step, always works)
 *   - localStorage for all persistence
 *   - Deploy to GCS → live URL in ~10s
 *
 * If user explicitly needs a backend (auth, payments, multi-user realtime)
 * → show a "Coming soon" message. E2B removed — 4 failure modes, flaky, slow.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Storage } from '@google-cloud/storage';

export interface BuildProgress {
  type: 'step' | 'token' | 'url' | 'plan' | 'app_url' | 'app_code';
  label?: string;
  status?: 'running' | 'done' | 'error';
  text?: string;
  url?: string;
  planItems?: string[];
  stepType?: 'thinking' | 'plan' | 'tool_call' | 'tool_result' | 'agent_start' | 'agent_done' | 'security';
  files?: Record<string, string>;
}

export type ProgressFn = (p: BuildProgress) => void;

// ── Backend detection (the 2-3% we can't serve) ──────────────────────────────

const BACKEND_KEYWORDS = [
  'multi-user', 'multiuser', 'real-time multiplayer', 'payment', 'stripe',
  'oauth', 'auth0', 'social login', 'server-side', 'rest api server',
  'express server', 'fastapi', 'backend api',
];

export function needsBackend(message: string): boolean {
  const lower = message.toLowerCase();
  return BACKEND_KEYWORDS.some(k => lower.includes(k));
}

// ── GCS deploy ────────────────────────────────────────────────────────────────

const GCS_BUCKET = process.env.VIBE_GCS_BUCKET ?? 'vibeengineer-apps';

export async function deployToGCS(
  html: string,
  appId: string,
): Promise<string | null> {
  try {
    const storage = new Storage();
    const bucket = storage.bucket(GCS_BUCKET);
    const file = bucket.file(`${appId}/index.html`);
    await file.save(html, {
      contentType: 'text/html; charset=utf-8',
      metadata: { cacheControl: 'public, max-age=3600' },
    });
    return `https://storage.googleapis.com/${GCS_BUCKET}/${appId}/index.html`;
  } catch (e) {
    console.error('[GCS] upload failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ── Code generation prompts ───────────────────────────────────────────────────

const PLAN_SYSTEM = `You are VibeEngineer's planning engine. Given a build request, create a concise execution plan.
Return JSON: { "title": "short app name", "strategy": "one sentence approach", "steps": ["step 1", "step 2", ...] }
Steps should be 3-6 concrete actions (e.g. "Generate React component structure", "Add Tailwind styling", "Build and deploy to cloud").
Return ONLY valid JSON. No markdown, no code fences.`;

const CDN_SYSTEM = `You are VibeEngineer's build engine. Generate a COMPLETE, working, self-contained single HTML file.

Use React 18 via CDN for any interactive UI. Use vanilla HTML/JS for simple static pages.

REACT TEMPLATE (use for any interactive app):
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    /* ALL CSS here — dark backgrounds, vibrant accents */
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useCallback, useRef } = React;

    // All components here
    function App() {
      // Use localStorage for ALL persistence:
      const [items, setItems] = useState(() => {
        try { return JSON.parse(localStorage.getItem('app_items') || '[]'); } catch { return []; }
      });
      useEffect(() => { localStorage.setItem('app_items', JSON.stringify(items)); }, [items]);
      // ...
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
</body>
</html>

RULES:
- localStorage for ALL data persistence (survives page refresh)
- React.useState, useEffect, useCallback — destructure from React at top
- All CSS inline in <style> — dark theme, vibrant accent colors, modern look
- Fully functional — not a mockup. Every button does something.
- NO external imports beyond the 3 CDN scripts
- For charts: use inline SVG or HTML5 Canvas. For icons: Unicode or inline SVG.
Return ONLY the raw HTML starting with <!DOCTYPE html>. No markdown, no code fences.`;

const MODIFY_SYSTEM = `You are VibeEngineer's build engine. Modify the existing HTML app based on the user's request.
Apply ONLY the requested changes. Keep everything else identical.
Return ONLY the raw HTML starting with <!DOCTYPE html>. No markdown, no code fences.`;

// ── Plan generation ───────────────────────────────────────────────────────────

interface BuildPlan {
  title: string;
  strategy: string;
  steps: string[];
}

async function generatePlan(message: string, anthropic: Anthropic): Promise<BuildPlan> {
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: PLAN_SYSTEM,
      messages: [{ role: 'user', content: message }],
    });
    const raw = resp.content[0]?.type === 'text' ? resp.content[0].text.trim() : '{}';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned) as Partial<BuildPlan>;
    return {
      title: parsed.title ?? 'App',
      strategy: parsed.strategy ?? '',
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
    };
  } catch {
    return { title: 'App', strategy: '', steps: [] };
  }
}

// ── Main build function ───────────────────────────────────────────────────────

export async function build(
  message: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  onProgress: ProgressFn,
  existingFiles?: Record<string, string>,
): Promise<void> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const appId = `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // ── Backend-only requests (auth, payments, multi-user) ────────────────────
  if (needsBackend(message) && !existingFiles) {
    onProgress({
      type: 'token',
      text: `⚡ This app needs a server-side backend (auth, payments, or real-time multi-user).\n\nThat's a different product — full deployment pipelines coming soon.\n\nFor now, try: *"Build me a [app] with localStorage persistence"* — works great for 97% of use cases.`,
    });
    return;
  }

  // ── Modification of existing app ──────────────────────────────────────────
  if (existingFiles && Object.keys(existingFiles).length > 0 && isModifyRequest(message)) {
    await modifyApp(message, appId, anthropic, onProgress, existingFiles);
    return;
  }

  // ── Everything else → CDN path ────────────────────────────────────────────
  await buildCdnApp(message, appId, anthropic, onProgress);
}

// ── CDN build (all requests) ──────────────────────────────────────────────────

async function buildCdnApp(
  message: string,
  appId: string,
  anthropic: Anthropic,
  onProgress: ProgressFn,
): Promise<void> {
  const plan = await generatePlan(message, anthropic);
  onProgress({
    type: 'plan',
    stepType: 'plan',
    label: plan.title,
    planItems: plan.strategy ? [plan.strategy, ...plan.steps] : plan.steps,
    status: 'running',
  });

  onProgress({ type: 'step', label: 'Generating app…', status: 'running' });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    system: CDN_SYSTEM,
    messages: [{ role: 'user', content: message }],
  });

  const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
  const html = raw.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  if (!html.startsWith('<!DOCTYPE') && !html.startsWith('<html')) {
    onProgress({ type: 'step', label: 'Generation failed', status: 'error' });
    onProgress({ type: 'token', text: 'Failed to generate the app. Please try again.' });
    return;
  }

  onProgress({ type: 'step', label: 'App generated ✓', status: 'done' });
  onProgress({ type: 'step', label: 'Deploying to cloud…', status: 'running' });

  const url = await deployToGCS(html, appId);
  onProgress({ type: 'step', label: 'Deployed ✓', status: 'done' });

  if (url) {
    onProgress({ type: 'app_url', url });
    onProgress({ type: 'app_code', files: { 'index.html': html } });
    onProgress({ type: 'token', text: `✅ **Live at:** [Open app](${url})` });
  } else {
    onProgress({ type: 'token', text: '✅ App generated. GCS deploy failed — check VIBE_GCS_BUCKET env var.' });
  }
}

// ── Modify existing app ───────────────────────────────────────────────────────

async function modifyApp(
  message: string,
  appId: string,
  anthropic: Anthropic,
  onProgress: ProgressFn,
  existingFiles: Record<string, string>,
): Promise<void> {
  onProgress({ type: 'step', label: 'Modifying app…', status: 'running' });

  const existingHtml = existingFiles['index.html'] ?? Object.values(existingFiles)[0] ?? '';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    system: MODIFY_SYSTEM,
    messages: [
      { role: 'user', content: `Existing code:\n${existingHtml}\n\nUser request: ${message}` },
    ],
  });

  const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
  const html = raw.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  onProgress({ type: 'step', label: 'Modified ✓', status: 'done' });
  onProgress({ type: 'step', label: 'Deploying…', status: 'running' });

  const url = await deployToGCS(html, appId);
  onProgress({ type: 'step', label: 'Deployed ✓', status: 'done' });

  if (url) {
    onProgress({ type: 'app_url', url });
    onProgress({ type: 'app_code', files: { 'index.html': html } });
    onProgress({ type: 'token', text: `✅ **Updated:** [Open app](${url})` });
  } else {
    onProgress({ type: 'token', text: '✅ App updated. GCS deploy failed — check env vars.' });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isModifyRequest(message: string): boolean {
  const lower = message.toLowerCase();
  const modifyKeywords = ['change', 'update', 'fix', 'modify', 'make it', 'add', 'remove', 'replace', 'adjust', 'edit', 'improve'];
  return modifyKeywords.some(k => lower.startsWith(k) || lower.includes(`${k} the`) || lower.includes(`${k} it`));
}
