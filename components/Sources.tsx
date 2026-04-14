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

      {/* Source cards */}
      <div className="flex flex-wrap gap-2">
        {sources.map((source, i) => (
          <a
            key={i}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3 hover:bg-zinc-700/60 transition-colors cursor-pointer no-underline"
            style={{ minWidth: '180px', maxWidth: '280px', flex: '1 1 180px' }}
          >
            {/* Domain badge */}
            <div className="mb-1.5">
              <span className="text-[10px] text-zinc-400 bg-zinc-700/50 rounded px-1.5 py-0.5 font-mono">
                {getDomain(source.url)}
              </span>
            </div>

            {/* Title */}
            <p className="text-sm font-medium text-zinc-200 line-clamp-2 leading-snug mb-1">
              {source.title}
            </p>

            {/* Snippet */}
            {source.snippet && (
              <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                {source.snippet}
              </p>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
