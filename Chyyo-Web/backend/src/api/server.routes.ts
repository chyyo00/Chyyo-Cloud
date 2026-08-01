import { Router } from 'express';
import { query, queryOne } from '../database/pool';
import { requireAuth, requireAdmin, requireServerPermission, hasServerPermission } from '../middleware/auth';
import type { AgentGateway } from '../websocket/agentGateway';

const DANGEROUS = new Set(['op', 'deop', 'ban-ip', 'pardon-ip', 'whitelist']);

export function createServerRouter(agents: AgentGateway): Router {
  const router = Router();
  router.use(requireAuth);

  // ---- 목록 / CRUD ----

  /** 서버 목록 (권한 기반) */
  router.get('/', async (req, res) => {
    let servers;
    if (req.user!.role === 'admin') {
      servers = await query(
        `SELECT s.*, a.name AS agent_name, a.connected AS agent_connected
         FROM servers s JOIN agents a ON a.id = s.agent_id ORDER BY s.created_at`
      );
    } else {
      servers = await query(
        `SELECT s.*, a.name AS agent_name, a.connected AS agent_connected
         FROM servers s
         JOIN agents a ON a.id = s.agent_id
         JOIN server_permissions sp ON sp.server_id = s.id
         WHERE sp.user_id = $1
         ORDER BY s.created_at`,
        [req.user!.sub]
      );
    }
    const enriched = servers.map((s: any) => ({
      ...s,
      status: agents.getCachedStatus(s.id)?.state ?? s.status,
      uptimeSec: agents.getCachedStatus(s.id)?.uptimeSec ?? 0,
      players: agents.getCachedStatus(s.id)?.players ?? 0,
    }));
    res.json({ servers: enriched });
  });

  /** 서버 등록 (관리자) */
  router.post('/', requireAdmin, async (req, res) => {
    const { agentId, name, path, jarFile, javaArgs } = req.body ?? {};
    if (!agentId || !name || !path) {
      return res.status(400).json({ error: 'agentId, name, path가 필요합니다' });
    }
    const row = await queryOne(
      `INSERT INTO servers (agent_id, name, path, jar_file, java_args)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [agentId, name, path, jarFile || 'server.jar', javaArgs || '-Xms1G -Xmx2G']
    );
    await agents.pushServersToAgent(agentId);
    res.status(201).json({ server: row });
  });

  /** 서버 상세 */
  router.get('/:serverId', async (req, res) => {
    const { serverId } = req.params;
    if (!(await hasServerPermission(req.user!.sub, serverId, 'view'))) {
      return res.status(403).json({ error: '서버에 대한 권한이 없습니다' });
    }
    const server = await queryOne(
      `SELECT s.*, a.name AS agent_name, a.connected AS agent_connected
       FROM servers s JOIN agents a ON a.id = s.agent_id WHERE s.id = $1`,
      [serverId]
    );
    if (!server) return res.status(404).json({ error: '서버를 찾을 수 없습니다' });
    res.json({ server: { ...server, ...(agents.getCachedStatus(serverId) ?? {}) } });
  });

  /** 서버 수정 (관리자) */
  router.patch('/:serverId', requireAdmin, async (req, res) => {
    const { serverId } = req.params;
    const { name, path, jarFile, javaArgs, agentId } = req.body ?? {};
    const server = await queryOne('SELECT * FROM servers WHERE id = $1', [serverId]);
    if (!server) return res.status(404).json({ error: '서버를 찾을 수 없습니다' });

    const updated = await queryOne(
      `UPDATE servers SET
         name = $1, path = $2, jar_file = $3, java_args = $4,
         agent_id = COALESCE($5, agent_id), updated_at = now()
       WHERE id = $6 RETURNING *`,
      [
        name ?? server.name,
        path ?? server.path,
        jarFile ?? server.jar_file,
        javaArgs ?? server.java_args,
        agentId ?? null,
        serverId,
      ]
    );
    const targetAgent = agentId ?? server.agent_id;
    await agents.pushServersToAgent(targetAgent);
    res.json({ server: updated });
  });

  /** 서버 삭제 (관리자) */
  router.delete('/:serverId', requireAdmin, async (req, res) => {
    const { serverId } = req.params;
    const server = await queryOne<{ agent_id: string }>('SELECT agent_id FROM servers WHERE id = $1', [serverId]);
    if (!server) return res.status(404).json({ error: '서버를 찾을 수 없습니다' });
    await query('DELETE FROM servers WHERE id = $1', [serverId]);
    await agents.pushServersToAgent(server.agent_id);
    res.json({ ok: true });
  });

  // ---- 제어 ----

  router.post('/:serverId/start', requireServerPermission('manage'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'server:start', {}));
  });

  router.post('/:serverId/stop', requireServerPermission('manage'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'server:stop', {}));
  });

  router.post('/:serverId/restart', requireServerPermission('manage'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'server:restart', {}));
  });

  /** 콘솔 명령 전달 (위험 명령은 admin만) */
  router.post('/:serverId/command', requireServerPermission('console'), async (req, res) => {
    const { command } = req.body ?? {};
    if (!command) return res.status(400).json({ error: '명령어가 비어 있습니다' });
    const first = String(command).trim().toLowerCase().split(' ')[0];
    if (DANGEROUS.has(first) && req.user!.role !== 'admin') {
      return res.status(403).json({ error: '보안상 차단된 명령어입니다' });
    }
    res.json(await agents.rpcForServer(req.params.serverId, 'console:input', { command }));
  });

  /** 콘솔 히스토리 */
  router.get('/:serverId/console', requireServerPermission('console'), async (req, res) => {
    const count = Number(req.query.count ?? 200);
    res.json(await agents.rpcForServer(req.params.serverId, 'console:history', { count }));
  });

  // ---- 파일 관리 ----

  router.get('/:serverId/files', requireServerPermission('files'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'file:list', { path: req.query.path ?? '/' }));
  });

  router.get('/:serverId/files/read', requireServerPermission('files'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'file:read', { path: req.query.path }));
  });

  router.put('/:serverId/files/write', requireServerPermission('files'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'file:write', req.body));
  });

  router.delete('/:serverId/files', requireServerPermission('files'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'file:delete', { path: req.query.path }));
  });

  router.post('/:serverId/files/rename', requireServerPermission('files'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'file:rename', req.body));
  });

  router.post('/:serverId/files/mkdir', requireServerPermission('files'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'file:mkdir', req.body));
  });

  router.post('/:serverId/files/upload', requireServerPermission('files'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'file:upload', req.body));
  });

  router.get('/:serverId/files/download', requireServerPermission('files'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'file:download', { path: req.query.path }));
  });

  // ---- 백업 ----

  router.get('/:serverId/backups', requireServerPermission('manage'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'backup:list', {}));
  });

  router.post('/:serverId/backups', requireServerPermission('manage'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'backup:create', req.body));
  });

  router.post('/:serverId/backups/restore', requireServerPermission('manage'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'backup:restore', req.body));
  });

  router.delete('/:serverId/backups/:name', requireServerPermission('manage'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'backup:delete', { name: req.params.name }));
  });

  router.get('/:serverId/backups/:name/download', requireServerPermission('manage'), async (req, res) => {
    res.json(await agents.rpcForServer(req.params.serverId, 'backup:download', { name: req.params.name }));
  });

  // ---- 권한 관리 (관리자) ----

  /** 서버 사용자 권한 목록 */
  router.get('/:serverId/permissions', requireAdmin, async (req, res) => {
    const rows = await query(
      `SELECT sp.user_id, u.username, sp.permission
       FROM server_permissions sp JOIN users u ON u.id = sp.user_id
       WHERE sp.server_id = $1 ORDER BY u.username`,
      [req.params.serverId]
    );
    res.json({ permissions: rows });
  });

  /** 서버 사용자 권한 부여/수정 */
  router.put('/:serverId/permissions', requireAdmin, async (req, res) => {
    const { userId, permission } = req.body ?? {};
    if (!userId || !['view', 'console', 'files', 'manage'].includes(permission)) {
      return res.status(400).json({ error: 'userId와 유효한 permission이 필요합니다' });
    }
    await query(
      `INSERT INTO server_permissions (server_id, user_id, permission)
       VALUES ($1, $2, $3)
       ON CONFLICT (server_id, user_id) DO UPDATE SET permission = $3`,
      [req.params.serverId, userId, permission]
    );
    res.json({ ok: true });
  });

  /** 서버 사용자 권한 제거 */
  router.delete('/:serverId/permissions/:userId', requireAdmin, async (req, res) => {
    await query('DELETE FROM server_permissions WHERE server_id = $1 AND user_id = $2', [
      req.params.serverId,
      req.params.userId,
    ]);
    res.json({ ok: true });
  });

  return router;
}
