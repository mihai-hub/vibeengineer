'use client';

/**
 * components/FileTree.tsx — VibeEngineer generated-file explorer
 *
 * Shows a grouped file tree with folder/file icons, active-file highlight,
 * file-size badges, and a click handler for the code viewer.
 */

interface FileTreeProps {
  files: Record<string, string>; // path -> content
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  title?: string;
}

function getFileIcon(filename: string): string {
  const base = filename.split('/').pop() ?? filename;
  if (base === 'package.json' || base === 'package-lock.json') return '\u{1F4E6}';
  if (
    base === 'tsconfig.json' ||
    base === 'next.config.ts' ||
    base === 'next.config.js' ||
    base === '.eslintrc.json' ||
    base === 'eslint.config.mjs' ||
    base === 'tailwind.config.ts' ||
    base === 'tailwind.config.js' ||
    base === 'postcss.config.mjs' ||
    base === 'postcss.config.js' ||
    base === '.env' ||
    base === '.env.local' ||
    base === 'Dockerfile' ||
    base === 'docker-compose.yml' ||
    base.endsWith('.config.ts') ||
    base.endsWith('.config.js')
  )
    return '\u2699\uFE0F';
  if (base.endsWith('.css') || base.endsWith('.scss') || base.endsWith('.sass')) return '\uD83C\uDFA8';
  if (base.endsWith('.ts') || base.endsWith('.tsx') || base.endsWith('.js') || base.endsWith('.jsx'))
    return '\uD83D\uDCC4';
  if (base.endsWith('.md') || base.endsWith('.mdx')) return '\uD83D\uDCDD';
  if (base.endsWith('.json')) return '\uD83D\uDCC4';
  if (base.endsWith('.svg') || base.endsWith('.png') || base.endsWith('.jpg') || base.endsWith('.webp'))
    return '\uD83D\uDDBC\uFE0F';
  return '\uD83D\uDCC4';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

interface TreeNode {
  type: 'file' | 'dir';
  name: string;
  fullPath?: string;
  children?: Record<string, TreeNode>;
  content?: string;
}

function buildTree(files: Record<string, string>): Record<string, TreeNode> {
  const root: Record<string, TreeNode> = {};

  for (const [path, content] of Object.entries(files)) {
    const parts = path.replace(/^\//, '').split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] ?? '';
      const isLast = i === parts.length - 1;

      if (isLast) {
        current[part] = { type: 'file', name: part, fullPath: path, content };
      } else {
        if (!current[part]) {
          current[part] = { type: 'dir', name: part, children: {} };
        }
        current = current[part]!.children!;
      }
    }
  }

  return root;
}

function TreeNodeRow({
  node,
  depth,
  activeFile,
  onFileSelect,
}: {
  node: TreeNode;
  depth: number;
  activeFile: string | null;
  onFileSelect: (path: string) => void;
}) {
  const isActive = node.type === 'file' && node.fullPath === activeFile;
  const indent = depth * 12;

  if (node.type === 'dir') {
    return (
      <div>
        <div
          className="flex items-center gap-1.5 py-0.5 px-2 text-zinc-400 text-xs select-none"
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          <span className="flex-shrink-0">\uD83D\uDCC1</span>
          <span className="font-medium text-zinc-300">{node.name}</span>
        </div>
        {node.children &&
          Object.entries(node.children)
            .sort(([, a], [, b]) => {
              if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map(([key, child]) => (
              <TreeNodeRow
                key={key}
                node={child}
                depth={depth + 1}
                activeFile={activeFile}
                onFileSelect={onFileSelect}
              />
            ))}
      </div>
    );
  }

  const sizeBytes = new TextEncoder().encode(node.content ?? '').length;

  return (
    <button
      className={`flex items-center gap-1.5 py-0.5 px-2 w-full text-left transition-colors hover:bg-zinc-800/60 ${
        isActive ? 'bg-cyan-950/40 border-l-2 border-cyan-500' : 'border-l-2 border-transparent'
      }`}
      style={{ paddingLeft: `${8 + indent}px` }}
      onClick={() => node.fullPath && onFileSelect(node.fullPath)}
    >
      <span className="flex-shrink-0 text-xs">{getFileIcon(node.name)}</span>
      <span
        className={`text-xs font-mono flex-1 truncate ${
          isActive ? 'text-cyan-300' : 'text-zinc-300'
        }`}
      >
        {node.name}
      </span>
      <span className="text-zinc-600 text-xs flex-shrink-0">{formatBytes(sizeBytes)}</span>
    </button>
  );
}

export function FileTree({ files, activeFile, onFileSelect, title = 'Files' }: FileTreeProps) {
  const fileCount = Object.keys(files).length;
  const tree = buildTree(files);

  const sorted = Object.entries(tree).sort(([, a], [, b]) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-zinc-300 text-xs font-semibold tracking-wide uppercase">{title}</span>
        <span className="bg-zinc-800 text-zinc-400 text-xs px-1.5 py-0.5 rounded-full font-mono">
          {fileCount}
        </span>
      </div>

      {/* Tree */}
      <div className="max-h-[400px] overflow-y-auto py-1">
        {fileCount === 0 ? (
          <div className="px-3 py-4 text-zinc-600 text-xs text-center">No files yet</div>
        ) : (
          sorted.map(([key, node]) => (
            <TreeNodeRow
              key={key}
              node={node}
              depth={0}
              activeFile={activeFile}
              onFileSelect={onFileSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
