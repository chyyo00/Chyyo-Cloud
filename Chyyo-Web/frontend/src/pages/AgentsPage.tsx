import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Copy, Trash2, ServerCog, KeyRound } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { Button } from '../components/ui/Button';
import { GlassCard } from '../components/ui/GlassCard';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { api, type Agent } from '../lib/api';
import { formatDate } from '../lib/utils';

export function AgentsPage() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [tokenResult, setTokenResult] = useState<{ name: string; token: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { agents } = await api.listAgents();
      setAgents(agents);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    try {
      const { agent, token } = await api.createAgent(name.trim());
      setTokenResult({ name: agent.name, token });
      setName('');
      setCreateOpen(false);
      void load();
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  const remove = async (a: Agent) => {
    if (!confirm(`에이전트 '${a.name}'과(와) 연결된 서버 ${a.serverCount ?? 0}개를 삭제할까요?`)) return;
    try {
      await api.deleteAgent(a.id);
      toast('success', '에이전트가 삭제되었습니다');
      void load();
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="flex items-center justify-between">
        <TopBar title="에이전트" subtitle="Windows Server에 설치되는 Chyyo-Agent 데몬 관리" />
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> 에이전트 등록
        </Button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : agents.length === 0 ? (
          <GlassCard className="p-12 text-center text-sm text-zinc-500">
            등록된 에이전트가 없습니다. 에이전트를 등록하고 Windows 서버에 Chyyo-Agent를 설치하세요.
          </GlassCard>
        ) : (
          agents.map((a) => (
            <GlassCard key={a.id} className="flex items-center gap-4 p-5">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${a.connected ? 'bg-emerald-500/15' : 'bg-white/[0.05]'}`}>
                <ServerCog className={`h-5 w-5 ${a.connected ? 'text-emerald-400' : 'text-zinc-500'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{a.name}</span>
                  <span className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${
                    a.connected ? 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300' : 'border-white/10 bg-white/[0.06] text-zinc-400'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${a.connected ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                    {a.connected ? '연결됨' : '오프라인'}
                  </span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  서버 {a.serverCount ?? 0}개 · 등록 {formatDate(a.createdAt as string)}
                </div>
              </div>
              <Button size="sm" variant="danger" onClick={() => void remove(a)}>
                <Trash2 className="h-3.5 w-3.5" /> 삭제
              </Button>
            </GlassCard>
          ))
        )}
      </div>

      {/* 등록 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="에이전트 등록" description="반환되는 토큰은 1회만 표시됩니다">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="에이전트 이름 (예: Main-Node-01)"
          onKeyDown={(e) => e.key === 'Enter' && void create()}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>취소</Button>
          <Button onClick={() => void create()}>등록</Button>
        </div>
      </Dialog>

      {/* 토큰 표시 다이얼로그 */}
      <Dialog open={!!tokenResult} onOpenChange={(o) => !o && setTokenResult(null)} title="에이전트 토큰">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-200">
            이 토큰을 Chyyo-Agent의 <code className="font-mono">config.json</code> (panel.agentToken)에 입력하세요.
            다시 표시할 수 없습니다. 지금 복사해 두세요.
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
          <code className="flex-1 break-all font-mono text-xs text-accent-soft">{tokenResult?.token}</code>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(tokenResult?.token ?? '');
              toast('success', '토큰이 복사되었습니다');
            }}
          >
            <Copy className="h-3.5 w-3.5" /> 복사
          </Button>
        </div>
      </Dialog>
    </motion.div>
  );
}
