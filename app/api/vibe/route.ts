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
import { build as vibeBuild, type BuildOptions } from '@/lib/vibe-builder';

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

const SUGGESTIONS_SYSTEM = `You are VibeEngineer. The user just had an app built. Suggest 3 short follow-up actions they might want next.
Rules: each suggestion must be under 8 words, actionable, specific to the app. No bullet points, no numbering.
Return ONLY valid JSON array of 3 strings: ["suggestion 1", "suggestion 2", "suggestion 3"]`;

const CLARIFY_SYSTEM = `You are VibeEngineer. The user wants to build something but their request is vague or ambiguous.
Ask ONE short, specific clarifying question (under 20 words) to understand what they need before building.
Return ONLY the question, no preamble, no punctuation at the end.`;

const PLAN_SYSTEM_ROUTE = `You are VibeEngineer's planning engine. Given a build request, create a concise execution plan.
Return JSON: { "title": "short app name (2-4 words)", "strategy": "one sentence tech approach", "steps": ["step 1", "step 2", "step 3", "step 4"] }
Steps = 4 concrete build actions. Return ONLY valid JSON. No markdown, no code fences.`;

const VAGUE_PATTERNS = [
  /^build (me )?an? app$/i,
  /^build (me )?something$/i,
  /^make (me )?an? (app|website|tool|thing)$/i,
  /^create (me )?an? app$/i,
  /^i want an? app$/i,
  /^build (it|this)$/i,
];

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
  // NOTE: no real search key configured — skip hallucinated sources, return empty
  if (!serperKey && !braveKey) return [];

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `You are a citation generator. Today is ${new Date().getFullYear()}. Given a question, return 2-3 plausible reference sources as a JSON array with shape [{title, url, snippet}]. Use real, well-known websites relevant to the topic. Do NOT include year numbers in titles. Return ONLY a valid JSON array — no markdown, no prose, no code fences.`,
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

const APPROVED_PREFIX = '__APPROVED__:';

export async function POST(req: Request): Promise<Response> {
  let body: {
    message?: string;
    conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
    existingFiles?: Record<string, string>;
    skipPlanGate?: boolean;
    buildTier?: 'pro' | 'power';
    designMode?: boolean;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { message: rawMessage, conversationHistory = [], existingFiles, skipPlanGate, buildTier, designMode } = body;
  const buildOptions: BuildOptions = { buildTier, designMode };

  // Strip approval prefix if present
  const isPreApproved = rawMessage?.startsWith(APPROVED_PREFIX) || skipPlanGate;
  const message = rawMessage?.startsWith(APPROVED_PREFIX)
    ? rawMessage.slice(APPROVED_PREFIX.length).trim()
    : rawMessage;

  if (!message?.trim()) {
    return new Response('message is required', { status: 400 });
  }
  const safeMessage = message.trim();

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
        // ── Step 1: Classify intent ───────────────────────────────────────────
        const decision = await classifyIntent(safeMessage);
        enqueue({ type: 'lane', lane: decision.lane, intent: decision.intent });

        if (decision.lane === 'fast') {
          // ── FAST LANE ──────────────────────────────────────────────────────
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          let sources: Source[] = [];
          try { sources = await fetchWebSources(safeMessage, anthropic); } catch { sources = []; }
          enqueue({ type: 'sources', sources });

          let groundedSystem = FAST_LANE_SYSTEM;
          if (sources.length > 0) {
            const webContext = sources.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}`).join('\n\n');
            groundedSystem += `\n\n## Live Web Sources (today: ${new Date().toISOString().slice(0, 10)})\n\n${webContext}\n\nIMPORTANT: Base your answer on these sources. Cite them inline using [1], [2], [3] notation where relevant.`;
          }

          const chatMessages: { role: 'user' | 'assistant'; content: string }[] = [
            ...conversationHistory,
            { role: 'user', content: safeMessage },
          ];
          const sdkStream = anthropic.messages.stream({ model: 'claude-sonnet-4-6', max_tokens: 1024, system: groundedSystem, messages: chatMessages });
          for await (const event of sdkStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              enqueue({ type: 'token', text: event.delta.text });
            }
          }
          enqueue({ type: 'done' });
          controller.close();
          return;
        }

        // ── BUILD LANE ────────────────────────────────────────────────────────
        const haikuClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        // Gate 1: Vague request → clarify
        const isVague = VAGUE_PATTERNS.some(p => p.test(safeMessage));
        if (isVague && !isPreApproved) {
          const clarifyResp = await haikuClient.messages.create({
            model: 'claude-haiku-4-5-20251001', max_tokens: 80, system: CLARIFY_SYSTEM,
            messages: [{ role: 'user', content: safeMessage }],
          });
          const question = clarifyResp.content[0]?.type === 'text' ? clarifyResp.content[0].text.trim() : null;
          if (question) { enqueue({ type: 'clarify', question }); enqueue({ type: 'done' }); controller.close(); return; }
        }

        // Gate 2: Plan approval — generate plan, show it, wait for user to approve
        // Skip if: user pre-approved, this is a modify request, or existingFiles present
        const hasExisting = existingFiles && Object.keys(existingFiles).length > 0;
        if (!isPreApproved && !hasExisting) {
          const planResp = await haikuClient.messages.create({
            model: 'claude-haiku-4-5-20251001', max_tokens: 400, system: PLAN_SYSTEM_ROUTE,
            messages: [{ role: 'user', content: safeMessage }],
          });
          const planRaw = planResp.content[0]?.type === 'text' ? planResp.content[0].text.trim() : '{}';
          try {
            const planCleaned = planRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
            const plan = JSON.parse(planCleaned) as { title?: string; strategy?: string; steps?: string[] };
            enqueue({
              type: 'plan_review',
              plan: {
                title: plan.title ?? 'App',
                strategy: plan.strategy ?? '',
                steps: plan.steps ?? [],
                originalMessage: safeMessage,
              },
            });
            enqueue({ type: 'done' });
            controller.close();
            return;
          } catch { /* plan parse failed — skip gate, build directly */ }
        }

        // Build
        enqueue({ type: 'step', step: { id: 'build-start', type: 'agent_start', label: 'Building…', status: 'running' } satisfies AgentStep });

        let stepCounter = 0;
        await vibeBuild(safeMessage, conversationHistory, (progress) => {
          if (progress.type === 'app_url') {
            enqueue({ type: 'app_url', url: progress.url });
          } else if (progress.type === 'app_code') {
            enqueue({ type: 'app_code', files: progress.files });
          } else if (progress.type === 'plan') {
            enqueue({
              type: 'step',
              step: {
                id: `plan-${stepCounter++}`,
                type: 'plan',
                label: progress.label ?? 'Plan',
                status: progress.status ?? 'running',
                planItems: progress.planItems,
              } satisfies AgentStep,
            });
          } else if (progress.type === 'step') {
            enqueue({
              type: 'step',
              step: {
                id: `step-${stepCounter++}`,
                type: progress.stepType ?? (progress.status === 'error' ? 'tool_result' : progress.label?.includes('✓') ? 'tool_result' : 'tool_call'),
                label: progress.label ?? '',
                status: progress.status ?? 'running',
              } satisfies AgentStep,
            });
          } else if (progress.type === 'token') {
            enqueue({ type: 'token', text: progress.text ?? '' });
          }
        }, existingFiles, buildOptions);

        enqueue({
          type: 'step',
          step: { id: 'build-done', type: 'agent_done', label: 'Build complete', status: 'done' } satisfies AgentStep,
        });

        // Generate follow-up suggestions (non-blocking — fire and forget into SSE)
        try {
          const anthropic3 = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const suggResp = await anthropic3.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 120,
            system: SUGGESTIONS_SYSTEM,
            messages: [{ role: 'user', content: `App just built for: "${safeMessage}"` }],
          });
          const suggRaw = suggResp.content[0]?.type === 'text' ? suggResp.content[0].text.trim() : '[]';
          const suggCleaned = suggRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
          const items = JSON.parse(suggCleaned) as string[];
          if (Array.isArray(items) && items.length > 0) {
            enqueue({ type: 'suggestions', items: items.slice(0, 3) });
          }
        } catch { /* ignore */ }

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
