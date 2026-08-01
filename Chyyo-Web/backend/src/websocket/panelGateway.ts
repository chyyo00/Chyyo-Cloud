import type { Namespace, Socket } from 'socket.io';
import { verifyToken, JwtPayload } from '../auth/jwt';
import { hasServerPermission } from '../middleware/auth';
import { query } from '../database/pool';
import type { AgentGateway } from './agentGateway';

/**
 * 브라우저(React Web Panel)와의 Socket.IO 게이트웨이.
 * - JWT 핸드셰이크 인증
 * - 권한에 따라 서버 룸 구독
 * - 에이전트 RPC로 시작/종료/콘솔 명령 전달 (ack 응답)
 */
export class PanelGateway {
  constructor(private panelIo: Namespace, private agents: AgentGateway) {}

  init() {
    this.panelIo.use((socket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      const payload = token ? verifyToken(token) : null;
      if (!payload) return next(new Error('인증 실패'));
      socket.data.user = payload;
      next();
    });

    this.panelIo.on('connection', (socket) => this.onConnection(socket));
  }

  private async onConnection(socket: Socket) {
    const user = socket.data.user as JwtPayload;
    const serverIds = await this.allowedServerIds(user);
    serverIds.forEach((id) => socket.join(`server:${id}`));
    socket.join(`user:${user.sub}`);

    // 서버가 속한 에이전트 룸에도 구독 (시스템 리소스 수신)
    const agentIds = await this.allowedAgentIds(user);
    agentIds.forEach((id) => socket.join(`agent:${id}`));

    console.log(`[panel] 사용자 ${user.username} 연결 (서버 ${serverIds.length}개 구독)`);

    // 초기 상태 전송
    socket.emit('ready', { serverIds });

    socket.on('server:start', (p, ack) => this.relay(socket, user, p, 'manage', 'server:start', ack));
    socket.on('server:stop', (p, ack) => this.relay(socket, user, p, 'manage', 'server:stop', ack));
    socket.on('server:restart', (p, ack) => this.relay(socket, user, p, 'manage', 'server:restart', ack));
    socket.on('console:input', (p, ack) => this.relay(socket, user, p, 'console', 'console:input', ack));
    socket.on('console:history', async (p, ack) => {
      if (!p?.serverId) return ack?.({ ok: false, error: 'serverId 필요' });
      if (!(await hasServerPermission(user.sub, p.serverId, 'console'))) {
        return ack?.({ ok: false, error: '콘솔 권한이 없습니다' });
      }
      const result = await this.agents.rpcForServer(p.serverId, 'console:history', { count: p.count ?? 200 });
      ack?.(result);
    });

    socket.on('disconnect', () => {
      console.log(`[panel] 사용자 ${user.username} 연결 종료`);
    });
  }

  /** 서버 RPC 릴레이 + 권한 검사 */
  private async relay(
    socket: Socket,
    user: JwtPayload,
    p: any,
    required: 'console' | 'manage',
    type: string,
    ack?: (res: any) => void
  ) {
    if (!p?.serverId) return ack?.({ ok: false, error: 'serverId 필요' });
    if (!(await hasServerPermission(user.sub, p.serverId, required))) {
      return ack?.({ ok: false, error: `이 서버에 대한 ${required} 권한이 없습니다` });
    }
    const result = await this.agents.rpcForServer(p.serverId, type, p.payload ?? {});
    ack?.(result);
  }

  private async allowedServerIds(user: JwtPayload): Promise<string[]> {
    if (user.role === 'admin') {
      const rows = await query<{ id: string }>('SELECT id FROM servers');
      return rows.map((r) => r.id);
    }
    const rows = await query<{ server_id: string }>(
      'SELECT server_id FROM server_permissions WHERE user_id = $1',
      [user.sub]
    );
    return rows.map((r) => r.server_id);
  }

  private async allowedAgentIds(user: JwtPayload): Promise<string[]> {
    if (user.role === 'admin') {
      const rows = await query<{ id: string }>('SELECT id FROM agents');
      return rows.map((r) => r.id);
    }
    const rows = await query<{ agent_id: string }>(
      `SELECT DISTINCT s.agent_id FROM servers s
       JOIN server_permissions sp ON sp.server_id = s.id
       WHERE sp.user_id = $1`,
      [user.sub]
    );
    return rows.map((r) => r.agent_id);
  }
}
