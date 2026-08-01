import { Wifi, WifiOff } from 'lucide-react';
import { usePanelSocket } from '../hooks/usePanelSocket';

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { connected } = usePanelSocket();
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-400 backdrop-blur-xl">
        {connected ? (
          <Wifi className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-zinc-500" />
        )}
        {connected ? '실시간 연결됨' : '연결 끊김'}
      </div>
    </div>
  );
}
