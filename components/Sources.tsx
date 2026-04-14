'use client';

import { Globe } from 'lucide-react';

export interface Source {
  title: string;
  url: string;
  snippet: string;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function Sources({ sources }: { sources: Source[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mb-4">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <Globe size={12} className="text-zinc-500" />
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">Sources</span>
      </div>

      {/* Source cards — numbered to match inline [1][2][3] citations */}
      <div className="flex flex-wrap gap-2">
        {sources.map((source, i) => (
          <a
            key={i}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-2.5 hover:bg-zinc-700/60 transition-colors cursor-pointer no-underline"
            style={{ minWidth: '180px', maxWidth: '280px', flex: '1 1 180px' }}
          >
            {/* Citation number */}
            <span className="shrink-0 w-5 h-5 rounded bg-zinc-700 text-zinc-300 text-[10px] font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <div className="min-w-0">
              {/* Domain */}
              <p className="text-[10px] text-zinc-500 font-mono mb-0.5 truncate">{getDomain(source.url)}</p>
              {/* Title */}
              <p className="text-xs font-medium text-zinc-200 line-clamp-2 leading-snug">
                {source.title}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
