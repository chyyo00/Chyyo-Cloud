import { randomBytes, createHash } from 'crypto';
import { query, queryOne } from './pool';
import { hashPassword } from '../auth/password';
import { env } from '../config/env';

/** Create the initial admin account once; never reset an existing password on restart. */
export async function bootstrapAdmin() {
  const existing = await queryOne('SELECT id FROM users WHERE username = $1', ['admin']);
  if (existing) {
    console.log('[db] admin account already exists; password left unchanged');
    return;
  }

  await query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [
    'admin',
    hashPassword(env.adminPassword),
    'admin',
  ]);
  console.log('[db] initial admin account created');
}

/** Create an agent with a one-time token and store only its hash. */
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
