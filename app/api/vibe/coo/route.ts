/**
 * app/api/vibe/coo/route.ts — Real COO AI endpoint with business data analysis
 *
 * POST { message, businessContext?, metrics? }
 * businessContext = formatted product/revenue data injected into system prompt
 * Returns streaming SSE: data: <token>\n\n ... data: [DONE]\n\n
 */

import Anthropic from '@anthropic-ai/sdk';

const COO_SYSTEM = `You are a real COO AI assistant. You have access to business data.
When given business metrics or product data, provide:
1. One specific actionable insight with data to back it up
2. One concrete growth lever to pull this week
3. One risk to watch

Be specific, use the numbers provided. Think like a Series A COO who has seen 50+ B2B SaaS companies.
Format with headers and bullet points. Keep it under 300 words.`;

export async function POST(req: Request): Promise<Response> {
  let body: { message?: string; businessContext?: string; metrics?: string };

  try {
    body = (await req.json()) as {
      message?: string;
      businessContext?: string;
      metrics?: string;
    };
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { message, businessContext, metrics } = body;

  if (!message) {
    return new Response('message is required', { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Build system prompt with optional business context injection
  let systemPrompt = COO_SYSTEM;

  if (businessContext) {
    systemPrompt += `\n\n---\n## Business Data\n\n${businessContext}`;
  }

  if (metrics) {
    systemPrompt += `\n\n## Metrics\n\n${metrics}`;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const sdkStream = anthropic.messages.stream({
          model: 'claude-opus-4-5',
          max_tokens: 600,
          system: systemPrompt,
          messages: [{ role: 'user', content: message }],
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
