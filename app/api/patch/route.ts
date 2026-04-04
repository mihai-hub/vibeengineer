import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { screenshot_b64, request, files } = body as {
      screenshot_b64: string;
      request: string;
      files: Record<string, string>;
    };

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const fileContents = Object.entries(files)
      .map(([p, c]) => `=== ${p} ===\n${c}`)
      .join('\n\n');

    const userContent: Anthropic.MessageParam['content'] = [];

    if (screenshot_b64) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: screenshot_b64,
        },
      });
    }

    userContent.push({
      type: 'text',
      text: `User request: ${request}\n\nCurrent files:\n${fileContents}`,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      system:
        'You are an AI that patches web app files based on visual feedback. You receive a screenshot of the running app and a user request. Output ONLY a JSON array of patches: [{path: string, content: string}]. Output nothing else — just the JSON array.',
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
    // Strip markdown code fences if present
    const cleaned = text
      .replace(/^```json\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    const patches = JSON.parse(cleaned) as Array<{
      path: string;
      content: string;
    }>;

    return Response.json({ patches });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ patches: [], error: message }, { status: 500 });
  }
}
