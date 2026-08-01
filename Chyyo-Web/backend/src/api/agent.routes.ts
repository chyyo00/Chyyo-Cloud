import { Router } from 'express';
import { query, queryOne } from '../database/pool';
import { createAgent, hashToken } from '../database/init';
import { requireAuth, requireAdmin } from '../middleware/auth';

export const agentRouter = Router();

/** Agent 헤더 토큰 검증 */
async function agentFromRequest(req: any): Promise<{ id: string } | null> {
  const token = req.headers['x-agent-token'] as string | undefined;
  if (!token) return null;
  return queryOne<{ id: string }>(
    'SELECT id FROM agents WHERE token_hash = $1',
    [hashToken(token)]
  );
}

// ---- Agent(데몬)가 호출하는 REST API ----

/** Agent 등록 확인 (WebSocket hello 외 REST 폴백) */
agentRouter.post('/register', async (req, res) => {
  const agent = await agentFromRequest(req);
  if (!agent) return res.status(401).json({ ok: false, error: '유효하지 않은 에이전트 토큰' });
  await query('UPDATE agents SET connected = true, last_seen = now() WHERE id = $1', [agent.id]);
  res.json({ ok: true, agentId: agent.id });
});

/** Agent에 할당된 서버 목록 반환 */
agentRouter.get('/servers', async (req, res) => {
  const agent = await agentFromRequest(req);
  if (!agent) return res.status(401).json({ error: '유효하지 않은 에이전트 토큰' });

  const servers = await query(
    'SELECT id, name, path, jar_file, java_args FROM servers WHERE agent_id = $1 ORDER BY created_at',
    [agent.id]
  );
  res.json({
    ok: true,
    servers: servers.map((s: any) => ({
      id: s.id,
      name: s.name,
      path: s.path,
      jarFile: s.jar_file,
      javaArgs: s.java_args,
    })),
  });
});

// ---- 관리자가 사용하는 에이전트 관리 API ----

/** 에이전트 목록 */
agentRouter.get('/', requireAuth, requireAdmin, async (_req, res) => {
  const agents = await query(
    `SELECT a.id, a.name, a.connected, a.last_seen, a.created_at,
            (SELECT count(*)::int FROM servers s WHERE s.agent_id = a.id) AS server_count
     FROM agents a ORDER BY a.created_at`
  );
  res.json({ agents });
});

/** 에이전트 등록 — 반환된 토큰은 1회만 노출되므로 반드시 저장 */
agentRouter.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: '에이전트 이름이 필요합니다' });
  const { agent, token } = await createAgent(name);
  res.status(201).json({ agent, token, message: '토큰은 이 요청에서만 확인할 수 있습니다' });
});

/** 에이전트 삭제 (할당된 서버도 삭제) */
agentRouter.delete('/:agentId', requireAuth, requireAdmin, async (req, res) => {
  await query('DELETE FROM agents WHERE id = $1', [req.params.agentId]);
  res.json({ ok: true });
});
