import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Server,
  Users,
  Activity,
  Timer,
  Play,
  Square,
  RotateCw,
  ArrowRight,
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Skeleton } from '../components/ui/Skeleton';
import { SystemMonitor } from '../components/SystemMonitor';
import { useServers } from '../hooks/useServers';
import { useAgentStats, type StatPoint } from '../hooks/useAgentStats';
import { useToast } from '../components/ui/Toast';
import { cn, formatDuration } from '../lib/utils';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { servers, loading, socket } = useServers();
  const firstAgentId = useMemo(() => servers?.[0]?.agent_id, [servers]);
  const { all } = useAgentStats();

  const stats = useMemo(() => {
    const list = servers ?? [];
    const online = list.filter((s) => s.status === 'ONLINE').length;
    const players = list.reduce((sum, s) => sum + (s.players ?? 0), 0);
    const uptime = list.reduce((sum, s) => sum + (s.uptimeSec ?? 0), 0);

    const agentArr = Array.from(all.values());
    const lastOf = (pts: StatPoint[]) => pts[pts.length - 1];
    const avgCpu = agentArr.length
      ? agentArr.reduce((sum, pts) => sum + (lastOf(pts)?.cpuPercent ?? 0), 0) / agentArr.length
      : 0;

    return { online, total: list.length, players, avgCpu, uptime };
  }, [servers, all]);

  const control = async (id: string, action: 'start' | 'stop' | 'restart') => {
    const res = await socket.control(
      action === 'start' ? 'server:start' : action === 'stop' ? 'server:stop' : 'server:restart',
      id
    );
    if (!res.ok) toast('error', res.error ?? '요청 실패');
  };

  const tileData = [
    {
      label: '실행 중 서버',
      value: `${stats.online}`,
      sub: `/ ${stats.total} 전체`,
      icon: <Server className="h-4 w-4" />,
      tint: '#30D158',
    },
    {
      label: '총 플레이어',
      value: String(stats.players),
      sub: '명 온라인',
      icon: <Users className="h-4 w-4" />,
      tint: '#0A84FF',
    },
    {
      label: '평균 CPU',
      value: `${Math.round(stats.avgCpu)}`,
      sub: '%',
      icon: <Activity className="h-4 w-4" />,
      tint: '#FF9F0A',
    },
    {
      label: '총 가동 시간',
      value: formatDuration(stats.uptime),
      sub: '합산',
      icon: <Timer className="h-4 w-4" />,
      tint: '#5E5CE6',
    },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <TopBar title="대시보드" subtitle="모든 Minecraft 서버를 한눈에 관리하세요" />

      {/* 요약 타일 */}
      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tileData.map((t) => (
          <StatTile
            key={t.label}
            label={t.label}
            value={t.value}
            sub={t.sub}
            icon={t.icon}
            tint={t.tint}
            loading={loading}
          />
        ))}
      </motion.div>

      {/* 시스템 리소스 */}
      <motion.div variants={item} className="mt-6">
        <SystemMonitor agentId={firstAgentId} />
      </motion.div>

      {/* 서버 목록 */}
      <motion.div variants={item} className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight text-white">서버</h2>
          <button
            onClick={() => navigate('/servers')}
            className="group flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            모두 보기
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[132px] w-full rounded-[24px]" />)}
          </div>
        ) : (servers ?? []).length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/[0.1] bg-white/[0.02] px-8 py-16 text-center">
            <p className="text-sm font-medium text-zinc-400">등록된 서버가 없습니다</p>
            <p className="mt-1 text-xs text-zinc-600">서버 페이지에서 첫 Minecraft 서버를 등록해 보세요.</p>
            <button
              onClick={() => navigate('/servers')}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#0A84FF] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
            >
              서버 등록하러 가기 <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(servers ?? []).map((s) => (
              <ServerTile
                key={s.id}
                name={s.name}
                status={s.status}
                players={s.players ?? 0}
                uptime={s.uptimeSec ?? 0}
                onOpen={() => navigate(`/servers/${s.id}`)}
                onControl={(a) => void control(s.id, a)}
              />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/** Apple 스타일 요약 타일 */
function StatTile({
  label,
  value,
  sub,
  icon,
  tint,
  loading,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tint: string;
  loading: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-5 backdrop-blur-xl">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: `${tint}1a`, color: tint }}
        >
          {icon}
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-9 w-24" />
      ) : (
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="max-w-[70%] truncate text-[32px] font-semibold leading-none tracking-tight text-white tabular-nums">
            {value}
          </span>
          <span className="truncate text-xs text-zinc-500">{sub}</span>
        </div>
      )}
    </div>
  );
}

/** Apple 스타일 서버 카드 */
function ServerTile({
  name,
  status,
  players,
  uptime,
  onOpen,
  onControl,
}: {
  name: string;
  status: string;
  players: number;
  uptime: number;
  onOpen: () => void;
  onControl: (action: 'start' | 'stop' | 'restart') => void;
}) {
  const isOnline = status === 'ONLINE';

  return (
    <motion.div
      variants={item}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      onClick={onOpen}
      className="group cursor-pointer rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] p-5 backdrop-blur-xl transition-colors duration-200 hover:border-white/[0.16]"
    >
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {isOnline && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
            )}
            <span
              className={cn(
                'relative inline-flex h-2.5 w-2.5 rounded-full',
                isOnline ? 'bg-emerald-400' : 'bg-zinc-600'
              )}
            />
          </span>
          <span className="truncate text-[15px] font-semibold tracking-tight text-white">{name}</span>
        </div>
        <span className={cn('shrink-0 text-[11px] font-medium', isOnline ? 'text-emerald-400' : 'text-zinc-600')}>
          {isOnline ? '실행 중' : '중지됨'}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-5 text-xs text-zinc-500">
        <span>
          <span className="tabular-nums font-medium text-white">{players}</span> 플레이어
        </span>
        <span className="flex items-center gap-1.5">
          <Timer className="h-3 w-3" /> {formatDuration(uptime)}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-white/[0.05] pt-4">
        {!isOnline ? (
          <ControlButton
            title="시작"
            tint="#30D158"
            onClick={(e) => {
              e.stopPropagation();
              onControl('start');
            }}
          >
            <Play className="h-3.5 w-3.5" />
          </ControlButton>
        ) : (
          <>
            <ControlButton
              title="종료"
              tint="#FF453A"
              onClick={(e) => {
                e.stopPropagation();
                onControl('stop');
              }}
            >
              <Square className="h-3.5 w-3.5" />
            </ControlButton>
            <ControlButton
              title="재시작"
              tint="#FF9F0A"
              onClick={(e) => {
                e.stopPropagation();
                onControl('restart');
              }}
            >
              <RotateCw className="h-3.5 w-3.5" />
            </ControlButton>
          </>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs font-medium text-zinc-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          관리 <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </motion.div>
  );
}

function ControlButton({
  children,
  title,
  tint,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  tint: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
      style={{ background: `${tint}1a`, color: tint }}
    >
      {children}
    </button>
  );
}
