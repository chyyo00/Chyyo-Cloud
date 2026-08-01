import { useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { Cpu, MemoryStick, HardDrive, ArrowUpDown } from 'lucide-react';
import { useAgentStats, type StatPoint } from '../hooks/useAgentStats';
import { cn } from '../lib/utils';
import { Skeleton } from './ui/Skeleton';

type Mode = 'cpu' | 'ram' | 'disk' | 'net';

const MODES: { value: Mode; label: string }[] = [
  { value: 'cpu', label: 'CPU' },
  { value: 'ram', label: '메모리' },
  { value: 'disk', label: '디스크' },
  { value: 'net', label: '네트워크' },
];

function mb(v?: number): string {
  if (v === undefined) return '—';
  return v >= 1024 ? `${(v / 1024).toFixed(1)} GB` : `${Math.round(v)} MB`;
}

/** Apple Activity Monitor 스타일의 실시간 시스템 리소스 모니터 */
export function SystemMonitor({ agentId }: { agentId?: string }) {
  const { series, latest } = useAgentStats(agentId);
  const [mode, setMode] = useState<Mode>('cpu');

  const hasData = series.length > 0;

  type MetricConfig = {
    label: string;
    color: string;
    dataKey: keyof StatPoint;
    icon: React.ReactNode;
    value: string;
    sub: string;
  };

  const config: MetricConfig =
    {
      cpu: {
        label: 'CPU',
        color: '#0A84FF',
        dataKey: 'cpuPercent' as const,
        icon: <Cpu className="h-4 w-4" />,
        value: latest ? `${Math.round(latest.cpuPercent ?? 0)}%` : '—',
        sub: '전체 코어 평균',
      },
      ram: {
        label: '메모리',
        color: '#5E5CE6',
        dataKey: 'ramUsedMb' as const,
        icon: <MemoryStick className="h-4 w-4" />,
        value: mb(latest?.ramUsedMb),
        sub: `총 ${mb(latest?.ramTotalMb)}`,
      },
      disk: {
        label: '디스크',
        color: '#30D158',
        dataKey: 'diskUsedMb' as const,
        icon: <HardDrive className="h-4 w-4" />,
        value: mb(latest?.diskUsedMb),
        sub: `총 ${mb(latest?.diskTotalMb)}`,
      },
      net: {
        label: '네트워크',
        color: '#FF9F0A',
        dataKey: 'netDownKbps' as const,
        icon: <ArrowUpDown className="h-4 w-4" />,
        value: latest ? `${Math.round(latest.netDownKbps ?? 0)} Kb/s` : '—',
        sub: `업로드 ${Math.round(latest?.netUpKbps ?? 0)} Kb/s`,
      },
    }[mode];

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] backdrop-blur-xl">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: `${config.color}1a`, color: config.color }}
          >
            {config.icon}
          </span>
          <div>
            <div className="text-sm font-semibold text-white">{config.label}</div>
            <div className="text-[11px] text-zinc-500">시스템 리소스 · 실시간</div>
          </div>
        </div>

        {/* 세그먼트 컨트롤 */}
        <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] p-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200',
                mode === m.value
                  ? 'bg-white/[0.14] text-white shadow-[0_1px_4px_rgba(0,0,0,0.4)]'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 현재 값 */}
      <div className="flex items-baseline gap-2 px-6 pt-4">
        <span className="text-[34px] font-semibold leading-none tracking-tight text-white tabular-nums">
          {config.value}
        </span>
        <span className="text-xs text-zinc-500">{config.sub}</span>
      </div>

      {/* 차트 */}
      <div className="h-44 px-2 pb-2 pt-3">
        {!hasData ? (
          <div className="flex h-full items-center justify-center">
            <Skeleton className="h-28 w-[97%]" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id={`sm-${mode}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={config.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={config.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(24,24,27,0.92)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 14,
                  fontSize: 12,
                  padding: '8px 12px',
                  boxShadow: '0 12px 32px -8px rgba(0,0,0,0.6)',
                }}
                labelFormatter={() => ''}
                formatter={(v: any) => [String(Math.round(Number(v))), config.label]}
                cursor={{ stroke: 'rgba(255,255,255,0.15)' }}
              />
              <Area
                type="monotone"
                dataKey={config.dataKey}
                stroke={config.color}
                strokeWidth={2}
                fill={`url(#sm-${mode})`}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 3.5, fill: config.color, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 푸터 */}
      <div className="flex items-center justify-between border-t border-white/[0.05] px-6 py-3.5">
        <span className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          실시간 갱신 (60초 버퍼)
        </span>
        <span className="text-[11px] text-zinc-600">Chyyo-Agent · 1.0.0</span>
      </div>
    </div>
  );
}
