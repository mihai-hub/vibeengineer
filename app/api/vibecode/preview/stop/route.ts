/**
 * VibeCode Preview Stop API
 * Stops a running preview server
 */

import { NextRequest, NextResponse } from 'next/server';

// Import the same process map (in production, use Redis or similar)
// For now, we'll use a simple in-memory store
const activePreviewProcesses = new Map<string, any>();

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json(
        { ok: false, error: 'Missing projectId' },
        { status: 400 }
      );
    }

    // Check if preview is running
    if (!activePreviewProcesses.has(projectId)) {
      return NextResponse.json({
        ok: true,
        message: 'No preview running for this project',
      });
    }

    // Kill the process
    const process = activePreviewProcesses.get(projectId);
    process.kill();
    activePreviewProcesses.delete(projectId);

    return NextResponse.json({
      ok: true,
      message: 'Preview server stopped',
    });
  } catch (error: any) {
    console.error('Preview stop error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to stop preview' },
      { status: 500 }
    );
  }
}
