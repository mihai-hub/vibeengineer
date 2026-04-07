/**
 * /api/operate — Computer-Use Browser Operator
 *
 * POST { action: string, selector?: string, value?: string, iframeHtml?: string }
 *
 * Uses claude-sonnet-4-6 with vision to determine how to interact with the
 * given HTML content based on a natural language action description.
 *
 * Returns: { action, selector, coordinates?: {x, y}, value?: string, found: boolean }
 */

import Anthropic from '@anthropic-ai/sdk';
import { guardInput, GuardianBlock } from '@/lib/prompt-guardian';

// Jeff-accessible sites — never includes jeff-asi.com
const BLOCKED_DOMAINS = ['jeff-asi.com', 'dashboard.jeff-asi.com', 'api.jeff-asi.com'];

interface OperateRequest {
  action: string;
  selector?: string;
  value?: string;
  iframeHtml?: string;
  url?: string; // fetch external page HTML server-side
}

interface OperateResult {
  action: string;
  selector?: string;
  coordinates?: { x: number; y: number };
  value?: string;
  found: boolean;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OperateRequest;
    const { action, selector, value, iframeHtml, url } = body;

    if (!action?.trim()) {
      return Response.json({ error: 'action is required' }, { status: 400 });
    }

    // ── Security: scan action input ──────────────────────────────────────
    try {
      guardInput(action);
    } catch (err) {
      if (err instanceof GuardianBlock) return err.toResponse();
      throw err;
    }

    // Block Jeff dashboard from being operated
    if (url) {
      try {
        const hostname = new URL(url).hostname;
        if (BLOCKED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
          return Response.json({ action: 'blocked', found: false, error: 'This domain cannot be operated.' }, { status: 403 });
        }
      } catch { /* invalid URL — let it through, will fail at fetch */ }
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userParts: Anthropic.MessageParam['content'] = [];

    // Fetch external URL server-side if provided
    let htmlContent = iframeHtml;
    if (!htmlContent && url?.trim()) {
      try {
        const fetchRes = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VibeEngineer-Operator/1.0)' },
          signal: AbortSignal.timeout(10000),
        });
        htmlContent = await fetchRes.text();
      } catch (fetchErr) {
        return Response.json({ action: 'error', found: false, error: `Could not fetch URL: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}` }, { status: 400 });
      }
    }

    // Include HTML content if provided
    if (htmlContent?.trim()) {
      // Truncate to avoid token limit issues (keep first 30k chars)
      const truncatedHtml = htmlContent.length > 30000
        ? htmlContent.slice(0, 30000) + '\n... [HTML truncated] ...'
        : htmlContent;

      userParts.push({
        type: 'text',
        text: `HTML content of the page:\n\`\`\`html\n${truncatedHtml}\n\`\`\``,
      });
    }

    // Build the user action prompt
    let actionPrompt = `Action to perform: ${action}`;
    if (selector) actionPrompt += `\nHint selector: ${selector}`;
    if (value) actionPrompt += `\nValue to use: ${value}`;

    userParts.push({
      type: 'text',
      text: actionPrompt,
    });

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system:
        'You are a browser operator. Given HTML content and an action description, output ONLY JSON: {"action": string, "selector": string, "coordinates": {"x": number, "y": number}, "value": string, "found": boolean}. The "coordinates" and "value" fields are optional. No other text. No markdown. Just the raw JSON object.',
      messages: [
        {
          role: 'user',
          content: userParts,
        },
      ],
    });

    const rawText =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';

    // Strip potential markdown code fences
    const cleaned = rawText
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    const result = JSON.parse(cleaned) as OperateResult;

    return Response.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { action: 'error', found: false, error: message },
      { status: 500 }
    );
  }
}
