import type { Namespace, Server, Socket } from 'socket.io';
import { createHash } from 'crypto';
import { query, queryOne } from '../database/pool';

export interface RpcResult {
  ok: boolean;
  data?: any;
  error?: string;
}

interface AgentConn {
  socket: Socket;
  name: string;
}

interface AgentStats {
  cpuPercent: number;
  ramUsedMb: number;
  ramTotalMb: number;
  diskUsedMb: number;
  diskTotalMb: number;
  netUpKbps: number;
  netDownKbps: number;
  ts: number;
}

/**
 * Chyyo-Agent(데몬)와의 Socket.IO 통신 게이트웨이.
 * - Agent 인증(토큰) 및 연결 관리
 * - Agent로 RPC 명령 전송 (start/stop/console/file/backup)
 * - Agent 이벤트(status/console/stats/backup)를 패널 네임스페이스로 브로드캐스트
 */
export class AgentGateway {
  private agents = new Map<string, AgentConn>();
  private agentStats = new Map<string, AgentStats>();
  private serverStatus = new Map<string, any>();
  private serverConsole = new Map<string, { line: string; ts: number }[]>();

  constructor(private io: Server, private agentIo: Namespace, private panelIo: Namespace) {}

  init() {
    this.agentIo.on('connection', (socket) => {
      socket.on('hello', (payload, ack) => this.handleHello(socket, payload, ack));
      socket.on('server:status', (p) => this.handleServerStatus(socket, p));
      socket.on('console:log', (p) => this.handleConsoleLog(socket, p));
      socket.on('agent:stats', (p) => this.handleAgentStats(socket, p));
      socket.on('backup:done', (p) => this.handleBackupDone(socket, p));
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  private async handleHello(socket: Socket, payload: any, ack?: (res: any) => void) {
    const token = payload?.token;
    if (!token) {
      ack?.({ ok: false, error: '토큰이 없습니다' });
      socket.disconnect();
      return;
    }
    try {
      const tokenHash = sha256(String(token));
      const agent = await queryOne<{ id: string; name: string }>(
        'SELECT id, name FROM agents WHERE token_hash = $1',
        [tokenHash]
      );
      if (!agent) {
        ack?.({ ok: false, error: '유효하지 않은 에이전트 토큰입니다' });
        socket.disconnect();
        return;
      }

      const agentId = agent.id;
      this.agents.set(agentId, { socket, name: agent.name });
      socket.data.agentId = agentId;

      // config.json의 agent.name이 DB와 다르면 동기화 (웹 표시 이름 최신화)
      const announcedName = payload?.name?.toString().trim();
      if (announcedName && announcedName !== agent.name) {
        await query('UPDATE agents SET name = $1 WHERE id = $2', [announcedName, agentId]);
        this.agents.set(agentId, { socket, name: announcedName });
        console.log(`[agent] ${agent.name} → ${announcedName} 이름 동기화`);
        agent.name = announcedName;
      }

      await query('UPDATE agents SET connected = true, last_seen = now() WHERE id = $1', [agentId]);

      ack?.({ ok: true, agentId });

      // 등록된 서버 구성 전달
      void this.pushServersToAgent(agentId).catch((e) => {
        console.error('[agent] 서버 구성 전달 실패:', (e as Error).message);
      });

      console.log(`[agent] ${agent.name}(${agentId}) 연결됨`);
    } catch (e) {
      console.error('[agent] hello 처리 중 오류:', (e as Error).message);
      ack?.({ ok: false, error: '서버 내부 오류' });
    }
  }

  private handleDisconnect(socket: Socket) {
    const agentId = socket.data.agentId as string | undefined;
    if (!agentId) return;
    this.agents.delete(agentId);
    query('UPDATE agents SET connected = false WHERE id = $1', [agentId]).catch((e) => {
      console.error('[db] 연결 해제 기록 실패:', (e as Error).message);
    });
    console.log(`[agent] ${agentId} 연결 종료`);
  }

  // ---- RPC: 패널 -> 에이전트 ----

  /** 특정 에이전트로 RPC 명령 전송 (ack 대기) */
  rpc(agentId: string, type: string, payload: any, timeoutMs = 20000): Promise<RpcResult> {
    const conn = this.agents.get(agentId);
    if (!conn) return Promise.resolve({ ok: false, error: '에이전트가 오프라인입니다' });
    return new Promise((resolve) => {
      conn.socket.timeout(timeoutMs).emit(
        'rpc',
        { type, payload },
        (err: any, response: any) => {
          if (err) resolve({ ok: false, error: '에이전트 응답 없음 (타임아웃)' });
          else if (!response) resolve({ ok: false, error: '응답 없음' });
          else resolve(response as RpcResult);
        }
      );
    });
  }

  /** 서버를 소유한 에이전트를 찾아 RPC 전송 */
  async rpcForServer(serverId: string, type: string, payload: any): Promise<RpcResult> {
    const server = await queryOne<{ agent_id: string }>(
      'SELECT agent_id FROM servers WHERE id = $1',
      [serverId]
    );
    if (!server) return { ok: false, error: '서버를 찾을 수 없습니다' };
    return this.rpc(server.agent_id, type, { ...payload, serverId });
  }

  /** 에이전트가 관리할 서버 목록을 재전송 (등록/변경 시) */
  async pushServersToAgent(agentId: string) {
    const servers = await query<{
      id: string;
      name: string;
      path: string;
      jar_file: string;
      java_args: string;
    }>('SELECT id, name, path, jar_file, java_args FROM servers WHERE agent_id = $1', [agentId]);

    const defs = servers.map((s) => ({
      id: s.id,
      name: s.name,
      path: s.path,
      jarFile: s.jar_file,
      javaArgs: s.java_args,
    }));

    await this.rpc(agentId, 'servers:apply', { servers: defs });
  }

  // ---- 에이전트 이벤트 수신 -> 캐시 + 패널 브로드캐스트 ----

  private handleServerStatus(socket: Socket, p: any) {
    const agentId = socket.data.agentId;
    this.serverStatus.set(p.serverId, p);
    this.panelIo.to(`server:${p.serverId}`).emit('server:status', { ...p, agentId });
  }

  private handleConsoleLog(socket: Socket, p: any) {
    const buffer = this.serverConsole.get(p.serverId) ?? [];
    buffer.push({ line: p.line, ts: p.ts });
    if (buffer.length > 1000) buffer.splice(0, buffer.length - 1000);
    this.serverConsole.set(p.serverId, buffer);
    this.panelIo.to(`server:${p.serverId}`).emit('console:log', p);
  }

  private handleAgentStats(socket: Socket, p: AgentStats) {
    const agentId = socket.data.agentId;
    if (!agentId) return;
    this.agentStats.set(agentId, p);
    this.panelIo.to(`agent:${agentId}`).emit('agent:stats', { agentId, ...p });
  }

  private async handleBackupDone(socket: Socket, p: any) {
    const agentId = socket.data.agentId;
    this.panelIo.to(`server:${p.serverId}`).emit('backup:done', { ...p, agentId });
    try {
      await query(
        `INSERT INTO backups (server_id, name, size_bytes, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [p.serverId, p.fileName, p.sizeBytes, p.status]
      );
    } catch (e) {
      console.error('[db] 백업 기록 실패:', (e as Error).message);
    }
  }

  // ---- 접근자 ----

  getCachedStatus(serverId: string): any {
    return this.serverStatus.get(serverId);
  }

  getCachedConsole(serverId: string): { line: string; ts: number }[] {
    return this.serverConsole.get(serverId) ?? [];
  }

  getAgentStats(agentId: string): AgentStats | undefined {
    return this.agentStats.get(agentId);
  }

  isAgentOnline(agentId: string): boolean {
    return this.agents.has(agentId);
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
