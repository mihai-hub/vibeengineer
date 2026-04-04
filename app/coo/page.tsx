'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Send, Loader2 } from 'lucide-react';
import MarkdownRenderer from '../../components/MarkdownRenderer';

/* ─── Types ─────────────────────────────────────────────────── */
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const OPENING_MESSAGE: Message = {
  role: 'assistant',
  content:
    "What problem are you solving and who is your customer? Let me help you with positioning and pricing.",
};

/* ─── Main inner component ───────────────────────────────────── */
function CooInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const promptParam = searchParams.get('prompt');

  const [messages, setMessages] = useState<Message[]>([OPENING_MESSAGE]);
  const [input, setInput] = useState(promptParam ?? '');
  const [streaming, setStreaming] = useState(false);
  const [files, setFiles] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ─── Load files from sessionStorage ─────────────────────── */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('vibeFiles');
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{ path: string; content: string }>;
        const fileMap: Record<string, string> = {};
        for (const f of parsed) fileMap[f.path] = f.content;
        setFiles(fileMap);
      }
    } catch {
      // ignore parse errors
    }
    textareaRef.current?.focus();
  }, []);

  /* ─── Auto-scroll ───────────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ─── Auto-grow textarea ────────────────────────────────────── */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };

  /* ─── Send ──────────────────────────────────────────────────── */
  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || streaming) return;

      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      const userMsg: Message = { role: 'user', content: text };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setStreaming(true);

      const assistantPlaceholder: Message = { role: 'assistant', content: '' };
      setMessages([...newMessages, assistantPlaceholder]);

      try {
        abortRef.current = new AbortController();
        const res = await fetch('/api/coo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: newMessages, files }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`API error ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const token = line.slice(6);
            if (token === '[DONE]') break;
            assistantContent += token;
            setMessages([
              ...newMessages,
              { role: 'assistant', content: assistantContent },
            ]);
          }
        }

        setMessages([
          ...newMessages,
          { role: 'assistant', content: assistantContent },
        ]);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const errMsg =
          err instanceof Error ? err.message : 'Something went wrong.';
        setMessages([
          ...newMessages,
          { role: 'assistant', content: `⚠️ Error: ${errMsg}` },
        ]);
      } finally {
        setStreaming(false);
        textareaRef.current?.focus();
      }
    },
    [input, streaming, messages, files]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-sm font-semibold text-white">AI COO Advisor</h1>
          </div>
        </div>
        <span className="text-xs text-zinc-500 font-mono">Powered by Claude</span>
      </div>

      {/* ── Messages ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="shrink-0 w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-base">
                💼
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-tr-sm'
                  : 'bg-zinc-800/80 text-zinc-100 rounded-tl-sm'
              }`}
            >
              {msg.role === 'assistant' ? (
                msg.content === '' && streaming ? (
                  <span className="flex items-center gap-2 text-zinc-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-xs">Thinking…</span>
                  </span>
                ) : (
                  <MarkdownRenderer content={msg.content} />
                )
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="shrink-0 w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-base">
                👤
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ───────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message… (Enter to send)"
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 disabled:opacity-50 transition-colors"
            style={{ minHeight: '44px', maxHeight: '140px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={streaming || !input.trim()}
            className="shrink-0 w-10 h-10 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            {streaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-center text-xs text-zinc-600 mt-2">Shift+Enter for new line</p>
      </div>
    </div>
  );
}

/* ─── Page wrapper with Suspense ─────────────────────────────── */
export default function CooPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
      </div>
    }>
      <CooInner />
    </Suspense>
  );
}
