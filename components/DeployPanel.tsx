'use client';

/**
 * components/DeployPanel.tsx — VibeEngineer deploy controls
 *
 * Deploy to Vercel, GitHub, or Railway.
 * ZIP download. Status indicators.
 */

import { useState } from 'react';

interface DeployPanelProps {
  files: Record<string, string>;
  projectName: string;
  onDeploy: (target: 'vercel' | 'railway' | 'github') => void;
  deployStatus?: {
    target: string;
    status: 'deploying' | 'ready' | 'error';
    url?: string;
  };
}

function Spinner() {
  return (
    <svg
      className="animate-spin w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

function StatusBadge({
  target,
  deployStatus,
}: {
  target: string;
  deployStatus?: DeployPanelProps['deployStatus'];
}) {
  if (!deployStatus || deployStatus.target !== target) return null;

  if (deployStatus.status === 'deploying') {
    return <Spinner />;
  }

  if (deployStatus.status === 'ready') {
    return <span className="text-emerald-400 text-sm leading-none">\u2713</span>;
  }

  if (deployStatus.status === 'error') {
    return <span className="text-red-400 text-sm leading-none">\u00D7</span>;
  }

  return null;
}

export function DeployPanel({ files, projectName, onDeploy, deployStatus }: DeployPanelProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, projectName }),
      });

      if (!res.ok) {
        console.error('Download failed:', res.statusText);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/\s+/g, '-').toLowerCase()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const vercelReady = deployStatus?.target === 'vercel' && deployStatus.status === 'ready';
  const railwayReady = deployStatus?.target === 'railway' && deployStatus.status === 'ready';
  const githubReady = deployStatus?.target === 'github' && deployStatus.status === 'ready';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <span className="text-zinc-300 text-xs font-semibold tracking-wide uppercase">Deploy</span>
        <span className="text-zinc-600 text-xs font-mono truncate">{projectName}</span>
      </div>

      <div className="p-3 space-y-2">
        {/* Vercel */}
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-black border border-zinc-700 text-white text-xs font-semibold hover:bg-zinc-900 transition-colors disabled:opacity-50"
            onClick={() => onDeploy('vercel')}
            disabled={deployStatus?.target === 'vercel' && deployStatus.status === 'deploying'}
          >
            <span className="font-mono text-sm leading-none">\u25B2</span>
            <span>Vercel</span>
          </button>
          <div className="flex items-center gap-1.5">
            <StatusBadge target="vercel" deployStatus={deployStatus} />
            {vercelReady && deployStatus?.url && (
              <a
                href={deployStatus.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 text-xs hover:underline font-mono truncate max-w-[160px]"
              >
                {deployStatus.url}
              </a>
            )}
          </div>
        </div>

        {/* GitHub */}
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold hover:bg-zinc-700 transition-colors disabled:opacity-50"
            onClick={() => onDeploy('github')}
            disabled={deployStatus?.target === 'github' && deployStatus.status === 'deploying'}
          >
            <span className="text-sm leading-none">\uD83D\uDC19</span>
            <span>GitHub</span>
          </button>
          <div className="flex items-center gap-1.5">
            <StatusBadge target="github" deployStatus={deployStatus} />
            {githubReady && deployStatus?.url && (
              <a
                href={deployStatus.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 text-xs hover:underline font-mono truncate max-w-[160px]"
              >
                {deployStatus.url}
              </a>
            )}
          </div>
        </div>

        {/* Railway */}
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-purple-900/60 border border-purple-700/60 text-purple-200 text-xs font-semibold hover:bg-purple-800/60 transition-colors disabled:opacity-50"
            onClick={() => onDeploy('railway')}
            disabled={deployStatus?.target === 'railway' && deployStatus.status === 'deploying'}
          >
            <span className="text-sm leading-none">\uD83D\uDE82</span>
            <span>Railway</span>
          </button>
          <div className="flex items-center gap-1.5">
            <StatusBadge target="railway" deployStatus={deployStatus} />
            {railwayReady && deployStatus?.url && (
              <a
                href={deployStatus.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 text-xs hover:underline font-mono truncate max-w-[160px]"
              >
                {deployStatus.url}
              </a>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800 pt-2 mt-2">
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800/60 border border-zinc-700/60 text-zinc-300 text-xs font-medium hover:bg-zinc-700/60 transition-colors disabled:opacity-50 w-full justify-center"
            onClick={handleDownload}
            disabled={downloading || Object.keys(files).length === 0}
          >
            {downloading ? (
              <>
                <Spinner />
                <span>Preparing ZIP\u2026</span>
              </>
            ) : (
              <>
                <span>\uD83D\uDCE6</span>
                <span>Download ZIP</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
