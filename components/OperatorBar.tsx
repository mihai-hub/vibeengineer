'use client';

import { useState, RefObject } from 'react';
import { Bot, Loader2, Send } from 'lucide-react';

interface OperateResult {
  action: string;
  selector?: string;
  coordinates?: { x: number; y: number };
  value?: string;
  found: boolean;
  error?: string;
}

interface OperatorBarProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

export default function OperatorBar({ iframeRef }: OperatorBarProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OperateResult | null>(null);

  async function handleOperate() {
    const action = input.trim();
    if (!action) return;

    setLoading(true);
    setResult(null);

    try {
      // Grab the iframe HTML if possible
      let iframeHtml: string | undefined;
      try {
        iframeHtml =
          iframeRef.current?.contentDocument?.documentElement?.outerHTML ?? undefined;
      } catch {
        // Cross-origin or unavailable
      }

      const res = await fetch('/api/operate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, iframeHtml }),
      });

      const data = (await res.json()) as OperateResult;
      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({ action, found: false, error: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-violet-900/40 bg-zinc-900 px-4 py-3 shrink-0">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <Bot size={13} className="text-violet-400" />
        <span className="text-xs font-semibold text-violet-400 uppercase tracking-widest font-mono">
          AI Operator
        </span>
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && handleOperate()}
          placeholder="Describe what to click or interact with..."
          className="flex-1 bg-zinc-800 text-white text-sm rounded-md px-3 py-2 outline-none border border-zinc-700 focus:border-violet-500 placeholder-zinc-500 transition-colors"
        />
        <button
          onClick={handleOperate}
          disabled={loading || !input.trim()}
          className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white text-sm font-semibold px-3 py-2 rounded-md transition-colors"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          Operate
        </button>
      </div>

      {/* Result panel */}
      {result && (
        <div className="mt-2 rounded-md bg-zinc-800 border border-zinc-700 p-3 text-xs font-mono text-zinc-300 space-y-1">
          {result.error ? (
            <p className="text-red-400">Error: {result.error}</p>
          ) : (
            <>
              <div className="flex gap-2">
                <span className="text-zinc-500">found:</span>
                <span className={result.found ? 'text-green-400' : 'text-red-400'}>
                  {String(result.found)}
                </span>
              </div>
              {result.selector && (
                <div className="flex gap-2">
                  <span className="text-zinc-500">selector:</span>
                  <span className="text-violet-300">{result.selector}</span>
                </div>
              )}
              {result.coordinates && (
                <div className="flex gap-2">
                  <span className="text-zinc-500">coordinates:</span>
                  <span className="text-cyan-300">
                    x={result.coordinates.x}, y={result.coordinates.y}
                  </span>
                </div>
              )}
              {result.value && (
                <div className="flex gap-2">
                  <span className="text-zinc-500">value:</span>
                  <span className="text-amber-300">{result.value}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-zinc-500">action:</span>
                <span className="text-white">{result.action}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
