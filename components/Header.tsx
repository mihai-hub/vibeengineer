'use client';

export default function Header() {
  return (
    <header className="w-full border-b border-violet-500/20 bg-[#0a0a0f]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-violet-400 font-bold text-lg hover:text-violet-300 transition-colors">
          ⚡ VibeEngineer
        </a>

        {/* Centre — AI COO status */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="text-sm font-medium text-violet-400">Your AI COO is ready</span>
        </div>

        <nav className="flex items-center gap-4">
          <a href="/" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Home</a>
          <a href="/chat" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Chat</a>
          <a href="/pricing" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Pricing</a>
          <a href="/dashboard" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Dashboard</a>
          <a
            href="/auth"
            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all hover:brightness-110"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.30)', color: '#a78bfa' }}
          >
            Sign in
          </a>
        </nav>
      </div>
    </header>
  );
}
