/**
 * VibeCode Preview Logs API
 * Streams preview server logs via SSE
 */

import { NextRequest, NextResponse } from 'next/server';

// In production, store logs in Redis or a database
const previewLogs = new Map<string, string[]>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json(
      { ok: false, error: 'Missing projectId' },
      { status: 400 }
    );
  }

  // Get logs for this project
  const logs = previewLogs.get(projectId) || [];

  // Return as SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send existing logs
      for (const log of logs) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ log })}\n\n`));
      }

      // Send keep-alive every 30 seconds
      const keepAliveInterval = setInterval(() => {
        controller.enqueue(encoder.encode(': keep-alive\n\n'));
      }, 30000);

      // Clean up on close
      req.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// Helper function to add logs (called from preview/start)
// Note: This is for internal use, not exported to Next.js routing
// export function addPreviewLog(projectId: string, log: string) {
//   if (!previewLogs.has(projectId)) {
//     previewLogs.set(projectId, []);
//   }
//   const logs = previewLogs.get(projectId)!;
//   logs.push(log);
//
//   // Keep only last 100 logs
//   if (logs.length > 100) {
//     logs.shift();
//   }
// }
