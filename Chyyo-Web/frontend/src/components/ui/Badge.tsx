import { cn } from '../../lib/utils';

type BadgeTone = 'green' | 'red' | 'blue' | 'amber' | 'zinc';

const tones: Record<BadgeTone, string> = {
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  red: 'bg-red-500/15 text-red-300 border-red-500/25',
  blue: 'bg-accent/15 text-accent-soft border-accent/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  zinc: 'bg-white/[0.06] text-zinc-400 border-white/10',
};

export function Badge({
  tone = 'zinc',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ state }: { state: string }) {
  const color =
    state === 'ONLINE'
      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
      : state === 'STARTING' || state === 'STOPPING'
        ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
        : 'bg-zinc-500';
  return (
    <span className="relative flex h-2.5 w-2.5">
      {(state === 'STARTING' || state === 'STOPPING') && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-60`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  );
}

export function stateLabel(state: string): string {
  const map: Record<string, string> = {
    ONLINE: '실행 중',
    STARTING: '시작 중',
    STOPPING: '종료 중',
    OFFLINE: '중지됨',
    CRASHED: '오류',
  };
  return map[state] ?? state;
}

export function stateTone(state: string): BadgeTone {
  const map: Record<string, BadgeTone> = {
    ONLINE: 'green',
    STARTING: 'amber',
    STOPPING: 'amber',
    OFFLINE: 'zinc',
    CRASHED: 'red',
  };
  return map[state] ?? 'zinc';
}
