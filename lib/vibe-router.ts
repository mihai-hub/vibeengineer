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

const BUILD_KEYWORDS = [
  'build', 'create', 'generate', 'deploy', 'fix ', 'run ', 'ship',
  'add feature', 'implement', 'write code', 'make me', 'scaffold',
  'set up', 'setup', 'initialize', 'init ', 'install', 'configure',
  'refactor', 'migrate', 'convert', 'integrate', 'hook up',
];

function quickFastLane(msg: string): boolean {
  const lower = msg.toLowerCase().trim();
  // Very short messages without build verbs → fast
  const wordCount = lower.split(/\s+/).length;
  if (wordCount < 6 && !BUILD_KEYWORDS.some(kw => lower.includes(kw))) return true;
  // Pure questions
  if (/^(what|how|why|when|where|who|which|can you explain|tell me|is it|should i)\b/i.test(lower)) {
    if (!BUILD_KEYWORDS.some(kw => lower.includes(kw))) return true;
  }
  return false;
}

export async function classifyIntent(message: string): Promise<RouteResult> {
  // Quick local check before hitting API
  const hasBuildKw = BUILD_KEYWORDS.some(kw => message.toLowerCase().includes(kw));
  if (!hasBuildKw && quickFastLane(message)) {
    return { lane: 'fast', intent: 'answer' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: heuristic only
    return { lane: hasBuildKw ? 'build' : 'fast', intent: hasBuildKw ? 'build' : 'answer' };
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 50,
      system: `You are a request classifier. Classify the user message into one of two lanes:
- "fast": explaining, answering questions, reviewing, suggesting, giving advice, short messages
- "build": creating, generating, deploying, fixing code, implementing features, running commands, writing/modifying files

Respond with ONLY valid JSON, no markdown, no explanation:
{"lane":"fast","intent":"<one word intent>"}
or
{"lane":"build","intent":"<one word intent>"}`,
      messages: [{ role: 'user', content: message.slice(0, 500) }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(text) as { lane: string; intent: string };

    if (parsed.lane === 'fast' || parsed.lane === 'build') {
      return { lane: parsed.lane, intent: parsed.intent ?? 'unknown' };
    }
  } catch {
    // On any error, use heuristic
  }

  return { lane: hasBuildKw ? 'build' : 'fast', intent: hasBuildKw ? 'build' : 'answer' };
}
