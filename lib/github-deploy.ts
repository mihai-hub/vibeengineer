/**
 * GitHub deploy — pushes generated files to a new GitHub repo
 * Requires GITHUB_TOKEN env var (personal access token with repo scope).
 * Uses GitHub REST API v3 directly (no octokit).
 * Returns { repoUrl, cloneUrl } or null.
 */

const GITHUB_API = 'https://api.github.com';

export interface GitHubDeployResult {
  repoUrl: string;
  cloneUrl: string;
}

interface GitHubUserResponse {
  login?: string;
  message?: string;
}

interface GitHubRepoResponse {
  html_url?: string;
  clone_url?: string;
  message?: string;
  errors?: Array<{ message?: string }>;
}

// ── Push files to a new GitHub repo ──────────────────────────────────────────

export async function pushToGitHub(
  files: Record<string, string>,
  repoName: string,
  description: string,
): Promise<GitHubDeployResult | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('[GitHub] GITHUB_TOKEN not set — skipping deploy');
    return null;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  // Step 1: Get authenticated username
  let username: string;
  try {
    const userRes = await fetch(`${GITHUB_API}/user`, { headers });
    const userData = (await userRes.json()) as GitHubUserResponse;
    if (!userRes.ok || !userData.login) {
      console.error('[GitHub] Could not get user:', userData.message ?? userRes.status);
      return null;
    }
    username = userData.login;
  } catch (err) {
    console.error('[GitHub] /user request failed:', err instanceof Error ? err.message : err);
    return null;
  }

  // Step 2: Create the repo (sanitise name)
  const safeRepoName = repoName
    .toLowerCase()
    .replace(/[^a-z0-9-_.]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'vibeengineer-app';

  // Add timestamp suffix to avoid conflicts
  const uniqueRepoName = `${safeRepoName}-${Date.now()}`;

  let repoUrl: string;
  let cloneUrl: string;

  try {
    const createRes = await fetch(`${GITHUB_API}/user/repos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: uniqueRepoName,
        description: description.slice(0, 350),
        private: false,
        auto_init: false,
      }),
    });
    const createData = (await createRes.json()) as GitHubRepoResponse;
    if (!createRes.ok || !createData.html_url || !createData.clone_url) {
      const errMsg = createData.message ?? createData.errors?.[0]?.message ?? String(createRes.status);
      console.error('[GitHub] Create repo failed:', errMsg);
      return null;
    }
    repoUrl = createData.html_url;
    cloneUrl = createData.clone_url;
  } catch (err) {
    console.error('[GitHub] Create repo threw:', err instanceof Error ? err.message : err);
    return null;
  }

  // Step 3: Push each file via the contents API
  // GitHub requires base64-encoded content
  const fileEntries = Object.entries(files);
  let pushed = 0;

  for (const [filePath, content] of fileEntries) {
    try {
      // Encode content to base64
      const base64Content = Buffer.from(content, 'utf-8').toString('base64');

      const putRes = await fetch(
        `${GITHUB_API}/repos/${username}/${uniqueRepoName}/contents/${filePath}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: `feat: add ${filePath}`,
            content: base64Content,
            branch: 'main',
          }),
        },
      );

      if (!putRes.ok) {
        const errBody = (await putRes.json()) as { message?: string };
        console.warn(`[GitHub] Failed to push ${filePath}:`, errBody.message ?? putRes.status);
        // continue — don't abort entire push for one file
      } else {
        pushed++;
      }
    } catch (err) {
      console.warn(`[GitHub] Push threw for ${filePath}:`, err instanceof Error ? err.message : err);
    }
  }

  if (pushed === 0) {
    console.error('[GitHub] No files were pushed successfully');
    return null;
  }

  console.log(`[GitHub] Pushed ${pushed}/${fileEntries.length} files to ${repoUrl}`);
  return { repoUrl, cloneUrl };
}
