'use client';

/**
 * components/DiffViewer.tsx — VibeEngineer before/after file diff
 *
 * Line-by-line diff with ±3 context lines, collapsing unchanged sections.
 * No external diff library — pure line comparison.
 */

interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  filename: string;
}

type LineKind = 'added' | 'removed' | 'unchanged';

interface DiffLine {
  kind: LineKind;
  text: string;
  lineNum?: number; // original line number for unchanged
}

/** Compute a simple line diff using LCS (longest common subsequence). */
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText === '' ? [] : oldText.split('\n');
  const newLines = newText === '' ? [] : newText.split('\n');

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i]![j] = (dp[i + 1]?.[j + 1] ?? 0) + 1;
      } else {
        dp[i]![j] = Math.max(dp[i + 1]?.[j] ?? 0, dp[i]?.[j + 1] ?? 0);
      }
    }
  }

  // Trace back
  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < m || j < n) {
    if (i < m && j < n && oldLines[i] === newLines[j]) {
      result.push({ kind: 'unchanged', text: oldLines[i] ?? '', lineNum: i + 1 });
      i++;
      j++;
    } else if (j < n && (i >= m || (dp[i]?.[j + 1] ?? 0) >= (dp[i + 1]?.[j] ?? 0))) {
      result.push({ kind: 'added', text: newLines[j] ?? '' });
      j++;
    } else {
      result.push({ kind: 'removed', text: oldLines[i] ?? '' });
      i++;
    }
  }

  return result;
}

const CONTEXT = 3;

type DisplayRow =
  | { type: 'line'; line: DiffLine; idx: number }
  | { type: 'collapse'; count: number };

/** Collapse long unchanged sections, keeping ±CONTEXT lines around changes. */
function buildDisplayRows(diff: DiffLine[]): DisplayRow[] {
  // Mark which unchanged lines are near a change
  const changedIndexes = new Set<number>();
  for (let i = 0; i < diff.length; i++) {
    if (diff[i]!.kind !== 'unchanged') {
      for (let c = Math.max(0, i - CONTEXT); c <= Math.min(diff.length - 1, i + CONTEXT); c++) {
        changedIndexes.add(c);
      }
    }
  }

  const rows: DisplayRow[] = [];
  let collapseCount = 0;

  for (let i = 0; i < diff.length; i++) {
    const line = diff[i]!;
    if (line.kind === 'unchanged' && !changedIndexes.has(i)) {
      collapseCount++;
    } else {
      if (collapseCount > 0) {
        rows.push({ type: 'collapse', count: collapseCount });
        collapseCount = 0;
      }
      rows.push({ type: 'line', line, idx: i });
    }
  }

  if (collapseCount > 0) {
    rows.push({ type: 'collapse', count: collapseCount });
  }

  return rows;
}

export function DiffViewer({ oldContent, newContent, filename }: DiffViewerProps) {
  const diff = computeDiff(oldContent, newContent);
  const rows = buildDisplayRows(diff);

  const added = diff.filter(l => l.kind === 'added').length;
  const removed = diff.filter(l => l.kind === 'removed').length;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-zinc-300 text-xs font-mono truncate max-w-xs">{filename}</span>
        <div className="flex items-center gap-3 flex-shrink-0">
          {added > 0 && (
            <span className="text-emerald-400 text-xs font-mono">+{added}</span>
          )}
          {removed > 0 && (
            <span className="text-red-400 text-xs font-mono">-{removed}</span>
          )}
          {added === 0 && removed === 0 && (
            <span className="text-zinc-500 text-xs">no changes</span>
          )}
        </div>
      </div>

      {/* Diff lines */}
      <div className="max-h-[300px] overflow-y-auto font-mono text-xs">
        {rows.map((row, idx) => {
          if (row.type === 'collapse') {
            return (
              <div key={`collapse-${idx}`} className="px-3 py-0.5 text-zinc-600 bg-zinc-950/40 select-none">
                ... {row.count} line{row.count !== 1 ? 's' : ''} ...
              </div>
            );
          }

          const { line } = row;

          if (line.kind === 'added') {
            return (
              <div
                key={`line-${idx}`}
                className="flex items-start bg-emerald-950/30 border-l-2 border-emerald-500 px-2 py-px"
              >
                <span className="text-emerald-500 w-4 flex-shrink-0 select-none">+</span>
                <span className="text-emerald-200 whitespace-pre break-all">{line.text}</span>
              </div>
            );
          }

          if (line.kind === 'removed') {
            return (
              <div
                key={`line-${idx}`}
                className="flex items-start bg-red-950/30 border-l-2 border-red-500 px-2 py-px"
              >
                <span className="text-red-500 w-4 flex-shrink-0 select-none">-</span>
                <span className="text-red-200 whitespace-pre break-all line-through decoration-red-800">
                  {line.text}
                </span>
              </div>
            );
          }

          // unchanged
          return (
            <div
              key={`line-${idx}`}
              className="flex items-start border-l-2 border-transparent px-2 py-px"
            >
              <span className="text-zinc-700 w-4 flex-shrink-0 select-none"> </span>
              <span className="text-zinc-500 whitespace-pre break-all">{line.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
