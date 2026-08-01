import { useCallback, useEffect, useRef, useState } from 'react';
import { usePanelSocket, type AgentStatsEvent } from './usePanelSocket';

export interface StatPoint extends AgentStatsEvent {
  time: number;
}

const MAX_POINTS = 60;

/** 에이전트별 시스템 리소스 실시간 스트림 (링 버퍼) */
export function useAgentStats(agentId?: string) {
  const [stats, setStats] = useState<Map<string, StatPoint[]>>(new Map());
  const [latest, setLatest] = useState<AgentStatsEvent | null>(null);
  const socket = usePanelSocket();
  const mapRef = useRef<Map<string, StatPoint[]>>(new Map());

  const push = useCallback((e: AgentStatsEvent) => {
    const id = e.agentId;
    if (!id) return;
    const arr = mapRef.current.get(id) ?? [];
    arr.push({ ...e, time: Date.now() });
    if (arr.length > MAX_POINTS) arr.shift();
    mapRef.current.set(id, arr);
    setStats(new Map(mapRef.current));
    if (agentId && id === agentId) setLatest(e);
  }, [agentId]);

  useEffect(() => {
    socket.on('onAgentStats', push);
  }, [socket, push]);

  const series = agentId ? (stats.get(agentId) ?? []) : [];
  const current = agentId ? (latest ?? series[series.length - 1] ?? null) : null;

  return { series, latest: current, all: stats };
}
