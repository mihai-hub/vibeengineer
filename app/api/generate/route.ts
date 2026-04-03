/**
 * /api/generate — NDJSON streaming code generator
 *
 * POST { prompt: string, model?: string }
 *
 * Streams lines of:
 *   {"type":"file","path":"...","content":"...","lines":N}
 *   {"type":"done","total_files":N,"total_lines":N}
 *   {"type":"error","message":"..."}
 */

import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a full-stack Next.js code generator. Generate a complete, production-ready Next.js 14 app for the user's prompt.

Output ONLY newline-delimited JSON — one file per line in this exact format:
{"type":"file","path":"relative/path/to/file.tsx","content":"full file content","lines":N}

After all files, output exactly:
{"type":"done","total_files":N,"total_lines":N}

Rules:
- No other text. No markdown. No explanations. Only JSON lines.
- Each JSON object must be on exactly one line (no multi-line JSON).
- "lines" is the number of newlines in the content + 1.
- Generate at least 8 files for a complete app: layout.tsx, page.tsx, globals.css, at least 3-4 components, package.json, tailwind.config.ts.
- All content must be properly JSON-escaped (escape double quotes, newlines as \\n, etc).`;

function encodeLine(obj: object): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + '\n');
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { prompt, model } = body as { prompt?: string; model?: string };

  if (!prompt?.trim()) {
    return new Response(
      JSON.stringify({ type: 'error', message: 'prompt is required' }) + '\n',
      { status: 400, headers: { 'Content-Type': 'application/x-ndjson' } }
    );
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const chosenModel = model || 'claude-sonnet-4-5';

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let buffer = '';
        let totalFiles = 0;
        let totalLines = 0;

        const anthropicStream = await anthropic.messages.stream({
          model: chosenModel,
          max_tokens: 16000,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Build this app: ${prompt}`,
            },
          ],
        });

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            buffer += chunk.delta.text;

            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              try {
                const obj = JSON.parse(trimmed) as {
                  type: string;
                  path?: string;
                  content?: string;
                  lines?: number;
                  total_files?: number;
                  total_lines?: number;
                };

                if (obj.type === 'file') {
                  totalFiles++;
                  totalLines += obj.lines ?? 0;
                  controller.enqueue(encodeLine(obj));
                } else if (obj.type === 'done') {
                  // Will send our own done at the end
                }
              } catch {
                // Not valid JSON yet — skip
              }
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          try {
            const obj = JSON.parse(buffer.trim()) as {
              type: string;
              path?: string;
              content?: string;
              lines?: number;
            };
            if (obj.type === 'file') {
              totalFiles++;
              totalLines += obj.lines ?? 0;
              controller.enqueue(encodeLine(obj));
            }
          } catch {
            // ignore
          }
        }

        // Send final done line
        controller.enqueue(
          encodeLine({ type: 'done', total_files: totalFiles, total_lines: totalLines })
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(encodeLine({ type: 'error', message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    },
  });
}
