/**
 * /api/vibe/deploy — deploy generated project files to Vercel or GitHub
 * POST { files: Record<string,string>, target: 'vercel'|'github', projectName: string }
 */

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  let body: { files?: Record<string, string>; target?: string; projectName?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { files = {}, target, projectName = 'vibeengineer-app' } = body;

  if (!files || Object.keys(files).length === 0) {
    return Response.json({ error: 'No files provided' }, { status: 400 });
  }

  if (target === 'vercel') {
    const token = process.env.VERCEL_TOKEN;
    if (!token) return Response.json({ error: 'VERCEL_TOKEN not configured. Add it in GCP secrets.' }, { status: 400 });

    try {
      const slug = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50);

      // Build Vercel file list
      const vercelFiles = Object.entries(files).map(([path, content]) => ({
        file: path,
        data: Buffer.from(content, 'utf-8').toString('base64'),
        encoding: 'base64' as const,
      }));

      const res = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
      const deployUrl = data.url ? `https://${data.url}` : null;

      // Poll for ready (max 90s)
      if (data.id && token) {
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
            return Response.json({ error: 'Vercel build failed' }, { status: 500 });
          }
        }
      }

      return Response.json({ url: deployUrl, status: 'deploying' });
    } catch (err: unknown) {
      return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }

  if (target === 'github') {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return Response.json({ error: 'GITHUB_TOKEN not configured.' }, { status: 400 });

    try {
      // Get authenticated user
      const userRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'VibeEngineer' },
      });
      const user = await userRes.json() as { login?: string };
      const owner = user.login;
      if (!owner) return Response.json({ error: 'Could not get GitHub user' }, { status: 500 });

      const repoName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50);

      // Create repo
      await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'VibeEngineer' },
        body: JSON.stringify({ name: repoName, private: false, auto_init: false }),
      });

      // Push files
      for (const [path, content] of Object.entries(files)) {
        await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${path}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'VibeEngineer' },
          body: JSON.stringify({
            message: `Add ${path}`,
            content: Buffer.from(content, 'utf-8').toString('base64'),
          }),
        });
      }

      return Response.json({
        url: `https://github.com/${owner}/${repoName}`,
        cloneUrl: `https://github.com/${owner}/${repoName}.git`,
      });
    } catch (err: unknown) {
      return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }

  return Response.json({ error: 'Unknown deploy target' }, { status: 400 });
}
