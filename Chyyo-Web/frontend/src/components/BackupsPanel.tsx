import { useCallback, useEffect, useState } from 'react';
import { Package, Plus, Download, RotateCcw, Trash2, RefreshCw, Archive } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Input } from './ui/Input';
import { Skeleton } from './ui/Skeleton';
import { useToast } from './ui/Toast';
import { api, type BackupEntry } from '../lib/api';
import { formatBytes, formatDate, downloadDataUrl } from '../lib/utils';

export function BackupsPanel({ serverId }: { serverId: string }) {
  const { toast } = useToast();
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listBackups(serverId);
      if (res.ok && res.data?.backups) setBackups(res.data.backups as BackupEntry[]);
      else toast('error', res.error ?? '백업 목록 로드 실패');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [serverId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    const res = await api.createBackup(serverId, createName.trim() || 'backup');
    setCreating(false);
    if (res.ok) {
      toast('success', '백업 생성이 시작되었습니다');
      setCreateOpen(false);
      setCreateName('');
      setTimeout(() => void load(), 1500);
    } else toast('error', res.error ?? '백업 생성 실패');
  };

  const restore = async (name: string) => {
    if (!confirm(`'${name}' 백업으로 복원할까요?\n서버가 실행 중이면 먼저 종료해야 합니다.`)) return;
    const res = await api.restoreBackup(serverId, name);
    if (res.ok) toast('success', '복원이 완료되었습니다');
    else toast('error', res.error ?? '복원 실패');
  };

  const download = async (name: string) => {
    const res = await api.downloadBackup(serverId, name);
    if (res.ok && res.data?.data) downloadDataUrl(res.data.name, res.data.data);
    else toast('error', res.error ?? '다운로드 실패');
  };

  const remove = async (name: string) => {
    if (!confirm(`'${name}' 백업을 삭제할까요?`)) return;
    const res = await api.deleteBackup(serverId, name);
    if (res.ok) {
      toast('success', '삭제되었습니다');
      void load();
    } else toast('error', res.error ?? '삭제 실패');
  };

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-accent-soft" />
          <h3 className="font-medium text-white">백업</h3>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => void load()} title="새로고침">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> 새 백업
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : backups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
            아직 백업이 없습니다. 새 백업을 생성하세요.
          </div>
        ) : (
          backups.map((b) => (
            <div
              key={b.name}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.05]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                <Package className="h-4 w-4 text-accent-soft" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">{b.name}</div>
                <div className="text-xs text-zinc-500">
                  {formatBytes(b.sizeBytes)} · {formatDate(b.modified)}
                </div>
              </div>
              <div className="flex gap-1">
                <Btn title="다운로드" onClick={() => void download(b.name)}><Download className="h-3.5 w-3.5" /></Btn>
                <Btn title="복원" onClick={() => void restore(b.name)}><RotateCcw className="h-3.5 w-3.5" /></Btn>
                <Btn title="삭제" danger onClick={() => void remove(b.name)}><Trash2 className="h-3.5 w-3.5" /></Btn>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="새 백업 생성" description="서버 월드와 설정이 ZIP으로 압축됩니다">
        <Input
          autoFocus
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          placeholder="백업 이름 (예: weekly, event-start)"
          onKeyDown={(e) => e.key === 'Enter' && void create()}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>취소</Button>
          <Button loading={creating} onClick={() => void create()}>생성</Button>
        </div>
      </Dialog>
    </GlassCard>
  );
}

function Btn({ children, title, danger, onClick }: { children: React.ReactNode; title: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded-xl p-2 transition ${
        danger ? 'text-red-400/70 hover:bg-red-500/15 hover:text-red-300' : 'text-zinc-500 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
