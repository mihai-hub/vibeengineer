'use client';

/**
 * components/StepCard.tsx — VibeEngineer build-lane step display
 *
 * Renders Jeff's agentic steps inline, Claude Code style:
 *   ● Thought for 4s ▸          (collapsible, shows thinking content)
 *   ● Update Todos               (plan with inline checklist)
 *   ● Read  db_watcher.py        (tool call row)
 *   ● Inferring…                 (live status while running)
 *
 * Lane badge: ⚡ Fast answer | 🔨 Building…
 */

import { useState } from 'react';

export type StepType =
  | 'thinking'
  | 'plan'
  | 'tool_call'
  | 'tool_result'
  | 'agent_start'
  | 'agent_done'
  | 'security';

export interface AgentStep {
  id: string;
  type: StepType;
  label: string;
  detail?: string;
  status: 'running' | 'done' | 'error';
  durationMs?: number;
  step?: number;
  planItems?: string[];
}

interface Props {
  steps: AgentStep[];
  isRunning: boolean;
  lane?: 'fast' | 'build';
}

const TOOL_VERB: Record<string, string> = {
  run_command:        'Bash',
  read_file:          'Read',
  write_file:         'Write',
  edit_file:          'Edit',
  create_file:        'Write',
  delete_file:        'Delete',
  list_files:         'List',
  web_search:         'Search',
  http_request:       'Fetch',
  delegate_to_claude: 'Delegate',
  computer_use:       'Computer',
  mcp_call:           'MCP',
  find_files:         'Glob',
  read_dashboard:     'Dashboard',
  take_screenshot:    'Screenshot',
};

function getVerb(label: string): { verb: string; rest: string } {
  // Use [\s\S]* instead of .* with /s flag (ES2017 compatible)
  const toolMatch = label.match(/^([a-z_]+)\(([\s\S]*)$/);
  if (toolMatch) {
    const tool = toolMatch[1] ?? '';
    const args = (toolMatch[2] ?? '').replace(/\)$/, '').trim();
    const verb = TOOL_VERB[tool] ?? tool;
    const fileName = args.split('/').pop()?.replace(/["']/g, '') ?? args;
    return { verb, rest: fileName.slice(0, 60) };
  }
  return { verb: label, rest: '' };
}

function DotIndicator({ status }: { status: AgentStep['status'] }) {
  if (status === 'running') {
    return (
      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse flex-shrink-0 mt-0.5" />
    );
  }
  if (status === 'error') {
    return <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-0.5" />;
  }
  return <span className="w-2 h-2 rounded-full bg-gray-600 flex-shrink-0 mt-0.5" />;
}

function ThinkingStep({ step }: { step: AgentStep }) {
  const [open, setOpen] = useState(false);
  const dur =
    step.durationMs != null
      ? step.durationMs < 1000
        ? `${step.durationMs}ms`
        : `${(step.durationMs / 1000).toFixed(0)}s`
      : null;

  return (
    <div>
      <button
        className="flex items-start gap-2 w-full text-left hover:opacity-80 transition-opacity"
        onClick={() => step.detail && setOpen(o => !o)}
      >
        <DotIndicator status={step.status} />
        <span className="text-gray-400 text-xs">
          {dur ? `Thought for ${dur}` : 'Thinking\u2026'}
        </span>
        {step.detail && (
          <span className="text-gray-600 text-xs ml-0.5">{open ? '\u25be' : '\u25b8'}</span>
        )}
      </button>
      {open && step.detail && (
        <div className="ml-4 mt-1 mb-1">
          <pre className="text-gray-500 text-xs bg-black/30 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40 border border-gray-800/60">
            {step.detail}
          </pre>
        </div>
      )}
    </div>
  );
}

function PlanStep({ step, allSteps }: { step: AgentStep; allSteps?: AgentStep[] }) {
  const items = step.planItems ?? [];
  // Count how many build steps are done to animate checklist ticking off
  const doneCount = allSteps
    ? allSteps.filter(s => s.type === 'tool_result' && s.status === 'done').length
    : 0;

  return (
    <div className="my-1 rounded-lg border border-gray-800/60 bg-black/20 p-2.5">
      <div className="flex items-center gap-2 mb-2">
        <DotIndicator status={step.status} />
        <span className="text-cyan-400 text-xs font-semibold tracking-wide uppercase">{step.label}</span>
        {step.status === 'running' && (
          <span className="ml-auto text-gray-600 text-xs animate-pulse">planning…</span>
        )}
      </div>
      {items.length > 0 && (
        <ul className="space-y-1 pl-4">
          {items.map((item, i) => {
            const isDone = step.status === 'done' || i < doneCount;
            const isStrategy = item.startsWith('Strategy:');
            return (
              <li key={i} className="flex items-start gap-2 text-xs">
                {isStrategy ? (
                  <span className="text-violet-400/80 italic">{item.replace('Strategy: ', '')}</span>
                ) : (
                  <>
                    <span className={`flex-shrink-0 mt-0.5 font-mono ${isDone ? 'text-green-500' : 'text-gray-600'}`}>
                      {isDone ? '\u2713' : '\u25a1'}
                    </span>
                    <span className={isDone ? 'text-gray-400 line-through decoration-gray-600' : 'text-gray-400'}>
                      {item}
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ToolStep({ step }: { step: AgentStep }) {
  const [open, setOpen] = useState(false);
  const { verb, rest } = getVerb(step.label);
  const dur =
    step.durationMs != null
      ? step.durationMs < 1000
        ? `${step.durationMs}ms`
        : `${(step.durationMs / 1000).toFixed(1)}s`
      : null;

  return (
    <div>
      <button
        className="flex items-start gap-2 w-full text-left hover:opacity-80 transition-opacity group"
        onClick={() => step.detail && setOpen(o => !o)}
      >
        <DotIndicator status={step.status} />
        <span className="text-gray-300 text-xs font-semibold min-w-[52px]">{verb}</span>
        {rest && (
          <span className="text-gray-500 text-xs font-mono truncate max-w-xs">{rest}</span>
        )}
        {dur && step.status === 'done' && (
          <span className="text-gray-700 text-xs ml-auto flex-shrink-0">{dur}</span>
        )}
        {step.detail && (
          <span className="text-gray-700 text-xs ml-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {open ? '\u25be' : '\u25b8'}
          </span>
        )}
      </button>
      {open && step.detail && (
        <div className="ml-4 mt-1 mb-1">
          <pre className="text-gray-400 text-xs bg-black/30 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40 border border-gray-800/60">
            {step.detail}
          </pre>
        </div>
      )}
    </div>
  );
}

export function StepCard({ steps, isRunning, lane }: Props) {
  const laneBadge =
    lane === 'fast' ? (
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-yellow-400 text-xs">{'\u26a1'}</span>
        <span className="text-yellow-400/70 text-xs">Fast answer</span>
      </div>
    ) : lane === 'build' ? (
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-cyan-400 text-xs">{'\ud83d\udd28'}</span>
        <span className="text-cyan-400/70 text-xs">Building\u2026</span>
      </div>
    ) : null;

  if (steps.length === 0 && !lane) return null;

  return (
    <div className="mb-3 space-y-1.5">
      {laneBadge}
      {steps.map(step => {
        if (step.type === 'thinking') return <ThinkingStep key={step.id} step={step} />;
        if (step.type === 'plan') return <PlanStep key={step.id} step={step} allSteps={steps} />;
        if (step.type === 'agent_start') {
          return (
            <div key={step.id} className="flex items-center gap-2">
              <DotIndicator status={step.status} />
              <span className="text-violet-400 text-xs">{step.label}</span>
            </div>
          );
        }
        if (step.type === 'agent_done') {
          return (
            <div key={step.id} className="flex items-center gap-2">
              <DotIndicator status="done" />
              <span className="text-green-400 text-xs">{step.label}</span>
            </div>
          );
        }
        return <ToolStep key={step.id} step={step} />;
      })}

      {isRunning && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
          <span className="text-gray-500 text-xs">Inferring\u2026</span>
        </div>
      )}
    </div>
  );
}

// Compatibility alias for existing imports
export { StepCard as AgentStepCard };
