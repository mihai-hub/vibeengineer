'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import AdvisorCards from '../../components/AdvisorCards';

function AdvisorsInner() {
  const router = useRouter();
  const [files, setFiles] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('vibeFiles');
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{ path: string; content: string }>;
        const fileMap: Record<string, string> = {};
        for (const f of parsed) fileMap[f.path] = f.content;
        setFiles(fileMap);
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top bar */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
        >
          ← Back
        </button>
        <div className="text-center">
          <h1 className="text-sm font-semibold text-white">AI Advisors</h1>
          <p className="text-xs text-zinc-500">Your CTO &amp; COO in one place</p>
        </div>
        <span className="text-xs text-zinc-600 font-mono">Claude</span>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <AdvisorCards files={files} />
      </div>
    </div>
  );
}

export default function AdvisorsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 text-sm">
        Loading advisors...
      </div>
    }>
      <AdvisorsInner />
    </Suspense>
  );
}
