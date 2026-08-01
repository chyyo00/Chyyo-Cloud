import { randomBytes, createHash } from 'crypto';
import { query, queryOne } from '../database/pool';
import { hashPassword } from '../auth/password';
import { env } from '../config/env';

/** 부트 시 관리자 계정 보장 (schema.sql의 스키마 실행 후 호출) */
export async function bootstrapAdmin() {
  const existing = await queryOne('SELECT id FROM users WHERE username = $1', ['admin']);
  if (existing) {
    await query('UPDATE users SET password_hash = $1 WHERE username = $2', [
      hashPassword(env.adminPassword),
      'admin',
    ]);
    console.log('[db] admin 계정 비밀번호가 초기화되었습니다');
  } else {
    await query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [
      'admin',
      hashPassword(env.adminPassword),
      'admin',
    ]);
    console.log('[db] admin 계정이 생성되었습니다');
  }
}

/** 새 에이전트 등록: 토큰 생성(1회 노출) + 해시 저장 */
export async function createAgent(name: string) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const row = await queryOne<{ id: string; created_at: string }>(
    'INSERT INTO agents (id, name, token_hash) VALUES (gen_random_uuid(), $1, $2) RETURNING id, created_at',
    [name, tokenHash]
  );
  return { agent: row, token };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
