/**
 * /api/vibe/deploy — deploy generated project files to Vercel or GitHub
 *
 * POST { files, target, projectName, token }
 *
 * IMPORTANT: We NEVER store user tokens. The token is passed per-request,
 * used once, and never logged or persisted. Users bring their own API keys.
 */

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  let body: {
    files?: Record<string, string>;
    target?: string;
    projectName?: string;
    token?: string;  // user's own API key — never stored server-side
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { files = {}, target, projectName = 'vibeengineer-app', token } = body;

  if (!files || Object.keys(files).length === 0) {
    return Response.json({ error: 'No files provided' }, { status: 400 });
  }

  if (!token) {
    return Response.json({ error: 'API token required. Paste your token in the deploy panel.' }, { status: 400 });
  }

  // ── Vercel deploy ──────────────────────────────────────────────────────────
  if (target === 'vercel') {
    try {
      const slug = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50);

      const vercelFiles = Object.entries(files).map(([path, content]) => ({
        file: path,
        data: Buffer.from(content, 'utf-8').toString('base64'),
        encoding: 'base64' as const,
      }));

      const res = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: slug,
          files: vercelFiles,
          projectSettings: { framework: 'nextjs', buildCommand: 'next build', outputDirectory: '.next' },
          target: 'production',
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return Response.json({ error: `Vercel API error: ${err.slice(0, 200)}` }, { status: 500 });
      }

      const data = await res.json() as { url?: string; id?: string };

      // Poll for ready (max 90s)
      if (data.id) {
        for (let i = 0; i < 18; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const pollRes = await fetch(`https://api.vercel.com/v13/deployments/${data.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const pollData = await pollRes.json() as { readyState?: string; url?: string };
          if (pollData.readyState === 'READY') {
            return Response.json({ url: `https://${pollData.url ?? data.url}` });
          }
          if (pollData.readyState === 'ERROR') {
            return Response.json({ error: 'Vercel build failed — check your project settings' }, { status: 500 });
          }
        }
      }

      return Response.json({ url: data.url ? `https://${data.url}` : null, status: 'deploying' });
    } catch (err: unknown) {
      return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }

  // ── GitHub push ────────────────────────────────────────────────────────────
  if (target === 'github') {
    try {
      const userRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'VibeEngineer' },
      });
      if (!userRes.ok) return Response.json({ error: 'Invalid GitHub token' }, { status: 401 });

      const user = await userRes.json() as { login?: string };
      const owner = user.login;
      if (!owner) return Response.json({ error: 'Could not get GitHub username' }, { status: 500 });

      const repoName = `${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40)}-${Date.now().toString(36)}`;

      await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'VibeEngineer' },
        body: JSON.stringify({ name: repoName, private: false, auto_init: false, description: `Built with VibeEngineer` }),
      });

      // Push files sequentially
      for (const [path, content] of Object.entries(files)) {
        try {
          await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${path}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'VibeEngineer' },
            body: JSON.stringify({
              message: `Add ${path}`,
              content: Buffer.from(content, 'utf-8').toString('base64'),
            }),
          });
        } catch { /* continue on single file failure */ }
      }

      return Response.json({
        url: `https://github.com/${owner}/${repoName}`,
        cloneUrl: `https://github.com/${owner}/${repoName}.git`,
      });
    } catch (err: unknown) {
      return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }

  return Response.json({ error: 'Unknown deploy target. Use: vercel or github' }, { status: 400 });
}
