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

interface OperateRequest {
  action: string;
  selector?: string;
  value?: string;
  iframeHtml?: string;
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
    const { action, selector, value, iframeHtml } = body;

    if (!action?.trim()) {
      return Response.json({ error: 'action is required' }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userParts: Anthropic.MessageParam['content'] = [];

    // Include HTML content if provided
    if (iframeHtml?.trim()) {
      // Truncate to avoid token limit issues (keep first 30k chars)
      const truncatedHtml = iframeHtml.length > 30000
        ? iframeHtml.slice(0, 30000) + '\n... [HTML truncated] ...'
        : iframeHtml;

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
