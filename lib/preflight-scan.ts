/**
 * lib/preflight-scan.ts — VibeEngineer Pre-Flight Scanner
 *
 * Before any AI coding/generation task, scan what already exists so the AI
 * never rebuilds pages, components, or API routes that are already there.
 *
 * Returns a context block injected into the AI system prompt.
 */

import { readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';

export interface PreflightResult {
  stack: string;
  existingPages: string[];
  existingApiRoutes: string[];
  existingComponents: string[];
  existingLibFiles: string[];
  matchingFeatures: string[];
  contextBlock: string;
}

const PROJECT_ROOT = process.cwd();

/** Extract meaningful keywords from a goal string */
function extractKeywords(goal: string): string[] {
  const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'be', 'as', 'it', 'that',
    'this', 'i', 'we', 'you', 'add', 'build', 'create', 'make', 'fix',
    'update', 'set', 'get', 'run', 'use', 'need', 'want', 'now', 'new',
    'me', 'my', 'please', 'can', 'could', 'would', 'should',
  ]);
  return goal
    .toLowerCase()
    .match(/\b[a-z][a-z0-9]{2,}\b/g)
    ?.filter(w => !STOP_WORDS.has(w))
    .slice(0, 6) ?? [];
}

/** Recursively list files under a directory, returns relative paths */
async function listFilesRecursive(dir: string, ext = ['.ts', '.tsx', '.js', '.jsx']): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await listFilesRecursive(full, ext));
      } else if (ext.some(e => entry.name.endsWith(e))) {
        results.push(relative(PROJECT_ROOT, full));
      }
    }
  } catch { /* directory doesn't exist */ }
  return results;
}

/** Check if any of the given files contain any of the keywords */
async function findMatchingFiles(files: string[], keywords: string[]): Promise<string[]> {
  if (!keywords.length) return [];
  const matches: string[] = [];
  for (const filePath of files.slice(0, 40)) { // limit to avoid slow scans
    try {
      const content = await readFile(join(PROJECT_ROOT, filePath), 'utf-8');
      const lower = content.toLowerCase();
      if (keywords.some(kw => lower.includes(kw))) {
        matches.push(filePath);
      }
    } catch { /* file unreadable */ }
  }
  return matches;
}

/** Read package.json and detect stack */
async function detectStack(): Promise<string> {
  try {
    const pkg = JSON.parse(await readFile(join(PROJECT_ROOT, 'package.json'), 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const parts: string[] = [];
    if (deps['next']) parts.push(`Next.js ${(deps['next'] as string).replace('^', '')}`);
    if (deps['react']) parts.push('React');
    if (deps['@supabase/supabase-js']) parts.push('Supabase');
    if (deps['@anthropic-ai/sdk']) parts.push('Anthropic SDK');
    if (deps['stripe']) parts.push('Stripe');
    if (deps['tailwindcss']) parts.push('Tailwind');
    return parts.join(' + ') || 'Next.js / TypeScript';
  } catch {
    return 'Next.js / TypeScript';
  }
}

/**
 * Run pre-flight scan and return results + system prompt context block.
 * Call before any AI generation/coding task.
 */
export async function preflightScan(goal: string): Promise<PreflightResult> {
  const keywords = extractKeywords(goal);

  const [stack, appFiles, componentFiles, libFiles] = await Promise.all([
    detectStack(),
    listFilesRecursive(join(PROJECT_ROOT, 'app')),
    listFilesRecursive(join(PROJECT_ROOT, 'components')),
    listFilesRecursive(join(PROJECT_ROOT, 'lib')),
  ]);

  const existingPages = appFiles
    .filter(f => f.includes('/page.') || f.endsWith('/layout.tsx'))
    .map(f => f.replace('app/', '/').replace('/page.tsx', '').replace('/page.ts', '') || '/')
    .filter(Boolean);

  const existingApiRoutes = appFiles
    .filter(f => f.includes('/api/') && f.endsWith('/route.ts'))
    .map(f => f.replace('app', '').replace('/route.ts', ''));

  const existingComponents = componentFiles.map(f => f.replace('components/', ''));
  const existingLibFiles = libFiles.map(f => f.replace('lib/', ''));

  const allFiles = [...appFiles, ...componentFiles, ...libFiles];
  const matchingFeatures = await findMatchingFiles(allFiles, keywords);

  // Build context block for AI system prompt
  const lines = [
    '## PRE-FLIGHT SCAN — Read before writing any code',
    `Stack: ${stack}`,
    '',
    `Existing pages (${existingPages.length}): ${existingPages.slice(0, 12).join(', ')}`,
    `Existing API routes (${existingApiRoutes.length}): ${existingApiRoutes.slice(0, 12).join(', ')}`,
    `Existing components (${existingComponents.length}): ${existingComponents.slice(0, 10).join(', ')}`,
    `Existing lib files: ${existingLibFiles.join(', ')}`,
  ];

  if (matchingFeatures.length > 0) {
    lines.push('');
    lines.push(`⚠️  Features matching your goal already exist in these files:`);
    matchingFeatures.slice(0, 8).forEach(f => lines.push(`  - ${f}`));
    lines.push('RULE: ENHANCE the existing code above. Do NOT rebuild or duplicate it.');
  } else {
    lines.push('');
    lines.push('No existing features match your goal — safe to create new ones.');
  }

  lines.push('');
  lines.push('IMPORTANT: Never create a page, route, or component that already appears in the lists above.');

  return {
    stack,
    existingPages,
    existingApiRoutes,
    existingComponents,
    existingLibFiles,
    matchingFeatures,
    contextBlock: lines.join('\n'),
  };
}
