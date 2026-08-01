import { useState } from 'react';
import { Play, Square, RotateCw, Users, Clock, Box } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassCard } from './ui/GlassCard';
import { Badge, StatusDot, stateLabel, stateTone } from './ui/Badge';
import { Button } from './ui/Button';
import { Skeleton } from './ui/Skeleton';
import { useToast } from './ui/Toast';
import { formatDuration } from '../lib/utils';
import type { Server } from '../lib/api';

interface Props {
  server: Server;
  online: boolean;
  onOpen: () => void;
  onControl: (action: 'start' | 'stop' | 'restart') => Promise<{ ok: boolean; error?: string }>;
}

export function ServerCard({ server, online, onOpen, onControl }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const control = async (action: 'start' | 'stop' | 'restart') => {
    setBusy(true);
    const res = await onControl(action);
    setBusy(false);
    if (!res.ok) toast('error', res.error ?? '요청 실패');
  };

  if (!online) {
    return (
      <GlassCard className="flex items-center justify-between p-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-9 w-24 rounded-2xl" />
      </GlassCard>
    );
  }

  return (
    <GlassCard hover className="p-5" onClick={onOpen}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
            <Box className="h-5 w-5 text-accent-soft" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{server.name}</h3>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
              <StatusDot state={server.status} />
              <span>{stateLabel(server.status)}</span>
            </div>
          </div>
        </div>
        <Badge tone={stateTone(server.status)}>{server.status}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <InfoChip icon={<Users className="h-3.5 w-3.5" />} label="플레이어" value={String(server.players ?? 0)} />
        <InfoChip icon={<Clock className="h-3.5 w-3.5" />} label="Uptime" value={formatDuration(server.uptimeSec ?? 0)} />
        <InfoChip icon={<Box className="h-3.5 w-3.5" />} label="에이전트" value={server.agent_name ?? '—'} />
      </div>

      <div className="mt-4 flex gap-2">
        {server.status !== 'ONLINE' && (
          <Button size="sm" variant="success" loading={busy} onClick={(e) => { e.stopPropagation(); void control('start'); }}>
            <Play className="h-3.5 w-3.5" /> 시작
          </Button>
        )}
        {server.status === 'ONLINE' && (
          <Button size="sm" variant="danger" loading={busy} onClick={(e) => { e.stopPropagation(); void control('stop'); }}>
            <Square className="h-3.5 w-3.5" /> 종료
          </Button>
        )}
        {server.status === 'ONLINE' && (
          <Button size="sm" variant="secondary" loading={busy} onClick={(e) => { e.stopPropagation(); void control('restart'); }}>
            <RotateCw className="h-3.5 w-3.5" /> 재시작
          </Button>
        )}
        <motion.div className="ml-auto self-center">
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
            관리 →
          </Button>
        </motion.div>
      </div>
    </GlassCard>
  );
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium text-zinc-200">{value}</div>
    </div>
  );
}
