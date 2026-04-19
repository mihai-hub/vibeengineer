/**
 * Vercel deploy — pushes a set of files to Vercel via the Vercel API v13
 * Requires VERCEL_TOKEN env var.
 * Returns the live deployment URL or null.
 */

export interface VercelFile {
  file: string;
  data: string;
  encoding?: 'utf-8' | 'base64';
}

interface VercelDeploymentResponse {
  id?: string;
  url?: string;
  readyState?: string;
  error?: { message?: string };
}

const VERCEL_API = 'https://api.vercel.com';
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 24; // 24 × 5s = 120s max

// ── Deploy to Vercel ──────────────────────────────────────────────────────────

export async function deployToVercel(
  files: Record<string, string>,
  projectName: string,
): Promise<string | null> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.warn('[Vercel] VERCEL_TOKEN not set — skipping deploy');
    return null;
  }

  // Sanitise project name: lowercase, alphanumeric + hyphens, max 52 chars
  const safeName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52) || 'vibeengineer-app';

  // Convert files Record to VercelFile array
  const vercelFiles: VercelFile[] = Object.entries(files).map(([path, content]) => ({
    file: path,
    data: content,
    encoding: 'utf-8',
  }));

  // POST to Vercel deployments API v13
  let deploymentId: string;
  let deploymentUrl: string;

  try {
    const res = await fetch(`${VERCEL_API}/v13/deployments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: safeName,
        files: vercelFiles,
        target: 'production',
        projectSettings: {
          framework: 'nextjs',
        },
      }),
    });

    const data = (await res.json()) as VercelDeploymentResponse;

    if (!res.ok) {
      console.error('[Vercel] Deploy request failed:', data.error?.message ?? res.status);
      return null;
    }

    if (!data.id || !data.url) {
      console.error('[Vercel] Deploy response missing id or url:', data);
      return null;
    }

    deploymentId = data.id;
    deploymentUrl = data.url.startsWith('https://') ? data.url : `https://${data.url}`;
  } catch (err) {
    console.error('[Vercel] Deploy request threw:', err instanceof Error ? err.message : err);
    return null;
  }

  // Poll until ready
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

    try {
      const pollRes = await fetch(`${VERCEL_API}/v13/deployments/${deploymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!pollRes.ok) continue;

      const pollData = (await pollRes.json()) as VercelDeploymentResponse;
      const state = pollData.readyState ?? '';

      if (state === 'READY') {
        return deploymentUrl;
      }

      if (state === 'ERROR' || state === 'CANCELED') {
        console.error(`[Vercel] Deployment ${deploymentId} ended with state: ${state}`);
        return null;
      }
    } catch {
      // transient network error — keep polling
    }
  }

  // Timed out — return the URL anyway (it may still become ready)
  console.warn(`[Vercel] Deployment ${deploymentId} still building after 120s — returning URL`);
  return deploymentUrl;
}
