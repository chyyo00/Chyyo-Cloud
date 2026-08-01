import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const ToastContext = createContext<{ toast: (type: ToastType, message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-[#17171d]/95 px-4 py-3 shadow-2xl backdrop-blur-xl"
            >
              {t.type === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />}
              {t.type === 'error' && <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />}
              {t.type === 'info' && <Info className="h-5 w-5 shrink-0 text-accent-soft" />}
              <span className={cn('text-sm font-medium')}>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast는 ToastProvider 안에서 사용해야 합니다');
  return ctx;
}
