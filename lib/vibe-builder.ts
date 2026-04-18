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
  type: 'step' | 'token' | 'url' | 'plan';
  label?: string;
  status?: 'running' | 'done' | 'error';
  text?: string;
  url?: string;
  planItems?: string[];
  stepType?: 'thinking' | 'plan' | 'tool_call' | 'tool_result' | 'agent_start' | 'agent_done' | 'security';
}

export type ProgressFn = (p: BuildProgress) => void;

// ── Complexity detection ──────────────────────────────────────────────────────

const COMPLEX_KEYWORDS = [
  'react', 'vue', 'angular', 'next.js', 'nextjs', 'svelte',
  'node', 'express', 'fastapi', 'backend', 'api', 'database',
  'typescript app', 'full stack', 'fullstack', 'multi-page',
];

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

const HTML_SYSTEM = `You are VibeEngineer's build engine. Generate a COMPLETE, working, self-contained single HTML file.
- All CSS inline in <style> tags
- All JS inline in <script> tags
- No external dependencies that could fail
- Modern, beautiful dark UI with gradients
- Fully functional — not a mockup
Return ONLY the raw HTML starting with <!DOCTYPE html>. No markdown, no code fences, no explanation.`;

const REACT_SYSTEM = `You are VibeEngineer's build engine. Generate a complete Vite + React project.
Return a JSON object with file paths as keys and file contents as values.
Required files: package.json, index.html, src/main.jsx, src/App.jsx, src/App.css, vite.config.js
package.json must have: { "scripts": { "build": "vite build", "dev": "vite" }, "dependencies": { "react": "^18", "react-dom": "^18" }, "devDependencies": { "vite": "^5", "@vitejs/plugin-react": "^4" } }
vite.config.js MUST include base: './' so the app works when hosted on a CDN or static host:
\`\`\`
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], base: './' })
\`\`\`
index.html must use relative script path: <script type="module" src="./src/main.jsx"></script>
Modern, beautiful, fully functional UI.
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
): Promise<void> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const appId = `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // ── Check if this is a modification of existing code ──────────────────────
  const existingCode = extractExistingCode(conversationHistory);
  const isModification = existingCode !== null && isModifyRequest(message);

  if (isModification && existingCode) {
    onProgress({ type: 'step', label: 'Modifying existing app…', status: 'running' });

    const modifyResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: MODIFY_SYSTEM,
      messages: [
        { role: 'user', content: `Existing code:\n\`\`\`html\n${existingCode}\n\`\`\`\n\nUser request: ${message}` },
      ],
    });

    const html = modifyResponse.content[0]?.type === 'text' ? modifyResponse.content[0].text.trim() : '';
    if (!html.includes('<html')) {
      onProgress({ type: 'token', text: 'Failed to modify the app. Please try again.' });
      return;
    }
    onProgress({ type: 'step', label: 'Modified ✓', status: 'done' });

    onProgress({ type: 'step', label: 'Deploying…', status: 'running' });
    const url = await deployToGCS(html, appId);
    onProgress({ type: 'step', label: 'Deployed ✓', status: 'done' });

    if (url) {
      onProgress({ type: 'url', url });
      onProgress({ type: 'token', text: `✅ **Updated:** [Open app](${url})` });
    } else {
      onProgress({ type: 'token', text: `✅ App updated. GCS deploy failed — check env vars.` });
    }
    return;
  }

  // ── Complex app (React/Node) ───────────────────────────────────────────────
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
    onProgress({ type: 'url', url });
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

  onProgress({ type: 'step', label: 'Generating project…', status: 'running' });

  let projectFiles: Record<string, string> | null = null;

  // Generate project files
  const genResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8096,
    system: REACT_SYSTEM,
    messages: [{ role: 'user', content: message }],
  });

  const raw = genResponse.content[0]?.type === 'text' ? genResponse.content[0].text.trim() : '';
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    projectFiles = JSON.parse(cleaned) as Record<string, string>;
  } catch {
    // JSON parse failed — fall back to HTML
    onProgress({ type: 'step', label: 'Falling back to HTML…', status: 'running' });
    await buildHtmlApp(message, appId, anthropic, onProgress);
    return;
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
        onProgress({ type: 'url', url });
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
  // Extract App.jsx content and wrap in minimal HTML for preview
  const appContent = files['src/App.jsx'] ?? files['src/App.tsx'] ?? '';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>App</title>
<style>body{font-family:system-ui,sans-serif;background:#0a0a0f;color:#fff;padding:2rem;}</style>
</head>
<body>
<h2>App Preview</h2>
<p>React build completed. Files generated:</p>
<ul>${Object.keys(files).map(f => `<li>${f}</li>`).join('')}</ul>
${appContent ? `<pre style="background:#1a1a2e;padding:1rem;border-radius:8px;overflow:auto;font-size:12px;max-height:400px">${appContent.slice(0, 2000)}</pre>` : ''}
</body></html>`;
}
