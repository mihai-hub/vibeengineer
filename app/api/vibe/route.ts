/**
 * /api/vibe — VibeEngineer unified pipeline entry point
 *
 * POST { message: string, conversationHistory?: {role, content}[] }
 *
 * Classifies intent via a single Haiku call, then routes:
 *   FAST LANE  → Stream Claude Sonnet directly (explain/advise/review)
 *   BUILD LANE → Proxy to Jeff backend (create/build/deploy/fix)
 *
 * SSE event stream format:
 *   data: {"type":"lane","lane":"fast"|"build","intent":"..."}\n\n
 *   data: {"type":"step","step":{id,type,label,status,durationMs?}}\n\n  (build lane only)
 *   data: {"type":"token","text":"..."}\n\n
 *   data: {"type":"done"}\n\n
 *   data: {"type":"error","message":"..."}\n\n
 */

import Anthropic from '@anthropic-ai/sdk';
import { classifyIntent } from '@/lib/vibe-router';
import { guardInput, GuardianBlock } from '@/lib/prompt-guardian';
import type { AgentStep } from '@/components/StepCard';

const FAST_LANE_SYSTEM = `You are VibeEngineer — the AI that builds, ships, and runs software for founders and indie hackers who don't have engineering teams.

You are answering in FAST mode: give a direct, helpful, expert answer. Be concise and practical. Use markdown formatting. Think like a senior engineer + startup founder hybrid.

Keep answers focused. If the user needs actual code written or files changed, let them know they can use a "build" command to trigger the build lane.`;

export async function POST(req: Request): Promise<Response> {
  let body: {
    message?: string;
    conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { message, conversationHistory = [] } = body;

  if (!message?.trim()) {
    return new Response('message is required', { status: 400 });
  }

  // ── Security scan ──────────────────────────────────────────────────────────
  try {
    guardInput(message);
  } catch (err) {
    if (err instanceof GuardianBlock) return err.toResponse();
    throw err;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: Record<string, unknown>): void => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // ── Step 1: Classify intent (single Haiku call) ──────────────────────
        const decision = await classifyIntent(message);
        enqueue({ type: 'lane', lane: decision.lane, intent: decision.intent });

        if (decision.lane === 'fast') {
          // ── FAST LANE: Stream Claude Sonnet directly ─────────────────────
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

          const messages: { role: 'user' | 'assistant'; content: string }[] = [
            ...conversationHistory,
            { role: 'user', content: message },
          ];

          const sdkStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-5',
            max_tokens: 1024,
            system: FAST_LANE_SYSTEM,
            messages,
          });

          for await (const event of sdkStream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              enqueue({ type: 'token', text: event.delta.text });
            }
          }

          enqueue({ type: 'done' });
          controller.close();
          return;
        }

        // ── BUILD LANE: Proxy to Jeff backend ──────────────────────────────
        const jeffUrl = (process.env.JEFF_BACKEND_URL ?? 'https://api.jeff-asi.com').replace(/\/$/, '');
        const jeffKey = process.env.JEFF_API_KEY ?? '';

        enqueue({
          type: 'step',
          step: {
            id: 'build-start',
            type: 'agent_start',
            label: 'Jeff is on it…',
            status: 'running',
          } satisfies AgentStep,
        });

        let jeffRes: Response;
        try {
          jeffRes = await fetch(`${jeffUrl}/api/jeff/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(jeffKey ? { Authorization: `Bearer ${jeffKey}` } : {}),
            },
            body: JSON.stringify({
              message: `[VIBEENGINEER BUILD REQUEST]\n\n${message}`,
              stream: true,
            }),
          });
        } catch {
          jeffRes = new Response(null, { status: 503 });
        }

        if (!jeffRes.ok || !jeffRes.body) {
          // Jeff backend unavailable — fall back to Sonnet
          enqueue({
            type: 'step',
            step: {
              id: 'fallback',
              type: 'agent_start',
              label: 'Jeff backend unavailable — using fast lane',
              status: 'done',
            } satisfies AgentStep,
          });

          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const sdkStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-5',
            max_tokens: 2048,
            system: FAST_LANE_SYSTEM,
            messages: [{ role: 'user', content: message }],
          });

          for await (const event of sdkStream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              enqueue({ type: 'token', text: event.delta.text });
            }
          }

          enqueue({ type: 'done' });
          controller.close();
          return;
        }

        // ── Stream Jeff's SSE response back ───────────────────────────────
        const reader = jeffRes.body.getReader();
        const textDecoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += textDecoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === '[DONE]') continue;

            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(raw) as Record<string, unknown>;
            } catch {
              // Raw text token — forward as-is
              enqueue({ type: 'token', text: raw });
              continue;
            }

            const eventType = parsed.type as string | undefined;

            if (eventType === 'tool_call') {
              enqueue({
                type: 'step',
                step: {
                  id: String(parsed.id ?? `tool-${Date.now()}`),
                  type: 'tool_call',
                  label: `${String(parsed.tool ?? 'tool')}(${String(parsed.input ?? '').slice(0, 80)})`,
                  status: 'running',
                } satisfies AgentStep,
              });
            } else if (eventType === 'tool_result') {
              enqueue({
                type: 'step',
                step: {
                  id: `result-${String(parsed.tool_use_id ?? Date.now())}`,
                  type: 'tool_result',
                  label: `${String(parsed.tool ?? 'tool')}(...)`,
                  status: 'done',
                  durationMs: typeof parsed.duration_ms === 'number' ? parsed.duration_ms : undefined,
                } satisfies AgentStep,
              });
            } else if (eventType === 'thinking') {
              enqueue({
                type: 'step',
                step: {
                  id: `think-${Date.now()}`,
                  type: 'thinking',
                  label: 'Thinking…',
                  detail: typeof parsed.content === 'string' ? parsed.content : undefined,
                  status: 'done',
                  durationMs: typeof parsed.duration_ms === 'number' ? parsed.duration_ms : undefined,
                } satisfies AgentStep,
              });
            } else if (eventType === 'token' || eventType === 'text') {
              const text = typeof parsed.text === 'string' ? parsed.text : String(parsed.token ?? '');
              enqueue({ type: 'token', text });
            } else if (eventType === 'done') {
              // pass through — we'll emit our own done below
            } else if (typeof parsed.content === 'string') {
              // Unknown event with text content
              enqueue({ type: 'token', text: parsed.content });
            }
          }
        }

        enqueue({
          type: 'step',
          step: {
            id: 'build-done',
            type: 'agent_done',
            label: 'Build complete',
            status: 'done',
          } satisfies AgentStep,
        });
        enqueue({ type: 'done' });
        controller.close();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`),
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
        );
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
