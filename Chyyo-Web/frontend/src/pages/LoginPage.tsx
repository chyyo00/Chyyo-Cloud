import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Blocks } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export function LoginPage() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!username || !password) {
      toast('error', '아이디와 비밀번호를 입력하세요');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password);
      navigate('/');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-900 px-4">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-20%] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] h-[400px] w-[400px] rounded-full bg-[#5E5CE6]/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className="relative w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 18 }}
            className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-b from-accent-soft to-accent shadow-[0_12px_40px_-8px_rgba(10,132,255,0.7)]"
          >
            <Blocks className="h-8 w-8 text-white" />
          </motion.div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">Chyyo</h1>
          <p className="mt-1 text-sm text-zinc-500">Minecraft Server Panel</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-strong rounded-5xl p-8"
        >
          <div className="mb-6 flex rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 rounded-xl py-2 text-sm font-medium transition-all duration-200',
                  mode === m ? 'bg-white/[0.08] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {m === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <Input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디"
              className="rounded-2xl py-3.5"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="비밀번호"
              className="rounded-2xl py-3.5"
            />
          </div>

          <Button
            size="lg"
            className="mt-6 w-full rounded-2xl py-3.5"
            loading={loading}
            onClick={() => void submit()}
          >
            {mode === 'login' ? '로그인' : '계정 만들기'}
          </Button>

          <p className="mt-4 text-center text-xs text-zinc-600">
            기본 관리자: admin · 비밀번호는 .env의 ADMIN_PASSWORD
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
