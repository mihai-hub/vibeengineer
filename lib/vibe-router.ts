/**
 * lib/vibe-router.ts — Intent classifier + lane router
 *
 * Classifies a user message into FAST or BUILD lane using a single Claude Haiku call.
 * Fast: questions, explanations, advice, reviews, short messages
 * Build: create, generate, deploy, fix, implement, ship, write code, make me
 */

import Anthropic from '@anthropic-ai/sdk';

export type Lane = 'fast' | 'build';

export interface RouteResult {
  lane: Lane;
  intent: string;
}

// Imperative build phrases — short-circuit immediately, no LLM call needed
const BUILD_IMPERATIVES = [
  /^build me\b/i, /^create me\b/i, /^make me\b/i, /^generate me\b/i,
  /^build a\b/i, /^create a\b/i, /^make a\b/i, /^generate a\b/i,
  /^build an\b/i, /^create an\b/i, /^make an\b/i, /^generate an\b/i,
  /^scaffold\b/i, /^deploy\b/i, /^set up\b/i, /^setup\b/i,
  /^write me\b/i, /^code me\b/i, /^implement\b/i,
];

const BUILD_KEYWORDS = [
  'build', 'create', 'generate', 'deploy', 'ship',
  'add feature', 'implement', 'write code', 'make me', 'scaffold',
  'set up', 'setup', 'initialize', 'configure',
  'refactor', 'migrate', 'convert', 'integrate', 'hook up',
];

function quickBuildLane(msg: string): boolean {
  return BUILD_IMPERATIVES.some(re => re.test(msg.trim()));
}

function quickFastLane(msg: string): boolean {
  const lower = msg.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;
  if (wordCount < 6 && !BUILD_KEYWORDS.some(kw => lower.includes(kw))) return true;
  if (/^(what|how|why|when|where|who|which|can you explain|tell me|is it|should i)\b/i.test(lower)) {
    if (!BUILD_KEYWORDS.some(kw => lower.includes(kw))) return true;
  }
  return false;
}

export async function classifyIntent(message: string): Promise<RouteResult> {
  // 1. Hard short-circuit — imperative build phrases never go to LLM
  if (quickBuildLane(message)) {
    return { lane: 'build', intent: 'build' };
  }

  const hasBuildKw = BUILD_KEYWORDS.some(kw => message.toLowerCase().includes(kw));

  // 2. Obvious fast lane — skip LLM
  if (!hasBuildKw && quickFastLane(message)) {
    return { lane: 'fast', intent: 'answer' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { lane: hasBuildKw ? 'build' : 'fast', intent: hasBuildKw ? 'build' : 'answer' };
  }

  // 3. Ambiguous — ask Haiku
  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      system: `Classify this message into one of two lanes:
- "build": user wants something CREATED, BUILT, DEPLOYED, WRITTEN, FIXED, or IMPLEMENTED — any action that produces output
- "fast": user wants an EXPLANATION, ADVICE, RECOMMENDATION, or ANSWER — no output produced

When in doubt, choose "build". Respond with ONLY valid JSON:
{"lane":"fast","intent":"<one word>"}
{"lane":"build","intent":"<one word>"}`,
      messages: [{ role: 'user', content: message.slice(0, 500) }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(text) as { lane: string; intent: string };
    if (parsed.lane === 'fast' || parsed.lane === 'build') {
      return { lane: parsed.lane, intent: parsed.intent ?? 'unknown' };
    }
  } catch {
    // fallback
  }

  return { lane: hasBuildKw ? 'build' : 'fast', intent: hasBuildKw ? 'build' : 'answer' };
}
