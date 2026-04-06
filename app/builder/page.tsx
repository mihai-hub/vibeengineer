'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Send, Loader2, CheckCircle2, Terminal, Download, AlertCircle, BrainCircuit } from 'lucide-react';
import OperatorBar from '@/components/OperatorBar';

/* ─── Types ──────────────────────────────────────────────────── */
type FileEntry = {
  id: string;
  path: string;
  content: string;
  lines: number;
  status: 'writing' | 'done';
};

type GeneratorStatus = 'idle' | 'generating' | 'done' | 'error';

/* ─── Inner builder (needs useSearchParams) ───────────────────── */
function BuilderInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlPrompt = searchParams.get('prompt') ?? '';

  const [manualPrompt, setManualPrompt] = useState('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [status, setStatus] = useState<GeneratorStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalLines, setTotalLines] = useState(0);
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ logs: string[]; url: string | null; loading: boolean }>({
    logs: [],
    url: null,
    loading: false,
  });
  const feedRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  /* ── Auto-generate when prompt is in URL ── */
  useEffect(() => {
    if (!urlPrompt || hasStarted.current) return;
    hasStarted.current = true;
    generate(urlPrompt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPrompt]);

  /* ── Auto-scroll terminal ── */
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [files]);

  async function generate(prompt: string) {
    setStatus('generating');
    setFiles([]);
    setErrorMsg('');
    setTotalFiles(0);
    setTotalLines(0);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fileIndex = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

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
              message?: string;
            };

            if (obj.type === 'file' && obj.path) {
              const id = `file-${fileIndex++}`;
              const lineCount = obj.lines ?? (obj.content?.split('\n').length ?? 0);

              // Add as 'writing' briefly, then flip to 'done'
              setFiles(prev => [
                ...prev,
                { id, path: obj.path!, content: obj.content ?? '', lines: lineCount, status: 'writing' },
              ]);

              // Small delay for visual effect, then mark done
              setTimeout(() => {
                setFiles(prev =>
                  prev.map(f => f.id === id ? { ...f, status: 'done' } : f)
                );
              }, 300);

            } else if (obj.type === 'done') {
              setTotalFiles(obj.total_files ?? fileIndex);
              setTotalLines(obj.total_lines ?? 0);
              setStatus('done');
              // Capture all generated files for preview
              setGeneratedFiles(prev => {
                const map: Record<string, string> = { ...prev };
                // files state is captured in closure; build from setFiles accumulation
                return map;
              });

            } else if (obj.type === 'error') {
              setErrorMsg(obj.message ?? 'Unknown error');
              setStatus('error');
            }
          } catch {
            // Incomplete JSON — skip
          }
        }
      }

      // If stream ended without explicit done
      if (status === 'generating') {
        setStatus('done');
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
      setStatus('error');
    }
  }

  async function handleDownloadZip() {
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: files.map(f => ({ path: f.path, content: f.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vibeengineer-app.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Download failed: ${message}`);
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = manualPrompt.trim();
    if (!p) return;
    router.push(`/builder?prompt=${encodeURIComponent(p)}`);
  }

  const doneFiles = files.filter(f => f.status === 'done');
  const displayTotalLines = totalLines || doneFiles.reduce((s, f) => s + f.lines, 0);

  // ── Live preview state ──
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [patchRequest, setPatchRequest] = useState('');
  const [patchLoading, setPatchLoading] = useState(false);
  const [patchMsg, setPatchMsg] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Build blob URL from generated files whenever doneFiles changes and status is done
  useEffect(() => {
    if (status !== 'done' || doneFiles.length === 0) return;
    const htmlFile = doneFiles.find(f => f.path.endsWith('.html')) ?? doneFiles[0];
    let html = htmlFile.content;
    // Inject CSS inline
    doneFiles.filter(f => f.path.endsWith('.css')).forEach(f => {
      html = html.replace('</head>', `<style>${f.content}</style></head>`);
      if (!html.includes('</head>')) html = `<style>${f.content}</style>` + html;
    });
    // Inject JS inline
    doneFiles.filter(f => f.path.endsWith('.js') && !f.path.endsWith('.min.js')).forEach(f => {
      html = html.replace('</body>', `<script>${f.content}</script></body>`);
      if (!html.includes('</body>')) html += `<script>${f.content}</script>`;
    });
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setIframeSrc(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, doneFiles.length]);

  async function handleAIFix() {
    if (!patchRequest.trim() || doneFiles.length === 0) return;
    setPatchLoading(true);
    setPatchMsg('');
    try {
      // Screenshot the iframe via Canvas API
      let screenshot_b64 = '';
      if (iframeRef.current?.contentDocument?.body) {
        const { default: html2canvas } = await import('html2canvas');
        const canvas = await html2canvas(iframeRef.current.contentDocument.body, { useCORS: true });
        screenshot_b64 = canvas.toDataURL('image/png').split(',')[1];
      }
      const filesMap = Object.fromEntries(doneFiles.map(f => [f.path, f.content]));
      const res = await fetch('/api/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenshot_b64, request: patchRequest, files: filesMap }),
      });
      const { patches } = await res.json() as { patches: { path: string; content: string }[] };
      if (patches?.length) {
        // Apply patches to files state
        const patchMap = Object.fromEntries(patches.map((p: { path: string; content: string }) => [p.path, p.content]));
        setFiles(prev => prev.map(f => patchMap[f.path] ? { ...f, content: patchMap[f.path] } : f));
        setPatchMsg(`Patched ${patches.length} file${patches.length > 1 ? 's' : ''}`);
        setPatchRequest('');
      } else {
        setPatchMsg('No changes needed');
      }
    } catch (err: unknown) {
      setPatchMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPatchLoading(false);
    }
  }

  /* ─── No prompt: show input form ─────────────────────────────── */
  if (!urlPrompt) {
    return (
      <div className="flex h-screen bg-zinc-950 text-white items-center justify-center">
        <div className="w-full max-w-xl px-6">
          <h1 className="text-2xl font-bold mb-2 text-center">VibeEngineer</h1>
          <p className="text-zinc-400 text-center mb-8">Describe your app. Watch it get built.</p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualPrompt}
              onChange={e => setManualPrompt(e.target.value)}
              placeholder="Build a SaaS dashboard with analytics and user management..."
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={!manualPrompt.trim()}
              className="bg-violet-600 text-white px-5 py-3 rounded-lg font-semibold text-sm disabled:opacity-40 hover:bg-violet-500 transition-colors flex items-center gap-2"
            >
              <Send size={14} />
              Build
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ─── Builder UI ──────────────────────────────────────────────── */
  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">

      {/* ─── LEFT PANEL (60%) ─── */}
      <div className="w-[60%] flex flex-col border-r border-zinc-800">

        {/* Prompt header */}
        <div className="border-b border-zinc-800 bg-zinc-900 px-5 py-4 shrink-0">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1 font-mono">Prompt</p>
          <p className="text-white text-sm leading-relaxed">{urlPrompt}</p>
        </div>

        {/* Terminal feed */}
        <div className="flex-1 flex flex-col bg-black overflow-hidden">
          {/* Terminal header bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 shrink-0">
            <Terminal size={13} className="text-zinc-500" />
            {status === 'generating' && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-xs text-zinc-400 font-mono">Generating…</span>
              </>
            )}
            {status === 'done' && (
              <>
                <span className="inline-flex rounded-full h-2 w-2 bg-green-500" />
                <span className="text-xs text-green-400 font-mono">Done</span>
              </>
            )}
            {status === 'error' && (
              <>
                <span className="inline-flex rounded-full h-2 w-2 bg-red-500" />
                <span className="text-xs text-red-400 font-mono">Error</span>
              </>
            )}
            {status === 'idle' && (
              <>
                <span className="inline-flex rounded-full h-2 w-2 bg-zinc-600" />
                <span className="text-xs text-zinc-500 font-mono">Idle</span>
              </>
            )}
          </div>

          {/* File list */}
          <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-3 font-mono text-sm space-y-[3px]">

            {status === 'error' && (
              <div className="flex items-start gap-2 text-red-400">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {files.length === 0 && status === 'generating' && (
              <div className="flex items-center gap-2 text-zinc-500">
                <Loader2 size={13} className="animate-spin" />
                <span>Connecting to Claude…</span>
              </div>
            )}

            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2"
                style={{ animation: 'slideIn 0.18s ease-out both' }}
              >
                {file.status === 'writing' ? (
                  <Loader2 size={12} className="text-zinc-500 animate-spin shrink-0" />
                ) : (
                  <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                )}
                <span
                  className="truncate transition-colors duration-200"
                  style={{ color: file.status === 'done' ? '#06b6d4' : '#ffffff' }}
                >
                  {file.path}
                </span>
                <span className="text-zinc-500 text-xs tabular-nums shrink-0 ml-auto">
                  {file.lines} lines
                </span>
              </div>
            ))}

            {status === 'done' && (
              <div
                className="mt-3 pt-3 border-t border-zinc-800 text-green-400 flex items-center gap-2"
                style={{ animation: 'slideIn 0.25s ease-out both' }}
              >
                <CheckCircle2 size={13} />
                <span>
                  Generated {totalFiles || doneFiles.length} files · {displayTotalLines.toLocaleString()} lines
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Download bar */}
        <div className="border-t border-zinc-800 bg-zinc-900 px-4 py-3 shrink-0 flex items-center gap-3">
          <button
            onClick={handleDownloadZip}
            disabled={status !== 'done' || files.length === 0}
            className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-30 hover:bg-violet-500 transition-colors"
          >
            <Download size={14} />
            Download ZIP
          </button>
          <button
            onClick={() => {
              sessionStorage.setItem(
                'vibeFiles',
                JSON.stringify(doneFiles.map(f => ({ path: f.path, content: f.content })))
              );
              router.push(`/coo?prompt=${encodeURIComponent(urlPrompt)}`);
            }}
            disabled={status !== 'done' || doneFiles.length === 0}
            className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-30 hover:bg-zinc-200 transition-colors"
          >
            <BrainCircuit size={14} />
            Talk to COO
          </button>
          {status === 'done' && (
            <span className="text-xs text-zinc-500">
              {doneFiles.length} files ready
            </span>
          )}
        </div>
      </div>

      {/* ─── RIGHT PANEL (40%) ─── */}
      <div className="w-[40%] flex flex-col">

        {/* Preview header */}
        <div className="border-b border-zinc-800 bg-zinc-900 px-5 py-4 shrink-0">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Preview</p>
        </div>

        {/* Live preview iframe / placeholder */}
        <div className="flex-1 bg-zinc-950 relative">
          {!iframeSrc ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-600">
              <Terminal size={32} />
              <p className="text-sm">{status === 'generating' ? 'Building preview…' : 'Files will appear here'}</p>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
              title="Live Preview"
            />
          )}
        </div>

        {/* AI Fix bar — shown when generation is done */}
        {status === 'done' && (
          <div className="border-t border-zinc-800 bg-zinc-900 px-4 py-3 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={patchRequest}
                onChange={e => setPatchRequest(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAIFix()}
                placeholder="Describe what to change…"
                className="flex-1 bg-zinc-800 text-white text-sm rounded-md px-3 py-2 outline-none border border-zinc-700 focus:border-violet-500 placeholder-zinc-500"
              />
              <button
                onClick={handleAIFix}
                disabled={patchLoading || !patchRequest.trim()}
                className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold px-3 py-2 rounded-md transition-colors"
              >
                {patchLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                AI Fix
              </button>
            </div>
            {patchMsg && <p className="text-xs text-zinc-400 mt-1.5">{patchMsg}</p>}
          </div>
        )}

        {/* AI Operator — shown when generation is done */}
        {status === 'done' && <OperatorBar iframeRef={iframeRef} />}

        {/* Build another */}
        <div className="border-t border-zinc-800 bg-zinc-900 px-4 py-2 shrink-0">
          <button
            onClick={() => router.push('/')}
            className="w-full text-sm text-zinc-400 hover:text-white transition-colors py-1"
          >
            ← Build another app
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─── Page wrapper with Suspense (required for useSearchParams) ── */
export default function BuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen bg-zinc-950 text-white items-center justify-center">
          <Loader2 size={24} className="animate-spin text-zinc-400" />
        </div>
      }
    >
      <BuilderInner />
    </Suspense>
  );
}
