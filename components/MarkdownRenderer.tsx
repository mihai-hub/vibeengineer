import React from 'react';

interface Props {
  content: string;
  className?: string;
}

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold**, `code`
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[0].startsWith('**')) {
      parts.push(<strong key={match.index} className="font-semibold text-white">{match[2]}</strong>);
    } else if (match[0].startsWith('`')) {
      parts.push(
        <code key={match.index} className="rounded bg-violet-900/40 px-1.5 py-0.5 font-mono text-xs text-violet-300">
          {match[3]}
        </code>
      );
    } else if (match[0].startsWith('[')) {
      parts.push(
        <a key={match.index} href={match[5]} target="_blank" rel="noopener noreferrer"
          className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300">
          {match[4]}
        </a>
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function MarkdownRenderer({ content, className = '' }: Props) {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let listItems: React.ReactNode[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      nodes.push(
        <ul key={`ul-${listKey++}`} className="my-2 ml-4 space-y-1 list-disc list-outside text-zinc-300">
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // H1
    if (/^# (.+)/.test(line)) {
      flushList();
      const text = line.replace(/^# /, '');
      nodes.push(
        <h1 key={i} className="mt-6 mb-3 text-2xl font-bold text-white">
          {parseInline(text)}
        </h1>
      );
    }
    // H2
    else if (/^## (.+)/.test(line)) {
      flushList();
      const text = line.replace(/^## /, '');
      nodes.push(
        <h2 key={i} className="mt-5 mb-2 text-lg font-bold text-violet-300 border-b border-violet-500/20 pb-1">
          {parseInline(text)}
        </h2>
      );
    }
    // H3
    else if (/^### (.+)/.test(line)) {
      flushList();
      const text = line.replace(/^### /, '');
      nodes.push(
        <h3 key={i} className="mt-4 mb-1.5 text-base font-semibold text-violet-200">
          {parseInline(text)}
        </h3>
      );
    }
    // H4
    else if (/^#### (.+)/.test(line)) {
      flushList();
      const text = line.replace(/^#### /, '');
      nodes.push(
        <h4 key={i} className="mt-3 mb-1 text-sm font-semibold text-zinc-200">
          {parseInline(text)}
        </h4>
      );
    }
    // Horizontal rule
    else if (/^---+$/.test(line.trim())) {
      flushList();
      nodes.push(<hr key={i} className="my-4 border-violet-500/20" />);
    }
    // Bullet list item (- or *)
    else if (/^[\-\*] (.+)/.test(line)) {
      const text = line.replace(/^[\-\*] /, '');
      listItems.push(
        <li key={i} className="text-sm leading-relaxed">
          {parseInline(text)}
        </li>
      );
    }
    // Numbered list
    else if (/^\d+\. (.+)/.test(line)) {
      flushList();
      const text = line.replace(/^\d+\. /, '');
      nodes.push(
        <div key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-300 my-0.5">
          <span className="text-violet-400 font-mono text-xs mt-0.5 shrink-0">{line.match(/^(\d+)\./)?.[1]}.</span>
          <span>{parseInline(text)}</span>
        </div>
      );
    }
    // Blockquote
    else if (/^> (.+)/.test(line)) {
      flushList();
      const text = line.replace(/^> /, '');
      nodes.push(
        <blockquote key={i} className="my-2 border-l-2 border-violet-500 pl-4 text-sm italic text-zinc-400">
          {parseInline(text)}
        </blockquote>
      );
    }
    // Empty line
    else if (line.trim() === '') {
      flushList();
      nodes.push(<div key={i} className="h-2" />);
    }
    // Regular paragraph
    else {
      flushList();
      nodes.push(
        <p key={i} className="my-1 text-sm leading-relaxed text-zinc-300">
          {parseInline(line)}
        </p>
      );
    }

    i++;
  }

  flushList();

  return <div className={`prose-invert ${className}`}>{nodes}</div>;
}
