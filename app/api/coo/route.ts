/**
 * /api/coo — SSE streaming AI advisor (COO + CTO)
 *
 * POST { messages: [{role, content}], files: Record<string, string>, advisorRole?: 'coo' | 'cto' }
 *
 * Streams SSE: `data: <token>\n\n` ... `data: [DONE]\n\n`
 */

import Anthropic from '@anthropic-ai/sdk';

const BASE_SYSTEM = `You are an AI COO advisor embedded inside VibeEngineer, a code generation platform. The user has just generated a software product and you have been given the generated files as context.

Your role is to help the founder think through:
- Go-to-market strategy and launch plan
- Pricing model and monetisation strategy  
- Team structure and hiring priorities
- Competitive landscape and differentiation
- Operational risks and mitigation
- Key metrics and milestones to track
- User acquisition and growth levers

Be concise, direct, and actionable. Reference specific parts of their app when relevant (e.g. specific components, features, or architectural decisions you can see in the code). Think like a seasoned COO who has launched multiple SaaS products.`;

const CTO_SYSTEM = `You are an AI CTO advisor embedded inside VibeEngineer, a code generation platform. The user has just generated a software product and you have been given the generated files as context.

Your role is to help the founder think through:
- Technical architecture decisions and trade-offs
- Stack choices and scalability considerations
- Security best practices and implementation
- API design, database schema, and data modeling
- Technical debt and refactoring priorities
- Infrastructure, DevOps, and deployment strategy
- Engineering team structure and hiring
- Build vs buy decisions

Be concise, direct, and technical. Reference specific parts of their app when relevant (e.g. specific files, components, or architectural patterns you can see in the code). Think like a seasoned CTO who has scaled multiple products from 0 to production.`;

function buildSystemPrompt(files: Record<string, string>, advisorRole?: string): string {
  const baseSystem = advisorRole === 'cto' ? CTO_SYSTEM : BASE_SYSTEM;
  const fileNames = Object.keys(files);
  if (fileNames.length === 0) return baseSystem;

  const priorityFiles = [
    'package.json',
    'README.md',
    'app/page.tsx',
    'pages/index.tsx',
    'app/layout.tsx',
  ];

  let contextSection = '\n\n---\n## Generated App Context\n\n';
  contextSection += `**Files generated (${fileNames.length} total):**\n`;
  contextSection += fileNames.map(f => `- ${f}`).join('\n');
  contextSection += '\n\n**Key file contents:**\n\n';

  let charsUsed = 0;
  const maxChars = 3000;

  for (const priority of priorityFiles) {
    const match = fileNames.find(f => f.endsWith(priority) || f === priority);
    if (match && files[match] && charsUsed < maxChars) {
      const content = files[match].slice(0, maxChars - charsUsed);
      contextSection += `\`\`\`${match}\n${content}\n\`\`\`\n\n`;
      charsUsed += content.length;
    }
  }

  return baseSystem + contextSection;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { messages, files, advisorRole } = body as {
    messages?: { role: 'user' | 'assistant'; content: string }[];
    files?: Record<string, string>;
    advisorRole?: string;
  };

  if (!messages || messages.length === 0) {
    return new Response('messages are required', { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const systemPrompt = buildSystemPrompt(files ?? {}, advisorRole);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const sdkStream = anthropic.messages.stream({
          model: 'claude-opus-4-5',
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        });

        for await (const event of sdkStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const token = event.delta.text;
            controller.enqueue(encoder.encode(`data: ${token}\n\n`));
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`data: Error: ${message}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
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
