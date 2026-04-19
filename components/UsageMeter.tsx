'use client';

export interface UsageMeterProps {
  used: number;
  limit: number | null; // null = unlimited
  tier: string;
  onUpgrade?: () => void;
}

const TIER_BADGE: Record<string, string> = {
  free: 'bg-zinc-700 text-zinc-300',
  pro: 'bg-violet-600/30 border border-violet-500/40 text-violet-300',
  power:
    'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 text-cyan-300',
  payg: 'bg-zinc-700 text-zinc-300',
  owner: 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 text-cyan-300',
};

export default function UsageMeter({ used, limit, tier, onUpgrade }: UsageMeterProps) {
  const isUnlimited = limit === null;
  const pct = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const nearLimit = !isUnlimited && used >= limit * 0.8;
  const atLimit = !isUnlimited && used >= limit;

  const barColor = atLimit
    ? 'bg-red-500'
    : nearLimit
    ? 'bg-orange-400'
    : 'bg-cyan-500';

  const textColor = atLimit
    ? 'text-red-400'
    : nearLimit
    ? 'text-orange-400'
    : 'text-zinc-400';

  const badgeClass = TIER_BADGE[tier] ?? TIER_BADGE['free'];

  return (
    <div className="flex items-center gap-2">
      {/* Tier badge */}
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </span>

      {/* Progress bar + label */}
      <div className="flex flex-col gap-0.5 min-w-[90px]">
        {!isUnlimited && (
          <div className="h-1 rounded-full bg-zinc-800 overflow-hidden w-full">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <span className={`text-[10px] leading-none ${textColor}`}>
          {isUnlimited ? 'Unlimited builds' : `${used} / ${limit} builds`}
        </span>
      </div>

      {/* Upgrade button shown when at limit */}
      {atLimit && onUpgrade && (
        <button
          onClick={onUpgrade}
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition"
        >
          Upgrade
        </button>
      )}
    </div>
  );
}
