/**
 * VibeEngineer Real Builder — multi-file Next.js project generator
 *
 * Calls Claude to generate a complete Next.js 14 + TypeScript + Tailwind project
 * as multiple files. Returns files as Record<string, string> (path → content).
 * Does NOT deploy to GCS — real builds return files for download or Vercel deploy.
 */

import Anthropic from '@anthropic-ai/sdk';

// ── Progress types ────────────────────────────────────────────────────────────

export interface RealBuildProgress {
  type: 'step' | 'token' | 'file' | 'files_ready' | 'plan';
  label?: string;
  status?: 'running' | 'done' | 'error';
  text?: string;
  filePath?: string;
  fileContent?: string;
  files?: Record<string, string>;
  planItems?: string[];
  stepType?: 'thinking' | 'plan' | 'tool_call' | 'tool_result' | 'agent_start' | 'agent_done';
}

export type RealProgressFn = (p: RealBuildProgress) => void;

// ── System prompts ────────────────────────────────────────────────────────────

const REAL_BUILD_SYSTEM = `You are VibeEngineer's Real Build Engine. Generate a complete, production-ready Next.js 14 project.

OUTPUT FORMAT — return a JSON object with this exact shape:
{
  "files": [
    { "path": "package.json", "content": "..." },
    { "path": "app/page.tsx", "content": "..." },
    { "path": "app/layout.tsx", "content": "..." },
    { "path": "app/globals.css", "content": "..." },
    { "path": "tailwind.config.ts", "content": "..." },
    { "path": "next.config.ts", "content": "..." },
    { "path": "tsconfig.json", "content": "..." },
    ...more files as needed
  ]
}

RULES:
- Use Next.js 14 App Router (not pages router)
- TypeScript everywhere
- Tailwind CSS for styling (dark theme by default: bg-zinc-950)
- localStorage for data persistence (no DB needed unless user asked for auth/payments)
- If user asks for auth: use next-auth v5 (write the config files but leave NEXTAUTH_SECRET as env var placeholder)
- If user asks for DB/Supabase: write the schema + client files with placeholder env vars
- If user asks for payments/Stripe: write the stripe integration with placeholder env vars
- package.json must include all dependencies needed
- Always include: next, react, react-dom, typescript, tailwindcss, @types/node, @types/react
- Return ONLY valid JSON. No markdown, no code fences, no explanation outside the JSON.`;

const REAL_MODIFY_SYSTEM = `You are VibeEngineer's Real Build Engine. Modify the existing Next.js project files based on the user's request.

OUTPUT FORMAT — return a JSON object with this exact shape:
{
  "files": [
    { "path": "app/page.tsx", "content": "..." },
    ...only files that need to change
  ]
}

RULES:
- Return ONLY the files that need to be created or modified
- Keep changes minimal and focused on the user's request
- Return ONLY valid JSON. No markdown, no code fences, no explanation outside the JSON.`;

// ── Parsed file structure from Claude response ────────────────────────────────

interface ClaudeFile {
  path: string;
  content: string;
}

interface ClaudeFilesResponse {
  files: ClaudeFile[];
}

// ── Main build function ───────────────────────────────────────────────────────

export async function buildReal(
  message: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  onProgress: RealProgressFn,
  existingFiles?: Record<string, string>,
  model?: string,
): Promise<void> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const selectedModel = model ?? 'claude-sonnet-4-6';
  const isModify = existingFiles && Object.keys(existingFiles).length > 0;
  const systemPrompt = isModify ? REAL_MODIFY_SYSTEM : REAL_BUILD_SYSTEM;

  // ── Step: Planning ──────────────────────────────────────────────────────────
  onProgress({
    type: 'step',
    stepType: 'thinking',
    label: 'Planning Next.js project structure…',
    status: 'running',
  });

  // ── Build user message ──────────────────────────────────────────────────────
  let userContent = message;
  if (isModify && existingFiles) {
    const filesSummary = Object.entries(existingFiles)
      .map(([path, content]) => `--- ${path} ---\n${content}`)
      .join('\n\n');
    userContent = `Existing project files:\n\n${filesSummary}\n\nUser request: ${message}`;
  }

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...conversationHistory,
    { role: 'user', content: userContent },
  ];

  // ── Call Claude ─────────────────────────────────────────────────────────────
  onProgress({
    type: 'step',
    stepType: 'tool_call',
    label: `Generating with ${selectedModel.includes('opus') ? 'Claude Opus (Power)' : 'Claude Sonnet'}…`,
    status: 'running',
  });

  let rawResponse = '';
  try {
    const response = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: 16000,
      system: systemPrompt,
      messages,
    });
    rawResponse = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
  } catch (err) {
    onProgress({
      type: 'step',
      label: 'Generation failed',
      status: 'error',
    });
    onProgress({
      type: 'token',
      text: `Failed to generate project: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  // ── Parse JSON response ─────────────────────────────────────────────────────
  onProgress({
    type: 'step',
    stepType: 'tool_result',
    label: 'Parsing generated files…',
    status: 'running',
  });

  let parsedFiles: ClaudeFile[] = [];
  try {
    // Strip markdown fences if Claude wrapped in them
    const cleaned = rawResponse
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    const parsed = JSON.parse(cleaned) as ClaudeFilesResponse;
    if (!Array.isArray(parsed.files)) {
      throw new Error('Response missing "files" array');
    }
    parsedFiles = parsed.files.filter(
      f => typeof f.path === 'string' && typeof f.content === 'string',
    );
  } catch (err) {
    onProgress({
      type: 'step',
      label: 'Parse failed — retrying…',
      status: 'error',
    });
    onProgress({
      type: 'token',
      text: `Could not parse generated files: ${err instanceof Error ? err.message : String(err)}. Please try again.`,
    });
    return;
  }

  if (parsedFiles.length === 0) {
    onProgress({ type: 'step', label: 'No files generated', status: 'error' });
    onProgress({ type: 'token', text: 'No files were generated. Please try again with more detail.' });
    return;
  }

  onProgress({
    type: 'step',
    stepType: 'tool_result',
    label: `Parsed ${parsedFiles.length} files ✓`,
    status: 'done',
  });

  // ── Emit plan showing file list ─────────────────────────────────────────────
  onProgress({
    type: 'plan',
    stepType: 'plan',
    label: 'Next.js Project',
    planItems: parsedFiles.map(f => f.path),
    status: 'done',
  });

  // ── Emit each file individually ─────────────────────────────────────────────
  const filesRecord: Record<string, string> = {};

  for (const f of parsedFiles) {
    filesRecord[f.path] = f.content;
    onProgress({
      type: 'file',
      filePath: f.path,
      fileContent: f.content,
    });
    // Small yield to allow SSE flushing
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // ── Emit all files ready ────────────────────────────────────────────────────
  onProgress({
    type: 'files_ready',
    files: filesRecord,
  });

  // ── Summary token ───────────────────────────────────────────────────────────
  onProgress({
    type: 'token',
    text: `✅ Generated ${parsedFiles.length} files — download ZIP or deploy to Vercel`,
  });
}
