import { NextFunction, Request, Response } from 'express';
import { JwtPayload, verifyToken } from '../auth/jwt';
import { query, queryOne } from '../database/pool';
import { createHash } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const PERMISSION_LEVEL: Record<string, number> = {
  view: 1,
  console: 2,
  files: 3,
  manage: 4,
};

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Bearer 토큰 인증 — JWT 또는 API 키(chyyo_ 접두사)를 모두 허용 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증이 필요합니다' });
  }
  const token = header.slice(7).trim();

  // API 키 (chyyo_ 접두사)
  if (token.startsWith('chyyo_')) {
    try {
      const key = await queryOne<{ user_id: string; username: string; role: string }>(
        `SELECT k.user_id, u.username, u.role
         FROM api_keys k JOIN users u ON u.id = k.user_id
         WHERE k.key_hash = $1`,
        [hashApiKey(token)]
      );
      if (!key) return res.status(401).json({ error: '유효하지 않은 API 키입니다' });
      req.user = { sub: key.user_id, username: key.username, role: key.role as 'admin' | 'user' };
      void query('UPDATE api_keys SET last_used_at = now() WHERE user_id = $1 AND key_hash = $2', [
        key.user_id,
        hashApiKey(token),
      ]);
      return next();
    } catch (e) {
      return res.status(500).json({ error: '서버 내부 오류' });
    }
  }

  // JWT
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다' });
  }
  try {
    const currentUser = await queryOne<{ username: string; role: string }>(
      'SELECT username, role FROM users WHERE id = $1',
      [payload.sub]
    );
    if (!currentUser) return res.status(401).json({ error: '유효하지 않은 토큰입니다' });
    req.user = { ...payload, username: currentUser.username, role: currentUser.role as 'admin' | 'user' };
  } catch {
    return res.status(500).json({ error: '서버 내부 오류' });
  }
  next();
}

/** 관리자 권한 필요 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '관리자 권한이 필요합니다' });
  }
  next();
}

export interface ServerPermissionRow {
  permission: string;
  agent_id: string;
}

/** 사용자가 서버에 대해 최소 권한 이상을 갖는지 확인 */
export async function hasServerPermission(
  userId: string,
  serverId: string,
  required: string
): Promise<boolean> {
  const user = await queryOne<{ role: string }>(
    'SELECT role FROM users WHERE id = $1',
    [userId]
  );
  if (user?.role === 'admin') return true;

  const perm = await queryOne<{ permission: string }>(
    'SELECT permission FROM server_permissions WHERE server_id = $1 AND user_id = $2',
    [serverId, userId]
  );
  if (!perm) return false;
  return (PERMISSION_LEVEL[perm.permission] ?? 0) >= (PERMISSION_LEVEL[required] ?? 0);
}

/** 서버 권한 미들웨어 팩토리 */
export function requireServerPermission(required: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { serverId } = req.params;
    if (!req.user) return res.status(401).json({ error: '인증이 필요합니다' });
    const ok = await hasServerPermission(req.user.sub, serverId, required);
    if (!ok) {
      return res.status(403).json({ error: `이 서버에 대한 ${required} 권한이 없습니다` });
    }
    next();
  };
}
