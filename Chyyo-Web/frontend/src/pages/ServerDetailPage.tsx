import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Square, RotateCw, ArrowLeft, Terminal, FolderTree, Archive, LayoutDashboard } from 'lucide-react';
import { TabNav } from '../components/ui/Tabs';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Badge, StatusDot, stateLabel, stateTone } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { Console } from '../components/Console';
import { FileManager } from '../components/FileManager';
import { BackupsPanel } from '../components/BackupsPanel';
import { useServers } from '../hooks/useServers';
import { useServerConsole } from '../hooks/useServerConsole';
import { useToast } from '../components/ui/Toast';
import { api, type Server } from '../lib/api';
import { formatDuration } from '../lib/utils';

const TABS = [
  { value: 'overview', label: '개요', icon: <LayoutDashboard className="h-4 w-4" /> },
  { value: 'console', label: '콘솔', icon: <Terminal className="h-4 w-4" /> },
  { value: 'files', label: '파일', icon: <FolderTree className="h-4 w-4" /> },
  { value: 'backups', label: '백업', icon: <Archive className="h-4 w-4" /> },
];

export function ServerDetailPage() {
  const { serverId = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { byId, socket, refresh } = useServers();
  const [tab, setTab] = useState('overview');
  const [server, setServer] = useState<Server | null>(byId.get(serverId) ?? null);
  const [notFound, setNotFound] = useState(false);

  const consoleHook = useServerConsole(serverId);

  useEffect(() => {
    const live = byId.get(serverId);
    if (live) {
      setServer(live);
      setNotFound(false);
    }
  }, [byId, serverId]);

  useEffect(() => {
    if (!byId.get(serverId)) {
      api
        .getServer(serverId)
        .then(({ server }) => setServer(server))
        .catch(() => setNotFound(true));
    }
  }, [serverId, byId]);

  const control = useCallback(
    async (action: 'start' | 'stop' | 'restart') => {
      const res = await socket.control(
        action === 'start' ? 'server:start' : action === 'stop' ? 'server:stop' : 'server:restart',
        serverId
      );
      if (!res.ok) toast('error', res.error ?? '요청 실패');
      else toast('success', '요청이 전송되었습니다');
      void refresh();
    },
    [socket, serverId, toast, refresh]
  );

  const status = server?.status ?? 'OFFLINE';
  const isOnline = status === 'ONLINE';
  const info = useMemo(
    () => [
      { label: '경로', value: server?.path ?? '—' },
      { label: 'Jar', value: server?.jar_file ?? '—' },
      { label: 'Java 옵션', value: server?.java_args ?? '—' },
      { label: '에이전트', value: server?.agent_name ?? '—' },
      { label: '플레이어', value: String(server?.players ?? 0) },
      { label: 'Uptime', value: formatDuration(server?.uptimeSec ?? 0) },
    ],
    [server]
  );

  if (notFound) {
    return (
      <GlassCard className="p-12 text-center text-sm text-zinc-500">
        서버를 찾을 수 없습니다.
      </GlassCard>
    );
  }

  if (!server) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <button onClick={() => navigate('/servers')} className="mb-4 flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> 서버 목록
      </button>

      {/* 헤더 */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-accent-soft to-accent shadow-[0_8px_24px_-6px_rgba(10,132,255,0.6)]">
            <span className="text-lg font-bold text-white">{server.name[0]?.toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{server.name}</h1>
            <div className="mt-0.5 flex items-center gap-2">
              <StatusDot state={status} />
              <span className="text-sm text-zinc-400">{stateLabel(status)}</span>
              <Badge tone={stateTone(status)}>{status}</Badge>
            </div>
          </div>
        </div>

        <div className="ml-auto flex gap-2">
          {!isOnline && (
            <Button variant="success" onClick={() => void control('start')}>
              <Play className="h-4 w-4" /> 시작
            </Button>
          )}
          {isOnline && (
            <>
              <Button variant="danger" onClick={() => void control('stop')}>
                <Square className="h-4 w-4" /> 종료
              </Button>
              <Button variant="secondary" onClick={() => void control('restart')}>
                <RotateCw className="h-4 w-4" /> 재시작
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6">
        <TabNav tabs={TABS} value={tab} onChange={setTab} />
      </div>

      <div className="mt-6">
        {tab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 md:grid-cols-2">
            <GlassCard className="p-6 md:col-span-2">
              <h3 className="mb-4 font-medium text-white">서버 정보</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {info.map((i) => (
                  <div key={i.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{i.label}</div>
                    <div className="mt-1 break-all text-sm font-medium text-zinc-200">{i.value}</div>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard className="p-6">
              <h3 className="mb-3 font-medium text-white">빠른 작업</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setTab('console')}><Terminal className="h-3.5 w-3.5" /> 콘솔 열기</Button>
                <Button size="sm" variant="secondary" onClick={() => setTab('files')}><FolderTree className="h-3.5 w-3.5" /> 파일 탐색</Button>
                <Button size="sm" variant="secondary" onClick={() => setTab('backups')}><Archive className="h-3.5 w-3.5" /> 백업</Button>
              </div>
            </GlassCard>
            <GlassCard className="p-6">
              <h3 className="mb-3 font-medium text-white">상태 요약</h3>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="상태" value={stateLabel(status)} />
                <MiniStat label="플레이어" value={String(server.players ?? 0)} />
                <MiniStat label="PID" value={server.pid ? String(server.pid) : '—'} />
                <MiniStat label="Uptime" value={formatDuration(server.uptimeSec ?? 0)} />
              </div>
            </GlassCard>
          </motion.div>
        )}

        {tab === 'console' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Console
              lines={consoleHook.lines}
              loading={consoleHook.loading}
              onSend={consoleHook.send}
              onLoadHistory={consoleHook.loadHistory}
              onClear={consoleHook.clear}
            />
          </motion.div>
        )}

        {tab === 'files' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <FileManager serverId={serverId} />
          </motion.div>
        )}

        {tab === 'backups' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <BackupsPanel serverId={serverId} />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] px-3 py-2.5">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
