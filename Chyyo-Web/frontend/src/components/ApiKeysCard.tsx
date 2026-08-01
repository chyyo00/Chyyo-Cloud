import { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, Plus, Trash2, Clock } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Dialog } from './ui/Dialog';
import { Skeleton } from './ui/Skeleton';
import { useToast } from './ui/Toast';
import { api, type ApiKey } from '../lib/api';
import { formatDate } from '../lib/utils';

export function ApiKeysCard() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ name: string; apiKey: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { keys } = await api.listApiKeys();
      setKeys(keys);
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
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const res = await api.createApiKey(trimmed);
      setCreated({ name: res.name, apiKey: res.apiKey });
      setName('');
      setCreateOpen(false);
      void load();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const remove = async (k: ApiKey) => {
    if (!confirm(`API 키 '${k.name}'을(를) 삭제할까요? 이 키로 만든 호출은 즉시 차단됩니다.`)) return;
    try {
      await api.deleteApiKey(k.id);
      toast('success', 'API 키가 삭제되었습니다');
      void load();
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast('success', '복사되었습니다');
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-accent-soft" />
          <h3 className="font-medium text-white">API 키</h3>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> 키 생성
        </Button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        스크립트나 외부 도구에서 Chyyo API를 호출할 때 사용하는 토큰입니다. 모든 API는{' '}
        <code className="font-mono text-zinc-400">Authorization: Bearer &lt;키&gt;</code> 헤더로 인증할 수 있습니다.
      </p>

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : keys.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center text-xs text-zinc-500">
            생성된 API 키가 없습니다.
          </div>
        ) : (
          keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15">
                <KeyRound className="h-4 w-4 text-accent-soft" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">{k.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                  <span className="font-mono text-zinc-400">{k.prefix}…</span>
                  <span>생성 {formatDate(k.createdAt)}</span>
                  {k.lastUsedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> 마지막 사용 {formatDate(k.lastUsedAt)}
                    </span>
                  )}
                </div>
              </div>
              <Button size="sm" variant="danger" onClick={() => void remove(k)}>
                <Trash2 className="h-3.5 w-3.5" /> 삭제
              </Button>
            </div>
          ))
        )}
      </div>

      {/* 생성 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="API 키 생성" description="키 이름을 입력하면 1회만 표시되는 키가 발급됩니다">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="키 이름 (예: 백업 스크립트, CI 배포)"
          onKeyDown={(e) => e.key === 'Enter' && void create()}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>취소</Button>
          <Button loading={creating} onClick={() => void create()}>생성</Button>
        </div>
      </Dialog>

      {/* 발급 키 표시 다이얼로그 */}
      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)} title="API 키 발급 완료">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-200">
            이 키는 <strong>지금만</strong> 표시됩니다. 다시 조회할 수 없으니 안전한 곳에 복사해 두세요.
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
          <code className="flex-1 break-all font-mono text-xs text-accent-soft">{created?.apiKey}</code>
          <Button size="sm" variant="secondary" onClick={() => copy(created?.apiKey ?? '')}>
            <Copy className="h-3.5 w-3.5" /> 복사
          </Button>
        </div>
      </Dialog>
    </GlassCard>
  );
}
