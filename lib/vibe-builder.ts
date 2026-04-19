/**
 * VibeEngineer Builder — Production Code Execution Pipeline
 *
 * Like Claude Computer / Perplexity Computer:
 *   1. Generate code (Claude Sonnet)
 *   2. Run it in E2B sandbox
 *   3. See errors — auto-fix (up to 3 attempts)
 *   4. Deploy to GCS → live URL
 *
 * Smart routing:
 *   - Simple HTML → Claude generates → GCS (fast, no sandbox needed)
 *   - React/Node/complex → E2B sandbox → build → GCS dist upload
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

// ── Complexity detection ──────────────────────────────────────────────────────

// React keywords — use CDN-React path (no build step needed)
const REACT_KEYWORDS = [
  'react', 'vue', 'angular', 'next.js', 'nextjs', 'svelte',
];

// Complex = needs E2B sandbox (Node backend, multi-file, database)
const COMPLEX_KEYWORDS = [
  'node', 'express', 'fastapi', 'backend', 'api server', 'database',
  'full stack', 'fullstack', 'websocket', 'rest api',
];

export function isReactApp(message: string): boolean {
  const lower = message.toLowerCase();
  return REACT_KEYWORDS.some(k => lower.includes(k));
}

export function isComplexApp(message: string): boolean {
  const lower = message.toLowerCase();
  return COMPLEX_KEYWORDS.some(k => lower.includes(k));
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

export async function deployDirToGCS(
  files: Record<string, string>,
  appId: string,
): Promise<string | null> {
  try {
    const storage = new Storage();
    const bucket = storage.bucket(GCS_BUCKET);
    await Promise.all(
      Object.entries(files).map(([path, content]) =>
        bucket.file(`${appId}/${path}`).save(content, {
          contentType: path.endsWith('.html')
            ? 'text/html; charset=utf-8'
            : path.endsWith('.js')
            ? 'application/javascript'
            : path.endsWith('.css')
            ? 'text/css'
            : 'application/octet-stream',
          metadata: { cacheControl: 'public, max-age=3600' },
        })
      )
    );
    return `https://storage.googleapis.com/${GCS_BUCKET}/${appId}/index.html`;
  } catch (e) {
    console.error('[GCS] dir upload failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ── E2B sandbox build ─────────────────────────────────────────────────────────

interface SandboxResult {
  success: boolean;
  output: string;
  distFiles?: Record<string, string>;
}

async function buildInSandbox(
  projectFiles: Record<string, string>,
  onProgress: (msg: string) => void,
): Promise<SandboxResult> {
  const { Sandbox } = await import('e2b');
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    return { success: false, output: 'E2B_API_KEY not configured' };
  }

  let sandbox: InstanceType<typeof Sandbox> | null = null;
  try {
    sandbox = await Sandbox.create({ apiKey, timeoutMs: 180000 });
    onProgress('Sandbox ready');

    // Write project files
    for (const [path, content] of Object.entries(projectFiles)) {
      await sandbox.files.write(`/app/${path}`, content);
    }
    onProgress('Files written');

    // npm install
    const installOut = await sandbox.commands.run('cd /app && npm install --legacy-peer-deps 2>&1', { timeoutMs: 90000 });
    if (installOut.exitCode !== 0) {
      return { success: false, output: `npm install failed:\n${installOut.stdout}\n${installOut.stderr}` };
    }
    onProgress('Dependencies installed');

    // npm run build
    const buildOut = await sandbox.commands.run('cd /app && npm run build 2>&1', { timeoutMs: 90000 });
    if (buildOut.exitCode !== 0) {
      return {
        success: false,
        output: `Build failed:\n${buildOut.stdout}\n${buildOut.stderr}`,
      };
    }
    onProgress('Build succeeded');

    // Read dist files
    const distFiles: Record<string, string> = {};
    try {
      const ls = await sandbox.commands.run("find /app/dist -type f | head -50");
      const paths = ls.stdout.trim().split('\n').filter(Boolean);
      for (const p of paths) {
        const rel = p.replace('/app/dist/', '');
        const content = await sandbox.files.read(p);
        distFiles[rel] = typeof content === 'string' ? content : new TextDecoder().decode(content as Uint8Array);
      }
    } catch {
      // dist read failed — still success if build passed
    }
    onProgress('Files read');

    return { success: true, output: buildOut.stdout, distFiles };
  } catch (e) {
    return { success: false, output: e instanceof Error ? e.message : String(e) };
  } finally {
    if (sandbox) {
      try { await sandbox.kill(); } catch { /* ignore */ }
    }
  }
}

// ── Code generation prompts ───────────────────────────────────────────────────

const PLAN_SYSTEM = `You are VibeEngineer's planning engine. Given a build request, create a concise execution plan.
Return JSON: { "title": "short app name", "strategy": "one sentence approach", "steps": ["step 1", "step 2", ...] }
Steps should be 3-6 concrete actions (e.g. "Generate React component structure", "Add Tailwind styling", "Build and deploy to cloud").
Return ONLY valid JSON. No markdown, no code fences.`;

const REACT_CDN_SYSTEM = `You are VibeEngineer's build engine. Generate a COMPLETE, working, self-contained single HTML file that uses React via CDN (no build step).

REQUIRED structure:
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>App</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>/* all CSS here */</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    // All React components here using React.useState, React.useEffect etc
    // Use React.createElement OR JSX (Babel standalone will transpile)
    function App() { ... }
    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
</body>
</html>

RULES:
- Use React.useState, React.useEffect, React.useCallback (React is global)
- localStorage works fine for persistence
- All CSS inline in <style> tags — dark backgrounds, vibrant accents
- Fully functional — not a mockup
- NO external imports beyond the 3 CDN scripts above
Return ONLY the raw HTML starting with <!DOCTYPE html>. No markdown, no code fences.`;

const HTML_SYSTEM = `You are VibeEngineer's build engine. Generate a COMPLETE, working, self-contained single HTML file.
- All CSS inline in <style> tags
- All JS inline in <script> tags
- No external dependencies that could fail
- Modern, beautiful dark UI with gradients
- Fully functional — not a mockup
Return ONLY the raw HTML starting with <!DOCTYPE html>. No markdown, no code fences, no explanation.`;

// Specialist subagent prompts — run in parallel, results merged
const COMPONENT_AGENT = `You are a React component specialist. Given a build request, generate ONLY the React component files.
Return JSON with keys: "src/App.jsx", "src/App.css", and any extra component files (e.g. "src/components/Card.jsx").
Components must be self-contained with no external imports beyond react and react-dom.
Use inline SVG for charts/icons. Return ONLY valid JSON. No markdown.`;

const STRUCTURE_AGENT = `You are a React project structure specialist. Given a build request, generate ONLY the project config files.
Return JSON with EXACTLY these keys: "package.json", "index.html", "vite.config.js".
package.json: only react@^18, react-dom@^18 as deps; vite@^5, @vitejs/plugin-react@^4 as devDeps; scripts: {"build":"vite build","dev":"vite"}.
vite.config.js: import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()], base: './' })
index.html: standard HTML5 with <script type="module" src="./src/main.jsx"></script> and title matching the app.
Return ONLY valid JSON. No markdown.`;

const ENTRYPOINT_AGENT = `You are a React entrypoint specialist. Generate ONLY src/main.jsx for a React 18 app.
Return JSON with exactly one key: "src/main.jsx".
Content: import React from 'react'; import ReactDOM from 'react-dom/client'; import App from './App.jsx'; import './App.css';
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
Adapt if the app needs special providers. Return ONLY valid JSON. No markdown.`;

const REACT_SYSTEM = `You are VibeEngineer's build engine. Generate a complete Vite + React project.
Return a JSON object with file paths as keys and file contents as values.
Required files: package.json, index.html, src/main.jsx, src/App.jsx, src/App.css, vite.config.js

CRITICAL RULES — follow exactly or the build will fail:
1. package.json dependencies: ONLY react@^18, react-dom@^18. NO other npm packages (no recharts, no chart.js, no lodash, no axios, no tailwind, no external UI libs). Zero extra deps.
2. For charts/graphs: use inline SVG or HTML5 Canvas with vanilla JS inside React components. Never import chart libraries.
3. For icons: use Unicode chars or inline SVG. Never import icon libraries.
4. For styling: use plain CSS in src/App.css. No Tailwind, no CSS-in-JS libs.
5. vite.config.js MUST be exactly:
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], base: './' })
6. index.html must use: <script type="module" src="./src/main.jsx"></script>
7. devDependencies: ONLY vite@^5 and @vitejs/plugin-react@^4.

Modern, beautiful, fully functional UI. Use dark backgrounds, vibrant accent colors.
Return ONLY valid JSON. No markdown, no code fences.`;

const FIX_SYSTEM = `You are a code debugger. Fix the build error and return corrected files.
Return the same JSON structure with ALL files (not just changed ones).
Return ONLY valid JSON. No markdown, no code fences.`;

const MODIFY_SYSTEM = `You are VibeEngineer's build engine. Modify the existing code based on the user's request.
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

  // ── Check if this is a modification of existing code ──────────────────────
  const isModification = existingFiles !== undefined && Object.keys(existingFiles).length > 0 && isModifyRequest(message);

  if (isModification && existingFiles) {
    onProgress({ type: 'step', label: 'Modifying existing app…', status: 'running' });

    const isHtml = 'index.html' in existingFiles && Object.keys(existingFiles).length === 1;
    const existingCode = isHtml ? existingFiles['index.html'] : JSON.stringify(existingFiles, null, 2);
    const system = isHtml ? MODIFY_SYSTEM : `${FIX_SYSTEM}\nModify the code based on the user request. Return ALL files as JSON.`;

    const modifyResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system,
      messages: [
        { role: 'user', content: `Existing code:\n${existingCode}\n\nUser request: ${message}` },
      ],
    });

    const raw = modifyResponse.content[0]?.type === 'text' ? modifyResponse.content[0].text.trim() : '';
    onProgress({ type: 'step', label: 'Modified ✓', status: 'done' });
    onProgress({ type: 'step', label: 'Deploying…', status: 'running' });

    let url: string | null = null;
    if (isHtml) {
      url = await deployToGCS(raw, appId);
      if (url) {
        onProgress({ type: 'app_url', url });
        onProgress({ type: 'app_code', files: { 'index.html': raw } });
      }
    } else {
      try {
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        const files = JSON.parse(cleaned) as Record<string, string>;
        // Inject vite base
        if (!files['vite.config.js'] && !files['vite.config.ts']) {
          files['vite.config.js'] = `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()], base: './' })\n`;
        }
        const result = await buildInSandbox(files, (msg) => onProgress({ type: 'step', label: msg, status: 'running' }));
        if (result.success && result.distFiles) {
          url = await deployDirToGCS(result.distFiles, appId);
          if (url) {
            onProgress({ type: 'app_url', url });
            onProgress({ type: 'app_code', files });
          }
        }
      } catch { /* fall through */ }
    }

    onProgress({ type: 'step', label: 'Deployed ✓', status: 'done' });
    if (url) {
      onProgress({ type: 'token', text: `✅ **Updated:** [Open app](${url})` });
    } else {
      onProgress({ type: 'token', text: `✅ App updated. GCS deploy failed — check env vars.` });
    }
    return;
  }

  // ── React app via CDN (no build step, always works) ──────────────────────
  if (isReactApp(message)) {
    await buildReactCdnApp(message, appId, anthropic, onProgress);
    return;
  }

  // ── Complex app needing E2B sandbox (backend, database etc) ──────────────
  if (isComplexApp(message) && process.env.E2B_API_KEY) {
    await buildComplexApp(message, appId, anthropic, onProgress);
    return;
  }

  // ── Simple HTML (default) ─────────────────────────────────────────────────
  await buildHtmlApp(message, appId, anthropic, onProgress);
}

// ── Simple HTML build ─────────────────────────────────────────────────────────

async function buildHtmlApp(
  message: string,
  appId: string,
  anthropic: Anthropic,
  onProgress: ProgressFn,
): Promise<void> {
  // Generate and stream plan
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
    max_tokens: 4096,
    system: HTML_SYSTEM,
    messages: [{ role: 'user', content: message }],
  });

  const html = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
  if (!html.includes('<html')) {
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

// ── React CDN build (self-contained, no build step) ──────────────────────────

async function buildReactCdnApp(
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

  onProgress({ type: 'step', label: 'Generating React app…', status: 'running' });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    system: REACT_CDN_SYSTEM,
    messages: [{ role: 'user', content: message }],
  });

  const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
  // Strip any accidental code fences
  const html = raw.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  if (!html.startsWith('<!DOCTYPE') && !html.startsWith('<html')) {
    onProgress({ type: 'step', label: 'Generation failed', status: 'error' });
    onProgress({ type: 'token', text: 'Failed to generate the React app. Please try again.' });
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

// ── Complex app build with E2B ────────────────────────────────────────────────

async function buildComplexApp(
  message: string,
  appId: string,
  anthropic: Anthropic,
  onProgress: ProgressFn,
): Promise<void> {
  // Generate and stream plan (parallel with nothing — fast Haiku call)
  const plan = await generatePlan(message, anthropic);
  onProgress({
    type: 'plan',
    stepType: 'plan',
    label: plan.title,
    planItems: plan.strategy ? [`Strategy: ${plan.strategy}`, ...plan.steps] : plan.steps,
    status: 'running',
  });

  onProgress({ type: 'step', label: 'Spawning 3 specialist agents…', status: 'running' });

  let projectFiles: Record<string, string> | null = null;

  // ── Parallel subagents — run all 3 simultaneously ─────────────────────────
  const [compResp, structResp, entryResp] = await Promise.all([
    anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 6000, system: COMPONENT_AGENT, messages: [{ role: 'user', content: message }] }),
    anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 2000, system: STRUCTURE_AGENT, messages: [{ role: 'user', content: message }] }),
    anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, system: ENTRYPOINT_AGENT, messages: [{ role: 'user', content: message }] }),
  ]);

  onProgress({ type: 'step', label: 'Agents done ✓ — merging files…', status: 'done' });

  // Parse and merge all agent outputs
  const parseJson = (resp: { content: { type: string; text?: string }[] }): Record<string, string> => {
    const raw = resp.content[0]?.type === 'text' ? (resp.content[0].text ?? '').trim() : '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    try { return JSON.parse(cleaned) as Record<string, string>; } catch { return {}; }
  };

  const merged = { ...parseJson(structResp), ...parseJson(entryResp), ...parseJson(compResp) };

  if (Object.keys(merged).length < 3) {
    // Parallel agents failed — fall back to single call
    onProgress({ type: 'step', label: 'Falling back to single-agent…', status: 'running' });
    const genResponse = await anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 8096, system: REACT_SYSTEM, messages: [{ role: 'user', content: message }] });
    const raw = genResponse.content[0]?.type === 'text' ? genResponse.content[0].text.trim() : '';
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      projectFiles = JSON.parse(cleaned) as Record<string, string>;
    } catch {
      onProgress({ type: 'step', label: 'Falling back to HTML…', status: 'running' });
      await buildHtmlApp(message, appId, anthropic, onProgress);
      return;
    }
  } else {
    projectFiles = merged;
  }

  // Always inject vite.config.js with base: './' so GCS-hosted apps load assets correctly
  if (!projectFiles['vite.config.js'] && !projectFiles['vite.config.ts']) {
    projectFiles['vite.config.js'] = `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()], base: './' })\n`;
  } else {
    // Patch existing vite config to ensure base: './' is present
    const cfg = projectFiles['vite.config.js'] ?? projectFiles['vite.config.ts'] ?? '';
    if (!cfg.includes("base:") && !cfg.includes("base :")) {
      const key = projectFiles['vite.config.js'] ? 'vite.config.js' : 'vite.config.ts';
      projectFiles[key] = cfg.replace('defineConfig({', "defineConfig({ base: './',");
    }
  }

  onProgress({ type: 'step', label: 'Project generated ✓', status: 'done' });

  // Auto-fix loop — up to 3 attempts
  let attempt = 0;
  const MAX_ATTEMPTS = 3;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    onProgress({ type: 'step', label: `Building in sandbox (attempt ${attempt})…`, status: 'running' });

    const result = await buildInSandbox(projectFiles!, (msg) => {
      onProgress({ type: 'step', label: msg, status: 'running' });
    });

    if (result.success) {
      onProgress({ type: 'step', label: 'Build succeeded ✓', status: 'done' });

      // Deploy dist files
      onProgress({ type: 'step', label: 'Deploying…', status: 'running' });
      let url: string | null = null;

      if (result.distFiles && Object.keys(result.distFiles).length > 0) {
        url = await deployDirToGCS(result.distFiles, appId);
      }

      // Fallback: generate and deploy as HTML if dist is empty
      if (!url) {
        const fallbackHtml = generateFallbackHtml(projectFiles!);
        url = await deployToGCS(fallbackHtml, appId);
      }

      onProgress({ type: 'step', label: 'Deployed ✓', status: 'done' });

      if (url) {
        onProgress({ type: 'app_url', url });
        onProgress({ type: 'app_code', files: projectFiles! });
        onProgress({ type: 'token', text: `✅ **Live at:** [Open app](${url})` });
      } else {
        onProgress({ type: 'token', text: '✅ Build complete. Deploy failed — check GCS config.' });
      }
      return;
    }

    // Build failed — auto-fix
    if (attempt < MAX_ATTEMPTS) {
      onProgress({ type: 'step', label: `Auto-fixing errors (attempt ${attempt})…`, status: 'running' });

      const fixResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8096,
        system: FIX_SYSTEM,
        messages: [
          { role: 'user', content: `Original request: ${message}\n\nBuild error:\n${result.output}\n\nCurrent files:\n${JSON.stringify(projectFiles, null, 2)}` },
        ],
      });

      const fixRaw = fixResponse.content[0]?.type === 'text' ? fixResponse.content[0].text.trim() : '';
      try {
        const fixCleaned = fixRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        projectFiles = JSON.parse(fixCleaned) as Record<string, string>;
        onProgress({ type: 'step', label: `Fixed ✓`, status: 'done' });
      } catch {
        // Can't parse fix — give up and fall back to HTML
        break;
      }
    }
  }

  // All attempts failed — fall back to HTML
  onProgress({ type: 'step', label: 'Falling back to HTML…', status: 'running' });
  await buildHtmlApp(message, appId, anthropic, onProgress);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractExistingCode(history: { role: string; content: string }[]): string | null {
  // Look for GCS URLs in assistant messages, fetch would be async — use inline code instead
  // Find last assistant message that contains a storage.googleapis.com URL
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'assistant') {
      const match = msg.content.match(/https:\/\/storage\.googleapis\.com\/vibeengineer-apps\/[^\s)]+/);
      if (match) {
        // Return the URL so caller can fetch it — but we can't do async here
        // Instead, store code in a data attribute in the response
        return msg.content.includes('__CODE__:')
          ? msg.content.split('__CODE__:')[1]?.trim() ?? null
          : null;
      }
    }
  }
  return null;
}

function isModifyRequest(message: string): boolean {
  const lower = message.toLowerCase();
  const modifyKeywords = ['change', 'update', 'fix', 'modify', 'make it', 'add', 'remove', 'replace', 'adjust', 'edit', 'improve'];
  return modifyKeywords.some(k => lower.startsWith(k) || lower.includes(`${k} the`) || lower.includes(`${k} it`));
}

function generateFallbackHtml(files: Record<string, string>): string {
  // Build failed — ask Claude to generate a self-contained HTML version instead
  // Return a visible error page (not blank) so user knows what happened
  const fileList = Object.keys(files).join(', ');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Build Error</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#0a0a0f;color:#e4e4e7;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
  .card{max-width:500px;width:100%;background:#18181b;border:1px solid #3f3f46;border-radius:16px;padding:2rem}
  h2{color:#f87171;font-size:1.1rem;margin-bottom:0.75rem}
  p{color:#a1a1aa;font-size:0.875rem;line-height:1.6;margin-bottom:1rem}
  .files{background:#09090b;border-radius:8px;padding:0.75rem;font-family:monospace;font-size:0.75rem;color:#6b7280;word-break:break-all}
  .hint{margin-top:1rem;padding:0.75rem;background:#1c1917;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;font-size:0.8rem;color:#d97706}
</style>
</head>
<body>
<div class="card">
  <h2>⚠️ Build failed in sandbox</h2>
  <p>The npm build encountered an error. This usually happens with complex dependencies.</p>
  <div class="files">Files generated: ${fileList}</div>
  <div class="hint">💡 Try rephrasing as "build me a [app] without external libraries" for reliable results.</div>
</div>
</body></html>`;
}
