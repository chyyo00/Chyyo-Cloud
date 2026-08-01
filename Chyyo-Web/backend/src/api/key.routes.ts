import { Router } from 'express';
import { randomBytes, createHash } from 'crypto';
import { query, queryOne } from '../database/pool';
import { requireAuth } from '../middleware/auth';

export const keyRouter = Router();

const KEY_PREFIX = 'chyyo_';

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): string {
  return KEY_PREFIX + randomBytes(32).toString('base64url');
}

/** 내 API 키 목록 (원본은 노출하지 않음) */
keyRouter.get('/', requireAuth, async (req, res) => {
  const keys = await query(
    `SELECT id, name, prefix, last_used_at, created_at
     FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user!.sub]
  );
  res.json({ keys });
});

/** API 키 생성 — 원본 키는 이 응답에서만 확인 가능 */
keyRouter.post('/', requireAuth, async (req, res) => {
  const name = (req.body?.name ?? '').toString().trim();
  if (!name) return res.status(400).json({ error: '키 이름이 필요합니다' });
  if (name.length > 64) return res.status(400).json({ error: '키 이름은 64자 이하여야 합니다' });

  const key = generateApiKey();
  const row = await queryOne<{ id: string }>(
    `INSERT INTO api_keys (user_id, name, key_hash, prefix)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [req.user!.sub, name, hashApiKey(key), key.slice(0, 18)]
  );
  res.status(201).json({ key: row!.id, apiKey: key, name, message: '키는 이 요청에서만 확인할 수 있습니다' });
});

/** API 키 삭제(폐기) — 본인 키만 가능 */
keyRouter.delete('/:keyId', requireAuth, async (req, res) => {
  const result = await query<{ id: string }>(
    'DELETE FROM api_keys WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.keyId, req.user!.sub]
  );
  if (result.length === 0) {
    return res.status(404).json({ error: 'API 키를 찾을 수 없습니다' });
  }
  res.json({ ok: true });
});
