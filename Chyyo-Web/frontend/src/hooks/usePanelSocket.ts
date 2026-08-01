import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { tokenStore } from '../lib/api';

export interface ServerStatusEvent {
  serverId?: string;
  state?: string;
  pid?: number | null;
  uptimeSec?: number;
  players?: number;
  playerNames?: string[];
  cpuPercent?: number;
  ramMb?: number;
}

export interface ConsoleLogEvent {
  serverId?: string;
  line?: string;
  ts?: number;
}

export interface AgentStatsEvent {
  agentId?: string;
  cpuPercent?: number;
  ramUsedMb?: number;
  ramTotalMb?: number;
  diskUsedMb?: number;
  diskTotalMb?: number;
  netUpKbps?: number;
  netDownKbps?: number;
  ts?: number;
}

/**
 * Chyyo-Web 패널 Socket.IO 연결.
 * 서버 상태/콘솔/리소스 이벤트 실시간 구독 및 서버 제어 RPC를 제공한다.
 */
export function usePanelSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [serverIds, setServerIds] = useState<string[]>([]);

  const callbacks = useRef<{
    onStatus?: (e: ServerStatusEvent) => void;
    onConsole?: (e: ConsoleLogEvent) => void;
    onAgentStats?: (e: AgentStatsEvent) => void;
    onBackup?: (e: any) => void;
  }>({});

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) return;

    const socket = io('/panel', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => {
      console.warn('[panel] 연결 오류:', err.message);
    });
    socket.on('ready', (data: { serverIds: string[] }) => {
      setServerIds(data.serverIds ?? []);
      setReady(true);
    });
    socket.on('server:status', (e: ServerStatusEvent) => callbacks.current.onStatus?.(e));
    socket.on('console:log', (e: ConsoleLogEvent) => callbacks.current.onConsole?.(e));
    socket.on('agent:stats', (e: AgentStatsEvent) => callbacks.current.onAgentStats?.(e));
    socket.on('backup:done', (e: any) => callbacks.current.onBackup?.(e));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setReady(false);
    };
  }, []);

  const on = useCallback(
    (name: 'onStatus' | 'onConsole' | 'onAgentStats' | 'onBackup', fn: (e: any) => void) => {
      callbacks.current[name] = fn;
    },
    []
  );

  /** 서버 제어 RPC (ack 기반) */
  const control = useCallback(
    (event: 'server:start' | 'server:stop' | 'server:restart' | 'console:input', serverId: string, payload?: any): Promise<{ ok: boolean; error?: string }> => {
      return new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) return resolve({ ok: false, error: '패널 연결 끊김' });
        socket.emit(event, { serverId, payload }, (res: any) => {
          resolve(res ?? { ok: false, error: '응답 없음' });
        });
      });
    },
    []
  );

  const value = useMemo(
    () => ({ connected, ready, serverIds, on, control }),
    [connected, ready, serverIds, on, control]
  );

  return value;
}
