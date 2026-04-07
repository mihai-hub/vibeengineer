/**
 * /api/generate — NDJSON streaming code generator
 *
 * POST { prompt: string, model?: string }
 *
 * Streams lines of:
 *   {"type":"file","path":"...","content":"...","lines":N}
 *   {"type":"done","total_files":N,"total_lines":N,"safety":{safe,issues}}
 *   {"type":"error","message":"..."}
 */

import Anthropic from '@anthropic-ai/sdk';
import { validateCode } from '@/lib/vibe-claw';
import { guardInput, GuardianBlock } from '@/lib/prompt-guardian';
import { preflightScan } from '@/lib/preflight-scan';
import { saveCheckpoint, completeCheckpoint, failCheckpoint } from '@/lib/task-checkpoint';

const BASE_SYSTEM_PROMPT = `You are a full-stack Next.js code generator. Generate a complete, production-ready Next.js 14 app for the user's prompt.

Output ONLY newline-delimited JSON — one file per line in this exact format:
{"type":"file","path":"relative/path/to/file.tsx","content":"full file content","lines":N}

After all files, output exactly:
{"type":"done","total_files":N,"total_lines":N}

Rules:
- No other text. No markdown. No explanations. Only JSON lines.
- Each JSON object must be on exactly one line (no multi-line JSON).
- "lines" is the number of newlines in the content + 1.
- Generate at least 8 files for a complete app: layout.tsx, page.tsx, globals.css, at least 3-4 components, package.json, tailwind.config.ts.
- All content must be properly JSON-escaped (escape double quotes, newlines as \\n, etc).

IMPORTANT RULES (non-negotiable):
- DO NOT rebuild existing pages or components — check the pre-flight scan above first
- NEVER create duplicate API routes — check app/api/ before adding new endpoints
- After completing the task, output a summary of what was created/changed and why
- If asked to add a feature that already exists, enhance it instead of duplicating`;

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

  // ── Security: scan input before any AI call ──────────────────────────────
  try {
    guardInput(prompt);
  } catch (err) {
    if (err instanceof GuardianBlock) return err.toResponse();
    throw err;
  }

  // ── Pre-flight: scan existing codebase ───────────────────────────────────
  const preflight = await preflightScan(prompt).catch(() => null);
  const systemPrompt = preflight
    ? `${BASE_SYSTEM_PROMPT}\n\n${preflight.contextBlock}`
    : BASE_SYSTEM_PROMPT;

  // ── Checkpoint: record task start ────────────────────────────────────────
  const sessionId = `vibe-gen-${Date.now()}`;
  await saveCheckpoint(sessionId, prompt);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const chosenModel = model || 'claude-sonnet-4-5';

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let buffer = '';
        let totalFiles = 0;
        let totalLines = 0;
        // Collect generated files for safety validation
        const generatedFiles: Record<string, string> = {};

        const anthropicStream = await anthropic.messages.stream({
          model: chosenModel,
          max_tokens: 16000,
          system: systemPrompt,
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
                  // Accumulate for safety scan
                  if (obj.path && obj.content !== undefined) {
                    generatedFiles[obj.path] = obj.content;
                  }
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
              if (obj.path && obj.content !== undefined) {
                generatedFiles[obj.path] = obj.content;
              }
              controller.enqueue(encodeLine(obj));
            }
          } catch {
            // ignore
          }
        }

        // ── VibeClaw: run safety scan on all generated files ──────
        const safety = validateCode(generatedFiles);

        // ── Checkpoint: mark completed ─────────────────────────────
        await completeCheckpoint(sessionId, `Generated ${totalFiles} files, ${totalLines} lines`);

        // Send final done line with safety info + preflight summary
        controller.enqueue(
          encodeLine({
            type: 'done',
            total_files: totalFiles,
            total_lines: totalLines,
            safety: { safe: safety.safe, issues: safety.issues },
            preflight: preflight ? {
              stack: preflight.stack,
              existing_features_found: preflight.matchingFeatures.length,
            } : null,
          })
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await failCheckpoint(sessionId, message);
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
