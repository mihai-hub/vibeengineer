/**
 * /api/cto — SSE streaming AI CTO advisor
 *
 * POST { messages: [{role, content}], idea?: string }
 *
 * Streams SSE: `data: <token>\n\n` ... `data: [DONE]\n\n`
 */

import Anthropic from '@anthropic-ai/sdk';

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
Only output this JSON block when the user explicitly says they are ready to build or asks you to finalize the stack.`;

function buildSystemPrompt(idea?: string): string {
  if (!idea?.trim()) return BASE_SYSTEM;

  const contextSection = `\n\n---\n## App Idea Context\n\nThe user wants to build: ${idea.trim()}`;
  return BASE_SYSTEM + contextSection;
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

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const systemPrompt = buildSystemPrompt(idea);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const sdkStream = anthropic.messages.stream({
          model: 'claude-opus-4-5',
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        });

        for await (const event of sdkStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const token = event.delta.text;
            controller.enqueue(encoder.encode(`data: ${token}\n\n`));
          }
        }

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
