import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

export const runtime = 'nodejs';

interface FileEntry {
  path: string;
  content: string;
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const files: FileEntry[] = body.files ?? [];

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const zip = new JSZip();

    for (const file of files) {
      if (file.path && typeof file.content === 'string') {
        const cleanPath = file.path.replace(/^\//, '');
        zip.file(cleanPath, file.content);
      }
    }

    // Generate as base64, then decode to Buffer — avoids Uint8Array BodyInit TS issue
    const base64 = await zip.generateAsync({
      type: 'base64',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const buf = Buffer.from(base64, 'base64');

    return new Response(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="vibeengineer-app.zip"',
        'Content-Length': buf.length.toString(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
