export const runtime = 'nodejs';

/**
 * /api/cto — SSE streaming AI CTO advisor
 *
 * POST { messages: [{role, content}], idea?: string }
 *
 * Streams SSE: `data: <token>\n\n` ... `data: [DONE]\n\n`
 */

import Anthropic from '@anthropic-ai/sdk';
import { guardInput, GuardianBlock } from '@/lib/prompt-guardian';

const BASE_SYSTEM = `You are the CTO and technical co-founder of this startup. The user is describing an app they want to build. Help them make smart technical decisions: stack choice (Next.js/React/Vue), database (Supabase/PlanetScale/SQLite), auth strategy, API design, third-party integrations, scalability concerns, estimated complexity. Be concise and opinionated like a senior CTO. Reference the user's app idea specifically.

When the user is ready to build, output a structured JSON block at the end of your response in this exact format:
\`\`\`json
{
  "ready_to_build": true,
  "stack": {
    "frontend": "Next.js 14 + Tailwind CSS",
    "backend": "Next.js API Routes",
    "database": "Supabase",
    "auth": "Supabase Auth",
    "hosting": "Vercel"
  },
  "features": ["feature 1", "feature 2", "feature 3"],
  "complexity": "medium"
}
\`\`\`
Only output this JSON block when the user explicitly says they are ready to build or asks you to finalize the stack.

IMPORTANT RULES:
- DO NOT suggest rebuilding existing components/pages — check what already exists first
- NEVER suggest duplicate API routes — check app/api/ before recommending new endpoints
- After completing any task, provide a structured summary: what was recommended/changed and why
- If asked about a feature that already exists in the codebase, enhance it instead of rebuilding`;

function buildSystemPrompt(idea?: string): string {
  if (!idea?.trim()) return BASE_SYSTEM;

  const contextSection = `\n\n---\n## App Idea Context\n\nThe user wants to build: ${idea.trim()}`;
  return BASE_SYSTEM + contextSection;
}

// Keywords that signal the user wants to BUILD something (trigger Builder panel)
const BUILD_KEYWORDS = [
  'build', 'create', 'generate', 'make me', 'implement', 'add feature',
  'add page', 'add component', 'create a page', 'create an app',
  'i want to build', 'let\'s build', 'can you build', 'ready to build',
  'start building', 'begin building', 'write the code', 'code this',
];

function detectsBuildIntent(messages: { role: string; content: string }[]): boolean {
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  const lower = lastUserMsg.toLowerCase();
  return BUILD_KEYWORDS.some(kw => lower.includes(kw));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { messages, idea } = body as {
    messages?: { role: 'user' | 'assistant'; content: string }[];
    idea?: string;
  };

  if (!messages || messages.length === 0) {
    return new Response('messages are required', { status: 400 });
  }

  // ── Security: scan last user message ────────────────────────────────────
  const lastMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  try {
    guardInput(lastMsg);
  } catch (err) {
    if (err instanceof GuardianBlock) return err.toResponse();
    throw err;
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const systemPrompt = buildSystemPrompt(idea);
  const shouldOpenBuilder = detectsBuildIntent(messages);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Emit builder panel trigger if user wants to build something
      if (shouldOpenBuilder) {
        const panelEvent = JSON.stringify({
          type: 'vibe_task_open_panel',
          navigateTo: '/builder',
          goal: lastMsg.slice(0, 120),
        });
        controller.enqueue(encoder.encode(`data: ${panelEvent}\n\n`));
      }

      try {
        const sdkStream = anthropic.messages.stream({
          model: 'claude-opus-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        });

        let fullResponse = '';
        for await (const event of sdkStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const token = event.delta.text;
            fullResponse += token;
            controller.enqueue(encoder.encode(`data: ${token}\n\n`));
          }
        }

        // Emit task summary event after response
        const summaryEvent = JSON.stringify({
          type: 'vibe_task_done',
          summary: fullResponse.slice(0, 300),
          goal: lastMsg.slice(0, 80),
        });
        controller.enqueue(encoder.encode(`data: ${summaryEvent}\n\n`));

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`data: Error: ${message}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
