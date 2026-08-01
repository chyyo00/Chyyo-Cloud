import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Folder,
  FolderOpen,
  File,
  ArrowUp,
  RefreshCw,
  Upload,
  Trash2,
  Pencil,
  Download,
  Copy,
  FolderPlus,
  FilePlus,
} from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Textarea, Input } from './ui/Input';
import { Skeleton } from './ui/Skeleton';
import { useToast } from './ui/Toast';
import { api, type FileEntry } from '../lib/api';
import { formatBytes, formatDate, downloadDataUrl, cn } from '../lib/utils';

export function FileManager({ serverId }: { serverId: string }) {
  const { toast } = useToast();
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState<{ path: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [createDialog, setCreateDialog] = useState<null | 'folder' | 'file'>(null);
  const [createName, setCreateName] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listFiles(serverId, path);
      if (res.ok && res.data?.entries) setEntries(res.data.entries as FileEntry[]);
      else toast('error', res.error ?? '목록 로드 실패');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [serverId, path, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const navigate = (p: string) => setPath(p);

  const join = (name: string) => (path ? `${path}/${name}` : name);

  const openEntry = (e: FileEntry) => {
    if (e.isDirectory) navigate(e.path);
    else openEditor(e.path);
  };

  const openEditor = async (p: string) => {
    const res = await api.readFile(serverId, p);
    if (!res.ok) {
      toast('error', res.error ?? '파일을 열 수 없습니다');
      return;
    }
    setEditing({ path: p, content: res.data?.content ?? '' });
  };

  const saveEditor = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await api.writeFile(serverId, editing.path, editing.content);
    setSaving(false);
    if (res.ok) {
      toast('success', '파일이 저장되었습니다');
      setEditing(null);
    } else toast('error', res.error ?? '저장 실패');
  };

  const remove = async (e: FileEntry) => {
    if (!confirm(`'${e.name}'을(를) 삭제할까요?`)) return;
    const res = await api.deleteFile(serverId, e.path);
    if (res.ok) {
      toast('success', '삭제되었습니다');
      void load();
    } else toast('error', res.error ?? '삭제 실패');
  };

  const download = async (e: FileEntry) => {
    const res = await api.downloadFile(serverId, e.path);
    if (res.ok && res.data?.data) downloadDataUrl(res.data.name, res.data.data);
    else toast('error', res.error ?? '다운로드 실패');
  };

  const mkdir = async () => {
    if (!createName.trim()) return;
    const res = await api.mkdir(serverId, join(createName.trim()));
    if (res.ok) {
      toast('success', '폴더가 생성되었습니다');
      setCreateDialog(null);
      setCreateName('');
      void load();
    } else toast('error', res.error ?? '생성 실패');
  };

  const createFile = async () => {
    if (!createName.trim()) return;
    const res = await api.writeFile(serverId, join(createName.trim()), '');
    if (res.ok) {
      toast('success', '파일이 생성되었습니다');
      setCreateDialog(null);
      setCreateName('');
      void load();
    } else toast('error', res.error ?? '생성 실패');
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api.uploadFile(serverId, path, file.name, data);
      if (!res.ok) toast('error', `${file.name}: ${res.error ?? '업로드 실패'}`);
    }
    toast('success', '업로드 완료');
    void load();
  };

  const rename = async (e: FileEntry) => {
    const newName = prompt('새 이름', e.name);
    if (!newName || newName === e.name) return;
    const res = await api.renameFile(serverId, e.path, newName);
    if (res.ok) {
      toast('success', '이름이 변경되었습니다');
      void load();
    } else toast('error', res.error ?? '변경 실패');
  };

  const breadcrumb = path.split('/').filter(Boolean);

  return (
    <GlassCard className="p-4">
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => navigate(path.split('/').slice(0, -1).join('/'))} className="rounded-xl p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white" title="상위 폴더">
          <ArrowUp className="h-4 w-4" />
        </button>
        <button onClick={() => void load()} className="rounded-xl p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white" title="새로고침">
          <RefreshCw className="h-4 w-4" />
        </button>
        <button onClick={() => fileInput.current?.click()} className="rounded-xl p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white" title="업로드">
          <Upload className="h-4 w-4" />
        </button>
        <button onClick={() => setCreateDialog('folder')} className="rounded-xl p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white" title="새 폴더">
          <FolderPlus className="h-4 w-4" />
        </button>
        <button onClick={() => setCreateDialog('file')} className="rounded-xl p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white" title="새 파일">
          <FilePlus className="h-4 w-4" />
        </button>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => void handleFiles(e.target.files)} />

        {/* 경로 */}
        <div className="ml-2 flex items-center gap-1 overflow-x-auto whitespace-nowrap text-sm">
          <button onClick={() => navigate('')} className={cn('rounded-lg px-2 py-1 transition', !path ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white')}>
            서버 루트
          </button>
          {breadcrumb.map((seg, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-zinc-600">/</span>
              <button
                onClick={() => navigate(breadcrumb.slice(0, i + 1).join('/'))}
                className={cn('rounded-lg px-2 py-1 transition', i === breadcrumb.length - 1 ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white')}
              >
                {seg}
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* 파일 목록 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFiles(e.dataTransfer.files); }}
        className={cn('mt-4 overflow-hidden rounded-2xl border border-white/[0.06] transition', dragging && 'border-accent/60 bg-accent/[0.06]')}
      >
        <div className="grid grid-cols-[1fr_90px_150px_64px] gap-2 border-b border-white/[0.06] bg-white/[0.03] px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          <span>이름</span>
          <span className="text-right">크기</span>
          <span>수정</span>
          <span className="text-right">작업</span>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            {dragging ? '여기에 놓아 업로드' : '빈 폴더입니다. 파일을 드래그&드롭하여 업로드하세요.'}
          </div>
        ) : (
          entries.map((e) => (
            <div
              key={e.path}
              onDoubleClick={() => openEntry(e)}
              className="group grid cursor-default grid-cols-[1fr_90px_150px_64px] items-center gap-2 border-b border-white/[0.03] px-4 py-2 text-sm transition hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-2.5">
                {e.isDirectory ? (
                  <Folder className="h-4 w-4 shrink-0 text-accent-soft" />
                ) : (
                  <File className="h-4 w-4 shrink-0 text-zinc-500" />
                )}
                <span className="truncate font-medium text-zinc-200">{e.name}</span>
              </div>
              <div className="text-right text-xs text-zinc-500">{e.isDirectory ? '—' : formatBytes(e.size)}</div>
              <div className="text-xs text-zinc-500">{formatDate(e.modified)}</div>
              <div className="flex justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                {e.isDirectory ? (
                  <IconBtn title="열기" onClick={() => openEntry(e)}><FolderOpen className="h-3.5 w-3.5" /></IconBtn>
                ) : (
                  <>
                    <IconBtn title="편집" onClick={() => openEditor(e.path)}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn title="다운로드" onClick={() => void download(e)}><Download className="h-3.5 w-3.5" /></IconBtn>
                  </>
                )}
                <IconBtn title="이름 변경" onClick={() => void rename(e)}><Copy className="h-3.5 w-3.5" /></IconBtn>
                <IconBtn title="삭제" danger onClick={() => void remove(e)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
              </div>
            </div>
          ))
        )}
      </div>
      {dragging && (
        <div className="mt-2 rounded-2xl border-2 border-dashed border-accent/50 bg-accent/[0.06] p-4 text-center text-sm text-accent-soft">
          파일을 놓아 업로드하세요
        </div>
      )}

      {/* 파일 편집 다이얼로그 */}
      <Dialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="파일 편집"
        description={editing?.path}
      >
        <Textarea
          value={editing?.content ?? ''}
          onChange={(e) => setEditing((s) => (s ? { ...s, content: e.target.value } : s))}
          className="h-80"
          spellCheck={false}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditing(null)}>취소</Button>
          <Button loading={saving} onClick={() => void saveEditor()}>저장</Button>
        </div>
      </Dialog>

      {/* 새 폴더/파일 */}
      <Dialog
        open={!!createDialog}
        onOpenChange={(o) => !o && setCreateDialog(null)}
        title={createDialog === 'folder' ? '새 폴더' : '새 파일'}
      >
        <Input
          autoFocus
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          placeholder={createDialog === 'folder' ? '폴더 이름' : '파일 이름'}
          onKeyDown={(e) => e.key === 'Enter' && void (createDialog === 'folder' ? mkdir() : createFile())}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreateDialog(null)}>취소</Button>
          <Button onClick={() => void (createDialog === 'folder' ? mkdir() : createFile())}>생성</Button>
        </div>
      </Dialog>
    </GlassCard>
  );
}

function IconBtn({ children, title, danger, onClick }: { children: React.ReactNode; title: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn('rounded-lg p-1.5 transition', danger ? 'text-red-400/70 hover:bg-red-500/15 hover:text-red-300' : 'text-zinc-500 hover:bg-white/10 hover:text-white')}
    >
      {children}
    </button>
  );
}
