import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function randomPort() {
  return Math.floor(Math.random() * 999) + 3001;
}

export async function POST(req: NextRequest) {
  const { files } = (await req.json()) as { files: Record<string, string> };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-preview-'));

  // Write all files
  for (const [filename, content] of Object.entries(files)) {
    const fullPath = path.join(tmpDir, filename);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  // Write package.json if not provided
  if (!files['package.json']) {
    const pkg = {
      name: 'vibe-preview',
      version: '0.1.0',
      private: true,
      scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
      dependencies: { next: '14.2.3', react: '^18', 'react-dom': '^18' },
      devDependencies: {
        typescript: '^5',
        '@types/node': '^20',
        '@types/react': '^18',
        '@types/react-dom': '^18',
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg, null, 2));
  }

  // Write next.config.js if not provided
  if (!files['next.config.js'] && !files['next.config.mjs']) {
    fs.writeFileSync(
      path.join(tmpDir, 'next.config.js'),
      `/** @type {import('next').NextConfig} */\nconst nextConfig = {}\nmodule.exports = nextConfig\n`
    );
  }

  const port = randomPort();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: 'log', message: `📁 Created temp dir: ${tmpDir}` });
      send({ type: 'log', message: `📦 Installing dependencies...` });

      const install = spawn('npm', ['install'], { cwd: tmpDir, shell: true });

      install.stdout.on('data', (d: Buffer) => {
        const msg = d.toString().trim();
        if (msg) send({ type: 'log', message: msg });
      });
      install.stderr.on('data', (d: Buffer) => {
        const msg = d.toString().trim();
        if (msg) send({ type: 'log', message: msg });
      });

      install.on('close', (code: number) => {
        if (code !== 0) {
          send({ type: 'error', message: `npm install failed with code ${code}` });
          controller.close();
          return;
        }

        send({ type: 'log', message: `🚀 Starting Next.js dev server on port ${port}...` });

        const dev = spawn('npx', ['next', 'dev', '--port', String(port)], {
          cwd: tmpDir,
          shell: true,
          env: { ...process.env, PORT: String(port) },
        });

        let ready = false;

        const handleOutput = (d: Buffer) => {
          const msg = d.toString().trim();
          if (!msg) return;
          send({ type: 'log', message: msg });

          if (
            !ready &&
            (msg.includes('Ready') ||
              msg.includes('Local:') ||
              msg.includes('started server') ||
              msg.toLowerCase().includes('ready in'))
          ) {
            ready = true;
            send({ type: 'ready', port, url: `http://localhost:${port}` });
          }
        };

        dev.stdout.on('data', handleOutput);
        dev.stderr.on('data', handleOutput);

        dev.on('close', (exitCode: number) => {
          send({ type: 'log', message: `Dev server exited with code ${exitCode}` });
          controller.close();
        });

        dev.on('error', (err: Error) => {
          send({ type: 'error', message: err.message });
          controller.close();
        });

        // Auto-kill after 10 minutes
        setTimeout(() => {
          dev.kill();
          controller.close();
        }, 10 * 60 * 1000);
      });

      install.on('error', (err: Error) => {
        send({ type: 'error', message: err.message });
        controller.close();
      });
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
