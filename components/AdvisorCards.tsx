'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AdvisorConfig {
  id: string;
  emoji: string;
  name: string;
  title: string;
  opening: string;
  systemHint: 'cto' | 'coo';
}

const ADVISORS: AdvisorConfig[] = [
  {
    id: 'cto',
    emoji: '🔧',
    name: 'Alex Chen',
    title: 'CTO Advisor',
    systemHint: 'cto',
    opening: "Hi! I'm Alex, your CTO Advisor. Tell me about your technical architecture — what stack are you using and what's your biggest engineering challenge?",
  },
  {
    id: 'coo',
    emoji: '📈',
    name: 'Sara Kim',
    title: 'COO Advisor',
    systemHint: 'coo',
    opening: "Hi! I'm Sara, your COO Advisor. Tell me about your product — what are you building, who's it for, and where are you in the journey?",
  },
];

interface AdvisorCardProps {
  advisor: AdvisorConfig;
  files: Record<string, string>;
}

function AdvisorCard({ advisor, files }: AdvisorCardProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: advisor.opening },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { role: 'assistant', content: '' }]);
    setStreaming(true);
    try {
      abortRef.current = new AbortController();
      const res = await fetch('/api/coo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, files, advisorRole: advisor.systemHint }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error(`API error ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let content = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const token = line.slice(6);
          if (token === '[DONE]') break;
          content += token;
          setMessages([...newMessages, { role: 'assistant', content }]);
        }
      }
      setMessages([...newMessages, { role: 'assistant', content }]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ ${msg}` }]);
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, messages, files, advisor.systemHint]);

  return (
    <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden min-w-0">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center select-none shrink-0">
            {advisor.emoji}
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">{advisor.name}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{advisor.title}</p>
          </div>
        </div>
        <div className="relative flex items-center justify-center">
          <div className={`w-2 h-2 rounded-full transition-colors ${streaming ? 'bg-green-400' : 'bg-zinc-600'}`} />
          {streaming && <div className="absolute w-2 h-2 rounded-full bg-green-400 animate-ping opacity-75" />}
        </div>
      </div>

      {/* Chat history */}
      <div className="overflow-y-auto max-h-72 min-h-[18rem] px-4 py-3 space-y-3">
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const isStreamingBubble = streaming && i === messages.length - 1 && !isUser;
          return (
            <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 text-xs leading-relaxed rounded-2xl ${isUser ? 'bg-violet-600 text-white rounded-tr-sm' : 'bg-zinc-800 text-zinc-100 rounded-tl-sm'}`}>
                {msg.content}
                {isStreamingBubble && <span className="inline-block w-0.5 h-3 bg-violet-400 ml-0.5 animate-pulse align-text-bottom" />}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input row */}
      <div className="shrink-0 border-t border-zinc-800 px-4 py-3 flex items-center gap-2 bg-zinc-950/40">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } }}
          placeholder={`Ask ${advisor.name.split(' ')[0]}...`}
          disabled={streaming}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 disabled:opacity-50 transition-colors"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || streaming}
          className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-40 flex items-center gap-1.5 shrink-0"
        >
          <Send size={12} />
          Send
        </button>
      </div>
    </div>
  );
}

export interface AdvisorCardsProps {
  files?: Record<string, string>;
}

export default function AdvisorCards({ files = {} }: AdvisorCardsProps) {
  return (
    <div className="flex flex-col md:flex-row gap-6 w-full">
      {ADVISORS.map(advisor => (
        <AdvisorCard key={advisor.id} advisor={advisor} files={files} />
      ))}
    </div>
  );
}
