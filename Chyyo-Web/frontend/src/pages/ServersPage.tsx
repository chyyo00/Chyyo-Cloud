import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/ui/Button';
import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Skeleton';
import { ServerCard } from '../components/ServerCard';
import { ServerModal } from '../components/ServerModal';
import { useServers } from '../hooks/useServers';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { api, type Agent } from '../lib/api';

export function ServersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { servers, loading, refresh, socket } = useServers();
  const [modalOpen, setModalOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      api.listAgents().then(({ agents }) => setAgents(agents)).catch(() => setAgents([]));
    }
  }, [isAdmin]);

  const control = async (id: string, action: 'start' | 'stop' | 'restart') => {
    const res = await socket.control(action === 'start' ? 'server:start' : action === 'stop' ? 'server:stop' : 'server:restart', id);
    if (!res.ok) toast('error', res.error ?? '요청 실패');
    else toast('success', '요청이 전송되었습니다');
    return res;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="flex items-center justify-between">
        <TopBar title="서버" subtitle="Minecraft 서버를 시작/종료하고 관리하세요" />
        {isAdmin && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> 서버 등록
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      ) : (servers ?? []).length === 0 ? (
        <GlassCard className="p-12 text-center text-sm text-zinc-500">
          {isAdmin
            ? '아직 등록된 서버가 없습니다. "서버 등록" 버튼으로 첫 서버를 추가하세요.'
            : '접근 권한이 있는 서버가 없습니다. 관리자에게 문의하세요.'}
        </GlassCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(servers ?? []).map((s) => (
            <ServerCard
              key={s.id}
              server={s}
              online
              onOpen={() => navigate(`/servers/${s.id}`)}
              onControl={(a) => control(s.id, a)}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <ServerModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          onSaved={() => void refresh()}
          agents={agents}
        />
      )}
    </motion.div>
  );
}
