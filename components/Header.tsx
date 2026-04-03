'use client';

export default function Header() {
  return (
    <header className="w-full border-b border-violet-500/20 bg-[#0a0a0f]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-violet-400 font-bold text-lg hover:text-violet-300 transition-colors">
          ⚡ VibeEngineer
        </a>
        <div className="flex items-center gap-4">
          <a href="/builder" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Builder</a>
          <span className="text-xs px-2 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300">
            Powered by Claude
          </span>
        </div>
      </div>
    </header>
  );
}
