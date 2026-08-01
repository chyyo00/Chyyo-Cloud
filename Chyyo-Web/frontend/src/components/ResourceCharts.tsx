import { Area, AreaChart, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { Cpu, MemoryStick, HardDrive, ArrowUpDown } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { Skeleton } from './ui/Skeleton';
import { useAgentStats, type StatPoint } from '../hooks/useAgentStats';
import { cn } from '../lib/utils';

export function ResourceCharts({ agentId }: { agentId?: string }) {
  const { series, latest } = useAgentStats(agentId);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChartCard
        title="CPU"
        icon={<Cpu className="h-3.5 w-3.5" />}
        value={latest?.cpuPercent}
        unit="%"
        color="#0A84FF"
        series={series}
        dataKey="cpuPercent"
      />
      <ChartCard
        title="메모리"
        icon={<MemoryStick className="h-3.5 w-3.5" />}
        value={latest?.ramUsedMb}
        unit={`MB / ${latest?.ramTotalMb ?? 0}MB`}
        color="#5E5CE6"
        series={series}
        dataKey="ramUsedMb"
      />
      <ChartCard
        title="디스크"
        icon={<HardDrive className="h-3.5 w-3.5" />}
        value={latest?.diskUsedMb}
        unit={`MB / ${latest?.diskTotalMb ?? 0}MB`}
        color="#30D158"
        series={series}
        dataKey="diskUsedMb"
      />
      <ChartCard
        title="네트워크"
        icon={<ArrowUpDown className="h-3.5 w-3.5" />}
        value={latest ? (latest.netDownKbps ?? 0) : undefined}
        unit="Kbps ↓"
        color="#FF9F0A"
        series={series}
        dataKey="netDownKbps"
      />
    </div>
  );
}

function ChartCard({
  title,
  icon,
  value,
  unit,
  color,
  series,
  dataKey,
}: {
  title: string;
  icon: React.ReactNode;
  value?: number;
  unit: string;
  color: string;
  series: StatPoint[];
  dataKey: keyof StatPoint;
}) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-400">
          {icon}
          {title}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold text-white tabular-nums">
            {value !== undefined ? Math.round(value).toLocaleString() : '—'}
          </span>
          <span className="text-xs text-zinc-500">{unit}</span>
        </div>
      </div>
      <div className="mt-3 h-24">
        {series.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{
                  background: '#17171d',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelFormatter={() => ''}
                formatter={(v: any) => [String(Math.round(Number(v))), title]}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${dataKey})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className={cn('mt-2 flex items-center gap-1.5')}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        <span className="text-[11px] text-zinc-500">실시간 (60초)</span>
      </div>
    </GlassCard>
  );
}
