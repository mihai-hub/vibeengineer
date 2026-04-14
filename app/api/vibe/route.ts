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
 *   data: {"type":"sources","sources":[{title,url,snippet}]}\n\n   (fast lane, before tokens)
 *   data: {"type":"step","step":{id,type,label,status,durationMs?}}\n\n  (build lane only)
 *   data: {"type":"token","text":"..."}\n\n
 *   data: {"type":"done"}\n\n
 *   data: {"type":"error","message":"..."}\n\n
 */

import Anthropic from '@anthropic-ai/sdk';
import { classifyIntent } from '@/lib/vibe-router';
import { guardInput, GuardianBlock } from '@/lib/prompt-guardian';
import type { AgentStep } from '@/components/StepCard';

// ── Source type ────────────────────────────────────────────────────────────────
export interface Source {
  title: string;
  url: string;
  snippet: string;
}

// ── Serper API types ───────────────────────────────────────────────────────────
interface SerperOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
}

// ── Brave Search API types ─────────────────────────────────────────────────────
interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

// ── Claude citation fallback response ──────────────────────────────────────────
interface CitationItem {
  title?: unknown;
  url?: unknown;
  snippet?: unknown;
}

const FAST_LANE_SYSTEM = `You are VibeEngineer — the AI that builds, ships, and runs software for founders and indie hackers who don't have engineering teams.

You are answering in FAST mode: give a direct, helpful, expert answer. Be concise and practical. Use markdown formatting. Think like a senior engineer + startup founder hybrid.

Keep answers focused. If the user needs actual code written or files changed, let them know they can use a "build" command to trigger the build lane.`;

// ── Web search grounding ───────────────────────────────────────────────────────
async function fetchWebSources(query: string, anthropic: Anthropic): Promise<Source[]> {
  const serperKey = process.env.SERPER_API_KEY;
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;

  // 1. Try Serper
  if (serperKey) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: 3 }),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = (await res.json()) as SerperResponse;
        const results = (data.organic ?? []).slice(0, 3);
        return results.map(r => ({
          title: r.title ?? '',
          url: r.link ?? '',
          snippet: r.snippet ?? '',
        })).filter(s => s.title && s.url);
      }
    } catch {
      // fall through to next provider
    }
  }

  // 2. Try Brave Search
  if (braveKey) {
    try {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`,
        {
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': braveKey,
          },
          signal: AbortSignal.timeout(4000),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as BraveResponse;
        const results = (data.web?.results ?? []).slice(0, 3);
        return results.map(r => ({
          title: r.title ?? '',
          url: r.url ?? '',
          snippet: r.description ?? '',
        })).filter(s => s.title && s.url);
      }
    } catch {
      // fall through to model fallback
    }
  }

  // 3. Model-generated citation fallback (Claude Haiku)
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: 'You are a citation generator. Given a question, return 2-3 plausible reference sources as a JSON array with shape [{title, url, snippet}]. Use real, well-known websites relevant to the topic. Return ONLY a valid JSON array — no markdown, no prose, no code fences.',
      messages: [{ role: 'user', content: query }],
    });

    const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '[]';
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned) as CitationItem[];
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 3).map(item => ({
        title: typeof item.title === 'string' ? item.title : '',
        url: typeof item.url === 'string' ? item.url : '',
        snippet: typeof item.snippet === 'string' ? item.snippet : '',
      })).filter(s => s.title && s.url);
    }
  } catch {
    // ignore — return empty
  }

  return [];
}

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
          // ── FAST LANE: Web search grounding → Stream Claude Sonnet ─────────
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

          // Fetch sources (non-blocking — always emit even if empty)
          let sources: Source[] = [];
          try {
            sources = await fetchWebSources(message, anthropic);
          } catch {
            sources = [];
          }
          enqueue({ type: 'sources', sources });

          // Build grounded system prompt
          let groundedSystem = FAST_LANE_SYSTEM;
          if (sources.length > 0) {
            const webContext = sources
              .map(s => `- ${s.title}: ${s.snippet} (${s.url})`)
              .join('\n');
            groundedSystem += `\n\n## Web Context (use these sources to ground your answer)\n${webContext}`;
          }

          const chatMessages: { role: 'user' | 'assistant'; content: string }[] = [
            ...conversationHistory,
            { role: 'user', content: message },
          ];

          const sdkStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-5',
            max_tokens: 1024,
            system: groundedSystem,
            messages: chatMessages,
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
