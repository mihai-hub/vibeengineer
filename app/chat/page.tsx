'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send, Loader2, Brain, Briefcase, Globe, ChevronDown } from 'lucide-react';
import MarkdownRenderer from '../../components/MarkdownRenderer';

/* ─── Types ──────────────────────────────────────────────────── */
type Mode = 'cto' | 'coo' | 'operate';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  mode?: Mode;
  operateResult?: OperateResult | null;
}

interface OperateResult {
  action: string;
  selector?: string;
  coordinates?: { x: number; y: number };
  value?: string;
  found: boolean;
  error?: string;
}

/* ─── Mode config ─────────────────────────────────────────────── */
const MODE_CONFIG = {
  cto: {
    label: 'CTO',
    icon: Brain,
    color: 'violet',
    avatar: '🧠',
    accent: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
    ring: 'focus:border-violet-500/50 focus:ring-violet-500/20',
    btn: 'bg-violet-600 hover:bg-violet-500',
    dot: 'bg-violet-400',
    opening: "Tell me about the app you want to build — I'll help you choose the right stack and architecture.",
  },
  coo: {
    label: 'COO',
    icon: Briefcase,
    color: 'orange',
    avatar: '💼',
    accent: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
    ring: 'focus:border-orange-500/50 focus:ring-orange-500/20',
    btn: 'bg-orange-500 hover:bg-orange-400',
    dot: 'bg-orange-400',
    opening: "What problem are you solving and who is your customer? I'll help with positioning, pricing, and growth.",
  },
  operate: {
    label: 'Operator',
    icon: Globe,
    color: 'cyan',
    avatar: '🖥️',
    accent: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    ring: 'focus:border-cyan-500/50 focus:ring-cyan-500/20',
    btn: 'bg-cyan-600 hover:bg-cyan-500',
    dot: 'bg-cyan-400',
    opening: "Give me a URL and tell me what to do — I'll operate the browser for you.",
  },
};

/* ─── Mode detection ─────────────────────────────────────────── */
function detectMode(text: string): Mode {
  const lower = text.toLowerCase();
  const hasUrl = /https?:\/\/[^\s]+/.test(text);
  const operatorKw = ['click', 'navigate to', 'go to', 'open site', 'visit ', 'operate', 'find on', 'scroll down', 'type into', 'fill in', 'check the site', 'look at the page'];
  const ctoKw = ['build', 'architecture', 'stack', 'tech', 'code', 'api', 'database', 'deploy', 'infrastructure', 'framework', 'backend', 'frontend', 'server', 'microservice'];
  const cooKw = ['grow', 'users', 'revenue', 'marketing', 'pricing', 'strategy', 'customers', 'operations', 'hire', 'launch', 'monetize', 'acquisition', 'retention', 'churn', 'gtm'];

  if (hasUrl || operatorKw.some(k => lower.includes(k))) return 'operate';
  const ctoScore = ctoKw.filter(k => lower.includes(k)).length;
  const cooScore = cooKw.filter(k => lower.includes(k)).length;
  if (cooScore > ctoScore) return 'coo';
  return 'cto';
}

function extractUrl(text: string): string {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : '';
}

/* ─── Main inner component ───────────────────────────────────── */
function ChatInner() {
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get('mode') as Mode) ?? 'cto';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [lockedMode, setLockedMode] = useState<Mode | null>(
    searchParams.get('mode') ? initialMode : null
  );
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: MODE_CONFIG[initialMode].opening, mode: initialMode },
  ]);
  const [input, setInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [operating, setOperating] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ─── Auto-detect mode from input ────────────────────────── */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
    if (!lockedMode && val.length > 10) {
      const detected = detectMode(val);
      setMode(detected);
      const url = extractUrl(val);
      if (url && !urlInput) setUrlInput(url);
    }
  };

  /* ─── Send ──────────────────────────────────────────────────── */
  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || streaming || operating) return;

    const activeMode = lockedMode ?? detectMode(text);
    setMode(activeMode);

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const userMsg: Message = { role: 'user', content: text, mode: activeMode };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    /* ── Operator mode ─────────────────────────────────────── */
    if (activeMode === 'operate') {
      setOperating(true);
      const url = urlInput || extractUrl(text);
      try {
        const res = await fetch('/api/operate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: text, url }),
        });
        const result = (await res.json()) as OperateResult;
        const reply = result.found
          ? `Found: \`${result.selector || 'element'}\`${result.coordinates ? ` at (${result.coordinates.x}, ${result.coordinates.y})` : ''}${result.value ? ` — value: "${result.value}"` : ''}`
          : `Could not find the element for: "${text}"${result.error ? `\n\nError: ${result.error}` : ''}`;
        setMessages([...newMessages, { role: 'assistant', content: reply, mode: 'operate', operateResult: result }]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setMessages([...newMessages, { role: 'assistant', content: `⚠️ Operator error: ${msg}`, mode: 'operate' }]);
      } finally {
        setOperating(false);
        textareaRef.current?.focus();
      }
      return;
    }

    /* ── CTO / COO chat mode ───────────────────────────────── */
    setStreaming(true);
    const assistantPlaceholder: Message = { role: 'assistant', content: '', mode: activeMode };
    setMessages([...newMessages, assistantPlaceholder]);

    try {
      abortRef.current = new AbortController();
      const endpoint = activeMode === 'cto' ? '/api/cto' : '/api/coo';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error(`API error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const token = line.slice(6);
          if (token === '[DONE]') break;
          assistantContent += token;
          setMessages([...newMessages, { role: 'assistant', content: assistantContent, mode: activeMode }]);
        }
      }
      setMessages([...newMessages, { role: 'assistant', content: assistantContent, mode: activeMode }]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const errMsg = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ Error: ${errMsg}`, mode: activeMode }]);
    } finally {
      setStreaming(false);
      textareaRef.current?.focus();
    }
  }, [input, streaming, operating, messages, lockedMode, urlInput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const cfg = MODE_CONFIG[mode];
  const ModeIcon = cfg.icon;

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Back</a>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            <span className="text-sm font-semibold text-white">AI {cfg.label}</span>
            <span className="text-xs text-zinc-500">— auto-detecting from your message</span>
          </div>
        </div>

        {/* Mode selector */}
        <div className="relative">
          <button
            onClick={() => setShowModePicker(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-xs text-zinc-300 transition-colors"
          >
            <ModeIcon className="w-3.5 h-3.5" />
            {lockedMode ? cfg.label : 'Auto'}
            <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
          {showModePicker && (
            <div className="absolute right-0 top-9 z-50 w-44 rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl overflow-hidden">
              <button
                onClick={() => { setLockedMode(null); setShowModePicker(false); }}
                className="w-full px-4 py-2.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-zinc-500" /> Auto-detect
              </button>
              {(Object.keys(MODE_CONFIG) as Mode[]).map(m => {
                const c = MODE_CONFIG[m];
                const Icon = c.icon;
                return (
                  <button
                    key={m}
                    onClick={() => { setLockedMode(m); setMode(m); setShowModePicker(false); }}
                    className="w-full px-4 py-2.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                  >
                    <Icon className="w-3.5 h-3.5" /> {c.label}
                    {lockedMode === m && <span className="ml-auto text-[10px] text-zinc-500">✓ locked</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6" onClick={() => setShowModePicker(false)}>
        {messages.map((msg, i) => {
          const msgCfg = MODE_CONFIG[msg.mode ?? 'cto'];
          return (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-base">
                  {msgCfg.avatar}
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-tr-sm'
                  : 'bg-zinc-800/80 text-zinc-100 rounded-tl-sm'
              }`}>
                {msg.role === 'assistant' ? (
                  msg.content === '' && (streaming || operating) ? (
                    <span className="flex items-center gap-2 text-zinc-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-xs">{operating ? 'Operating browser…' : 'Thinking…'}</span>
                    </span>
                  ) : (
                    <MarkdownRenderer content={msg.content} />
                  )
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="shrink-0 w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-base">👤</div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ──────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-2">

          {/* URL input — shown when operator mode detected */}
          {mode === 'operate' && (
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://example.com — URL to operate (optional)"
                className="flex-1 rounded-lg bg-zinc-800 border border-cyan-500/30 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          )}

          <div className="flex items-end gap-3">
            {/* Mode pill */}
            <div className={`shrink-0 self-end mb-0.5 px-2 py-1 rounded-lg border text-[10px] font-medium flex items-center gap-1 ${cfg.accent}`}>
              <ModeIcon className="w-3 h-3" />
              {cfg.label}
            </div>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'operate'
                  ? 'Click the sign up button… / Go to https://… and find the pricing…'
                  : mode === 'coo'
                  ? 'How should I price this? Who is my customer?…'
                  : 'What stack should I use? How do I architect this?…'
              }
              rows={1}
              disabled={streaming || operating}
              className={`flex-1 resize-none rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 disabled:opacity-50 transition-colors ${cfg.ring}`}
              style={{ minHeight: '44px', maxHeight: '140px' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={streaming || operating || !input.trim()}
              className={`shrink-0 w-10 h-10 rounded-xl ${cfg.btn} disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors`}
            >
              {streaming || operating
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-center text-xs text-zinc-600">
            Auto-detects CTO / COO / Operator from your message — or lock a mode above
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
      </div>
    }>
      <ChatInner />
    </Suspense>
  );
}
