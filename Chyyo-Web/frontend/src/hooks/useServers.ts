import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Server } from '../lib/api';
import { usePanelSocket } from './usePanelSocket';

/** 서버 목록 + 실시간 상태 구독 */
export function useServers() {
  const [servers, setServers] = useState<Server[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const socket = usePanelSocket();

  const refresh = useCallback(async () => {
    try {
      const { servers } = await api.listServers();
      setServers(servers);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 실시간 상태 반영
  socket.on('onStatus', (e) => {
    setServers((prev) =>
      prev
        ? prev.map((s) =>
            s.id === e.serverId
              ? {
                  ...s,
                  status: e.state ?? s.status,
                  uptimeSec: e.uptimeSec ?? s.uptimeSec,
                  players: e.players ?? s.players,
                }
              : s
          )
        : prev
    );
  });

  const byId = useMemo(
    () => new Map((servers ?? []).map((s) => [s.id, s])),
    [servers]
  );

  return { servers, byId, error, loading, refresh, socket };
}
