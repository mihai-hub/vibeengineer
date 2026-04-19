'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Loader2, Brain, Briefcase, Globe, ChevronDown, Zap, Check } from 'lucide-react';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import { StepCard, AgentStep } from '../../components/StepCard';
import Sources, { Source } from '../../components/Sources';
import { saveSkill } from '../../lib/skills';

/* ─── Helpers ────────────────────────────────────────────────── */
function isModifyIntent(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const modifyPhrases = [
    'change', 'update', 'fix', 'modify', 'edit', 'adjust', 'improve',
    'make it', 'make the', 'add a', 'add the', 'remove', 'replace',
    'rename', 'refactor', 'switch', 'turn it', 'can you add', 'can you change',
    'now add', 'also add', 'instead of',
  ];
  return modifyPhrases.some(p => lower.startsWith(p) || lower.includes(p));
}

/* ─── Types ──────────────────────────────────────────────────── */
type Mode = 'cto' | 'coo' | 'operate';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  mode?: Mode;
  operateResult?: OperateResult | null;
  sources?: Source[];
  appUrl?: string;
  appFiles?: Record<string, string>;
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
  const router = useRouter();
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
  const [builderBanner, setBuilderBanner] = useState<string | null>(null);
  const [currentLane, setCurrentLane] = useState<'fast' | 'build' | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [currentSources, setCurrentSources] = useState<Source[]>([]);
  const [savedSkillFor, setSavedSkillFor] = useState<number | null>(null);
  const [currentAppUrl, setCurrentAppUrl] = useState<string | null>(null);
  const [currentAppFiles, setCurrentAppFiles] = useState<Record<string, string> | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [codeViewFile, setCodeViewFile] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [clarifyQuestion, setClarifyQuestion] = useState<string | null>(null);
  const [planReview, setPlanReview] = useState<{ title: string; strategy: string; steps: string[]; originalMessage: string } | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string; url: string; files: Record<string, string>; createdAt: number }[]>([]);
  const [showProjects, setShowProjects] = useState(false);
  const [buildTier, setBuildTier] = useState<'pro' | 'power'>('pro');
  const [designMode, setDesignMode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastAppUrlRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load projects from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vibe_projects');
      if (saved) setProjects(JSON.parse(saved) as typeof projects);
    } catch { /* ignore */ }
  }, []);

  const saveProject = (name: string, url: string, files: Record<string, string>) => {
    const proj = { id: `proj-${Date.now()}`, name, url, files, createdAt: Date.now() };
    setProjects(prev => {
      const updated = [proj, ...prev].slice(0, 20); // keep last 20
      try { localStorage.setItem('vibe_projects', JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  };

  // Handle ?prompt= search param
  useEffect(() => {
    const prompt = searchParams.get('prompt');
    if (prompt) {
      setInput(prompt);
      // Auto-send after a brief delay to let the component mount & state update
      setTimeout(() => sendMessage(prompt), 100);
    } else {
      textareaRef.current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleSaveSkill = useCallback((msgIndex: number, prompt: string) => {
    const name = prompt.length > 50 ? prompt.slice(0, 50) + '…' : prompt;
    saveSkill(name, prompt);
    setSavedSkillFor(msgIndex);
    setTimeout(() => setSavedSkillFor(null), 2000);
  }, []);

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
    setCurrentLane(null);
    setCurrentSources([]);
    setCurrentAppUrl(null);
    setPreviewOpen(false);
    setSuggestions([]);
    setClarifyQuestion(null);
    setPlanReview(null);
    // Optimistic: show "Analysing…" immediately before first SSE event
    setAgentSteps([{
      id: 'init',
      type: 'thinking',
      label: 'Analysing request…',
      status: 'running',
    }]);

    try {
      abortRef.current = new AbortController();

      const conversationHistory = newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/vibe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory,
          existingFiles: currentAppFiles && isModifyIntent(text) ? currentAppFiles : undefined,
          buildTier,
          designMode,
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error(`API error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let buf = '';
      let sourcesForMessage: Source[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';

        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data: '));
          if (!dataLine) continue;
          const raw = dataLine.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;

          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            assistantContent += raw;
            setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m));
            continue;
          }

          const evtType = evt.type as string | undefined;

          if (evtType === 'lane') {
            // Remove the optimistic "Analysing…" step now that real events are flowing
            setAgentSteps(prev => prev.filter(s => s.id !== 'init'));
            setCurrentLane((evt.lane as 'fast' | 'build') ?? null);
          } else if (evtType === 'sources') {
            sourcesForMessage = (evt.sources as Source[]) ?? [];
            setCurrentSources(sourcesForMessage);
          } else if (evtType === 'step') {
            const step = evt.step as AgentStep;
            if (step) {
              setAgentSteps(prev => {
                const idx = prev.findIndex(s => s.id === step.id);
                if (idx >= 0) return prev.map((s, i) => i === idx ? { ...s, ...step } : s);
                return [...prev, step];
              });
            }
          } else if (evtType === 'token') {
            const tokenText = (evt.text as string) ?? '';
            assistantContent += tokenText;
            setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m));
          } else if (evtType === 'app_url') {
            const appUrl = evt.url as string;
            setCurrentAppUrl(appUrl);
            lastAppUrlRef.current = appUrl;
            setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, appUrl } : m));
            setPreviewOpen(true);
          } else if (evtType === 'app_code') {
            const files = evt.files as Record<string, string>;
            setCurrentAppFiles(files);
            setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, appFiles: files } : m));
            // Auto-save using ref (not stale state)
            const urlForSave = lastAppUrlRef.current;
            if (urlForSave) {
              const name = text.slice(0, 40) || 'Untitled App';
              saveProject(name, urlForSave, files);
            }
          } else if (evtType === 'plan_review') {
            const plan = evt.plan as { title: string; strategy: string; steps: string[]; originalMessage: string };
            setPlanReview(plan);
            setAgentSteps([]);
            setStreaming(false);
          } else if (evtType === 'suggestions') {
            setSuggestions((evt.items as string[]) ?? []);
          } else if (evtType === 'clarify') {
            setClarifyQuestion((evt.question as string) ?? null);
            setStreaming(false);
          } else if (evtType === 'error') {
            const errMsg = (evt.message as string) ?? 'Unknown error';
            setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: `⚠️ ${errMsg}` } : m));
          } else if (evtType === 'done') {
            // pass
          } else if (evtType === 'vibe_task_open_panel') {
            setBuilderBanner(`⚡ Builder activated — ${((evt.goal as string) ?? 'building now').slice(0, 60)}`);
            setTimeout(() => router.push((evt.navigateTo as string) ?? '/builder'), 1500);
          }
        }
      }
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent, sources: sourcesForMessage, appUrl: currentAppUrl ?? undefined } : m));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const errMsg = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: `⚠️ Error: ${errMsg}` } : m));
    } finally {
      setStreaming(false);
      setCurrentLane(null);
      textareaRef.current?.focus();
    }
  }, [input, streaming, operating, messages, lockedMode, urlInput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const cfg = MODE_CONFIG[mode];
  const ModeIcon = cfg.icon;

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white overflow-hidden">
      {builderBanner && (
        <div
          className="shrink-0 flex items-center justify-between px-4 py-2 cursor-pointer text-xs font-medium"
          style={{ background: 'rgba(6,182,212,0.12)', borderBottom: '1px solid rgba(6,182,212,0.3)', color: '#67e8f9' }}
          onClick={() => router.push('/builder')}
        >
          <span className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 animate-pulse" />{builderBanner}</span>
          <span className="underline opacity-70">Open Builder →</span>
        </div>
      )}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Back</a>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            <span className="text-sm font-semibold text-white">VibeEngineer</span>
          </div>
          {/* Projects button */}
          <div className="relative">
            <button
              onClick={() => setShowProjects(p => !p)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-xs text-zinc-400 transition"
            >
              📁 Projects {projects.length > 0 && <span className="bg-cyan-500/20 text-cyan-400 rounded-full px-1.5 py-px text-[10px]">{projects.length}</span>}
            </button>
            {showProjects && (
              <div className="absolute left-0 top-9 z-50 w-72 rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300">Saved Projects</span>
                  <button onClick={() => setShowProjects(false)} className="text-zinc-600 hover:text-zinc-400 text-xs">✕</button>
                </div>
                {projects.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-zinc-600 text-center">No projects yet — build something!</div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {projects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setCurrentAppFiles(p.files);
                          setCurrentAppUrl(p.url);
                          setPreviewOpen(true);
                          setShowProjects(false);
                          setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `Loaded **${p.name}** — [Open app](${p.url})`,
                            appUrl: p.url,
                            appFiles: p.files,
                          }]);
                        }}
                        className="w-full px-3 py-2.5 text-left hover:bg-zinc-800 transition border-b border-zinc-800/50 last:border-0"
                      >
                        <div className="text-xs text-zinc-200 truncate">{p.name}</div>
                        <div className="text-[10px] text-zinc-600 mt-0.5">{new Date(p.createdAt).toLocaleDateString()}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentLane === 'fast' && <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium animate-pulse" style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.3)', color: '#fbbf24' }}>⚡ Fast answer</div>}
          {currentLane === 'build' && <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium animate-pulse" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', color: '#67e8f9' }}>🔨 Building…</div>}
          {streaming && (
            <button
              onClick={() => { abortRef.current?.abort(); setStreaming(false); setCurrentLane(null); setAgentSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'done' } : s)); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition"
            >
              ⬛ Stop
            </button>
          )}
          <div className="relative">
            <button onClick={() => setShowModePicker(p => !p)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-xs text-zinc-300 transition-colors">
              <ModeIcon className="w-3.5 h-3.5" />{lockedMode ? cfg.label : 'Auto'}<ChevronDown className="w-3 h-3 opacity-50" />
            </button>
            {showModePicker && (
              <div className="absolute right-0 top-9 z-50 w-44 rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl overflow-hidden">
                <button onClick={() => { setLockedMode(null); setShowModePicker(false); }} className="w-full px-4 py-2.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-zinc-500" /> Auto-detect</button>
                {(Object.keys(MODE_CONFIG) as Mode[]).map(m => {
                  const c = MODE_CONFIG[m]; const Icon = c.icon;
                  return <button key={m} onClick={() => { setLockedMode(m); setMode(m); setShowModePicker(false); }} className="w-full px-4 py-2.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"><Icon className="w-3.5 h-3.5" /> {c.label}{lockedMode === m && <span className="ml-auto text-[10px] text-zinc-500">✓ locked</span>}</button>;
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6" onClick={() => setShowModePicker(false)}>
        <div className="max-w-3xl mx-auto space-y-8">
          {messages.map((msg, i) => {
            const msgCfg = MODE_CONFIG[msg.mode ?? 'cto'];
            return (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && <div className="shrink-0 w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-base">{msgCfg.avatar}</div>}
                <div className="flex flex-col gap-2 max-w-[85%]">
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-violet-600 text-white rounded-tr-sm self-end' : 'bg-zinc-800/80 text-zinc-100 rounded-tl-sm'}`}>
                    {msg.role === 'assistant' ? (
                      <>
                        {i === messages.length - 1 && (currentLane || agentSteps.length > 0) && (
                          <StepCard steps={agentSteps} isRunning={streaming} lane={currentLane ?? undefined} />
                        )}
                        {msg.content === '' && agentSteps.length === 0 && (streaming || operating) ? (
                          <span className="flex items-center gap-2 text-zinc-400"><Loader2 className="w-3 h-3 animate-spin" /><span className="text-xs">{operating ? 'Operating…' : 'Thinking…'}</span></span>
                        ) : (
                          <MarkdownRenderer content={msg.content} />
                        )}
                      </>
                    ) : <p className="whitespace-pre-wrap">{msg.content}</p>}
                  </div>

                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && <Sources sources={msg.sources} />}

                  {/* Inline app preview */}
                  {msg.role === 'assistant' && msg.appUrl && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-zinc-700/60 bg-zinc-900">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/80 border-b border-zinc-700/60">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                          <span className="ml-2 text-xs text-zinc-500 font-mono truncate max-w-[200px]">{msg.appUrl.replace('https://storage.googleapis.com/', '')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {msg.appFiles && (
                            <button
                              onClick={() => setCodeViewFile(codeViewFile ? null : Object.keys(msg.appFiles!)[0] ?? null)}
                              className="text-[10px] text-zinc-400 hover:text-cyan-400 transition px-1.5 py-0.5 rounded bg-zinc-700/50 hover:bg-zinc-700"
                            >
                              {codeViewFile ? 'Hide code' : '{ } Code'}
                            </button>
                          )}
                          <a href={msg.appUrl} target="_blank" rel="noreferrer" className="text-[10px] text-zinc-400 hover:text-cyan-400 transition px-1.5 py-0.5 rounded bg-zinc-700/50 hover:bg-zinc-700">
                            ↗ Open
                          </a>
                        </div>
                      </div>
                      {i === messages.length - 1 && previewOpen || (i < messages.length - 1 && msg.appUrl) ? (
                        <iframe
                          src={msg.appUrl}
                          className="w-full"
                          style={{ height: '420px', border: 'none' }}
                          sandbox="allow-scripts allow-same-origin"
                          title="App preview"
                        />
                      ) : (
                        <button
                          onClick={() => setPreviewOpen(true)}
                          className="w-full py-8 text-xs text-zinc-500 hover:text-cyan-400 transition text-center"
                        >
                          Click to load preview
                        </button>
                      )}
                      {/* Code view */}
                      {codeViewFile && msg.appFiles && (
                        <div className="border-t border-zinc-700/60">
                          <div className="flex overflow-x-auto bg-zinc-800/60 px-2 py-1 gap-1">
                            {Object.keys(msg.appFiles).map(f => (
                              <button
                                key={f}
                                onClick={() => setCodeViewFile(f)}
                                className={`text-[10px] px-2 py-0.5 rounded whitespace-nowrap transition ${codeViewFile === f ? 'bg-cyan-500/20 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                              >
                                {f.split('/').pop()}
                              </button>
                            ))}
                          </div>
                          <pre className="p-3 text-[11px] text-zinc-300 font-mono overflow-auto max-h-60 bg-black/40 whitespace-pre-wrap break-all">
                            {msg.appFiles[codeViewFile] ?? ''}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {msg.role === 'assistant' && i > 0 && !streaming && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          const userMsg = [...messages.slice(0, i)].reverse().find(m => m.role === 'user');
                          if (userMsg) handleSaveSkill(i, userMsg.content);
                        }}
                        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition border border-zinc-700/50"
                      >
                        {savedSkillFor === i ? <><Check size={11} className="text-green-400" />Saved</> : <><Zap size={11} />Save as Skill</>}
                      </button>
                      <a href="/skills" className="text-[11px] text-zinc-600 hover:text-zinc-400 transition underline-offset-2 hover:underline">View skills</a>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && <div className="shrink-0 w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-base">👤</div>}
              </div>
            );
          })}
        </div>
        <div ref={messagesEndRef} />
      </div>
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Plan review card */}
          {planReview && !streaming && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-semibold text-xs">{planReview.title}</span>
                <span className="text-zinc-600 text-xs">·</span>
                <span className="text-violet-400/80 text-xs italic">{planReview.strategy}</span>
              </div>
              <ul className="space-y-1 pl-1">
                {planReview.steps.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="text-zinc-600 font-mono">{i + 1}.</span>{s}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    setPlanReview(null);
                    sendMessage(`__APPROVED__:${planReview.originalMessage}`);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold transition"
                >
                  ▶ Build this
                </button>
                <button
                  onClick={() => { setInput(`Change the plan: `); setPlanReview(null); textareaRef.current?.focus(); }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition border border-zinc-700"
                >
                  ✎ Steer
                </button>
                <button onClick={() => setPlanReview(null)} className="ml-auto text-zinc-600 hover:text-zinc-400 text-xs">Dismiss</button>
              </div>
            </div>
          )}
          {/* Clarify question banner */}
          {clarifyQuestion && !streaming && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/30">
              <span className="text-violet-400 text-xs shrink-0 mt-0.5">🤔</span>
              <span className="text-violet-300 text-xs flex-1">{clarifyQuestion}</span>
              <button onClick={() => setClarifyQuestion(null)} className="text-zinc-600 hover:text-zinc-400 text-xs">✕</button>
            </div>
          )}
          {/* Suggestion chips */}
          {suggestions.length > 0 && !streaming && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setSuggestions([]); sendMessage(s); }}
                  className="px-3 py-1.5 rounded-full text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/5 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {/* Build tier + Design mode toggles */}
          {mode !== 'operate' && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center rounded-lg overflow-hidden border border-zinc-700 text-[11px]">
                <button
                  onClick={() => setBuildTier('pro')}
                  className={`px-3 py-1.5 transition font-medium ${buildTier === 'pro' ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                >
                  ⚡ Sonnet
                </button>
                <button
                  onClick={() => setBuildTier('power')}
                  className={`px-3 py-1.5 transition font-medium ${buildTier === 'power' ? 'bg-gradient-to-r from-cyan-600 to-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                >
                  🔥 Opus Power
                </button>
              </div>
              <button
                onClick={() => setDesignMode(d => !d)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition ${designMode ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}
              >
                🎨 Design Mode{designMode ? ' ✓' : ''}
              </button>
              {buildTier === 'power' && <span className="text-[10px] text-cyan-500/70">Claude Opus 4.6 — best code quality</span>}
              {designMode && <span className="text-[10px] text-emerald-500/70">Luxury UI generation</span>}
            </div>
          )}
          {mode === 'operate' && <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-cyan-400 shrink-0" /><input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://example.com — URL to operate (optional)" className="flex-1 rounded-lg bg-zinc-800 border border-cyan-500/30 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50" /></div>}
          <div className="flex items-end gap-3">
            <div className={`shrink-0 self-end mb-0.5 px-2 py-1 rounded-lg border text-[10px] font-medium flex items-center gap-1 ${cfg.accent}`}><ModeIcon className="w-3 h-3" />{cfg.label}</div>
            <textarea ref={textareaRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Ask anything, or say 'build me a…' to start building" rows={1} className={`flex-1 resize-none rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 transition-colors ${cfg.ring}`} style={{ minHeight: '44px', maxHeight: '140px' }} />
            <button onClick={() => sendMessage()} disabled={streaming || operating || !input.trim()} className={`shrink-0 w-10 h-10 rounded-xl ${cfg.btn} disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors`}>{streaming || operating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button>
          </div>
          <p className="text-center text-xs text-zinc-600">⚡ fast answers for questions &nbsp;·&nbsp; 🔨 build mode for code &amp; deploy</p>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen bg-zinc-950"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>}><ChatInner /></Suspense>;
}
