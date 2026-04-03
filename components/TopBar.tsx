'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, Zap } from 'lucide-react';

export default function TopBar() {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 sm:px-6">

        {/* Left — Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/8 hover:text-white active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        {/* Centre — VibeEngineer logo */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 select-none">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
            <Zap className="h-4 w-4 text-white" fill="currentColor" />
          </div>
          <span className="text-base font-bold tracking-tight text-white">
            Vibe<span className="text-violet-400">Engineer</span>
          </span>
        </div>

        {/* Right — Powered by Claude badge */}
        <a
          href="https://www.anthropic.com/claude"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full border border-[#D97757]/40 bg-[#D97757]/10 px-3 py-1 text-xs font-semibold text-[#e89070] transition-colors hover:bg-[#D97757]/20"
        >
          {/* Anthropic / Claude icon */}
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 fill-current"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-3.654 0H6.57L0 20h3.603l6.57-16.48z" />
          </svg>
          Powered by Claude
        </a>

      </div>
    </header>
  );
}
