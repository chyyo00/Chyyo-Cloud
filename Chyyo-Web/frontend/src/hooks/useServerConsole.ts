import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { usePanelSocket } from './usePanelSocket';

export interface ConsoleLine {
  line: string;
  ts: number;
}

/** 서버 실시간 콘솔 구독 + 명령 전송 */
export function useServerConsole(serverId: string | undefined) {
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [loading, setLoading] = useState(false);
  const socket = usePanelSocket();
  const linesRef = useRef<ConsoleLine[]>([]);

  const pushLines = useCallback((added: ConsoleLine[]) => {
    linesRef.current = [...linesRef.current, ...added].slice(-1000);
    setLines(linesRef.current);
  }, []);

  // 실시간 로그
  useEffect(() => {
    if (!serverId) return;
    socket.on('onConsole', (e) => {
      if (e.serverId === serverId && e.line) {
        pushLines([{ line: e.line, ts: e.ts ?? Date.now() }]);
      }
    });
  }, [serverId, socket, pushLines]);

  const loadHistory = useCallback(async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      const res = await api.consoleHistory(serverId, 300);
      if (res.ok && res.data?.lines) {
        const arr = res.data.lines as { line: string; ts: number }[];
        linesRef.current = arr;
        setLines(arr);
      }
    } catch {
      // 무시
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  const send = useCallback(
    async (command: string) => {
      if (!serverId || !command.trim()) return { ok: false, error: '명령어가 비어 있습니다' };
      const res = await socket.control('console:input', serverId, { command: command.trim() });
      if (res.ok) {
        pushLines([{ line: `> ${command.trim()}`, ts: Date.now() }]);
      }
      return res;
    },
    [serverId, socket, pushLines]
  );

  const clear = useCallback(() => {
    linesRef.current = [];
    setLines([]);
  }, []);

  return { lines, loading, loadHistory, send, clear };
}
