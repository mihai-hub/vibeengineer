/**
 * VibeCode Preview Start API
 * Starts a preview server for generated code
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

// Store active preview processes in memory
const activePreviewProcesses = new Map<string, any>();

export async function POST(req: NextRequest) {
  try {
    const { projectId, files } = await req.json();

    if (!projectId || !files || files.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Missing projectId or files' },
        { status: 400 }
      );
    }

    // Stop existing preview if running
    if (activePreviewProcesses.has(projectId)) {
      const existingProcess = activePreviewProcesses.get(projectId);
      existingProcess.kill();
      activePreviewProcesses.delete(projectId);
    }

    // Create temp directory for preview
    const previewDir = path.join(process.cwd(), '.vibecode-preview', projectId);
    await fs.mkdir(previewDir, { recursive: true });

    // Write all files to preview directory
    for (const file of files) {
      const filePath = path.join(previewDir, file.path);
      const fileDir = path.dirname(filePath);
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf-8');
    }

    // Write package.json if not provided
    const packageJsonPath = path.join(previewDir, 'package.json');
    try {
      await fs.access(packageJsonPath);
    } catch {
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(
          {
            name: `vibecode-preview-${projectId}`,
            version: '0.1.0',
            private: true,
            scripts: {
              dev: 'next dev -p 3001',
              build: 'next build',
              start: 'next start',
            },
            dependencies: {
              next: '14.2.0',
              react: '^18',
              'react-dom': '^18',
            },
          },
          null,
          2
        ),
        'utf-8'
      );
    }

    // Start preview server on port 3001
    const previewProcess = spawn('npm', ['run', 'dev'], {
      cwd: previewDir,
      shell: true,
      detached: false,
    });

    activePreviewProcesses.set(projectId, previewProcess);

    let previewUrl = 'http://localhost:3001';
    let logBuffer: string[] = [];

    // Capture stdout
    previewProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      logBuffer.push(output);
      // console.log(`[Preview ${projectId}] ${output}`);

      // Detect when server is ready
      if (output.includes('ready')) {
        previewUrl = output.match(/http:\/\/localhost:\d+/)?.[0] || previewUrl;
      }
    });

    // Capture stderr
    previewProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      logBuffer.push(output);
      // console.error(`[Preview ${projectId}] ${output}`);
    });

    // Handle process exit
    previewProcess.on('exit', (code) => {
      // console.log(`Preview process ${projectId} exited with code ${code}`);
      activePreviewProcesses.delete(projectId);
    });

    return NextResponse.json({
      ok: true,
      previewUrl,
      projectId,
      message: 'Preview server starting...',
    });
  } catch (error: any) {
    console.error('Preview start error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to start preview' },
      { status: 500 }
    );
  }
}
