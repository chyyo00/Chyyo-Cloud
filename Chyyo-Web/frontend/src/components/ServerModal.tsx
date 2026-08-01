import { useEffect, useState } from 'react';
import { Dialog } from './ui/Dialog';
import { Input, Select } from './ui/Input';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import { api, type Agent, type Server } from '../lib/api';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  server?: Server | null;
  agents: Agent[];
}

export function ServerModal({ open, onOpenChange, onSaved, server, agents }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    agentId: '',
    name: '',
    path: '',
    jarFile: 'server.jar',
    javaArgs: '-Xms1G -Xmx2G',
  });

  useEffect(() => {
    if (open) {
      setForm({
        agentId: server?.agent_id ?? agents[0]?.id ?? '',
        name: server?.name ?? '',
        path: server?.path ?? '',
        jarFile: server?.jar_file ?? 'server.jar',
        javaArgs: server?.java_args ?? '-Xms1G -Xmx2G',
      });
    }
  }, [open, server, agents]);

  const save = async () => {
    if (!form.name.trim() || !form.path.trim() || !form.agentId) {
      toast('error', '이름, 경로, 에이전트는 필수입니다');
      return;
    }
    setSaving(true);
    try {
      if (server) {
        const res = await api.updateServer(server.id, form);
        if (res.server) toast('success', '서버가 수정되었습니다');
      } else {
        const res = await api.createServer(form);
        if (res.server) toast('success', '서버가 등록되었습니다');
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={server ? '서버 수정' : '서버 등록'}
      description="Windows 서버의 실제 경로를 정확히 입력하세요 (예: C:/Minecraft/Survival)"
    >
      <div className="space-y-3">
        <div>
          <Label>에이전트</Label>
          <Select
            value={form.agentId}
            onChange={(e) => setForm((f) => ({ ...f, agentId: e.target.value }))}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id} className="bg-base-800">
                {a.name} {a.connected ? '(연결됨)' : '(오프라인)'}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>서버 이름</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Survival"
          />
        </div>
        <div>
          <Label>경로</Label>
          <Input
            value={form.path}
            onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
            placeholder="C:/Minecraft/Survival"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Jar 파일</Label>
            <Input
              value={form.jarFile}
              onChange={(e) => setForm((f) => ({ ...f, jarFile: e.target.value }))}
              placeholder="server.jar"
            />
          </div>
          <div>
            <Label>Java 옵션</Label>
            <Input
              value={form.javaArgs}
              onChange={(e) => setForm((f) => ({ ...f, javaArgs: e.target.value }))}
              placeholder="-Xms1G -Xmx2G"
            />
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>취소</Button>
        <Button loading={saving} onClick={() => void save()}>{server ? '저장' : '등록'}</Button>
      </div>
    </Dialog>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs font-medium text-zinc-500">{children}</div>;
}
