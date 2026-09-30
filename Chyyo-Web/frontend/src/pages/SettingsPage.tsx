import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Shield, Trash2, UserCog, Lock } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { TabNav } from '../components/ui/Tabs';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { api, type User } from '../lib/api';
import { formatDate } from '../lib/utils';
import { ApiKeysCard } from '../components/ApiKeysCard';

export function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('account');

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <TopBar title="설정" subtitle="계정, 보안 및 API 키 관리" />
      <TabNav
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'account', label: '계정 & 사용자', icon: <UserCog className="h-4 w-4" /> },
          { value: 'apikeys', label: 'API 키', icon: <Lock className="h-4 w-4" /> },
        ]}
      />
      <div className="mt-5">
        {tab === 'account' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <PasswordCard />
            {isAdmin && <UsersCard />}
          </div>
        ) : (
          <div className="max-w-2xl">
            <ApiKeysCard />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PasswordCard() {
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!next || next.length < 12 || new TextEncoder().encode(next).length > 72) {
      toast('error', '새 비밀번호는 최소 6자 이상이어야 합니다');
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(current, next);
      toast('success', '비밀번호가 변경되었습니다');
      setCurrent('');
      setNext('');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-accent-soft" />
        <h3 className="font-medium text-white">비밀번호 변경</h3>
      </div>
      <div className="mt-5 space-y-3">
        <Input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="현재 비밀번호"
        />
        <Input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="새 비밀번호"
        />
        <Button loading={saving} onClick={() => void save()}>변경</Button>
      </div>
    </GlassCard>
  );
}

function UsersCard() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { users } = await api.listUsers();
      setUsers(users);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeRole = async (u: User, role: string) => {
    try {
      await api.setRole(u.id, role);
      toast('success', `${u.username} → ${role === 'admin' ? '관리자' : '사용자'}`);
      void load();
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  const remove = async (u: User) => {
    if (!confirm(`사용자 '${u.username}'을(를) 삭제할까요?`)) return;
    try {
      await api.deleteUser(u.id);
      toast('success', '삭제되었습니다');
      void load();
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-accent-soft" />
        <h3 className="font-medium text-white">사용자 관리</h3>
      </div>
      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-accent-soft to-accent text-sm font-semibold text-white">
                {u.username[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">
                  {u.username}
                  {u.role === 'admin' && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent-soft">관리자</span>}
                </div>
                <div className="text-[11px] text-zinc-500">가입 {formatDate(u.createdAt as string)}</div>
              </div>
              <div className="w-24">
                <Select value={u.role} onChange={(e) => void changeRole(u, e.target.value)}>
                  <option value="user" className="bg-base-800">사용자</option>
                  <option value="admin" className="bg-base-800">관리자</option>
                </Select>
              </div>
              <Button size="sm" variant="danger" onClick={() => void remove(u)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}
