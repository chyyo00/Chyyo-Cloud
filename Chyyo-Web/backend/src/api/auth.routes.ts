import { Router } from 'express';
import { query, queryOne } from '../database/pool';
import { hashPassword, verifyPassword } from '../auth/password';
import { signToken } from '../auth/jwt';
import { requireAuth } from '../middleware/auth';

export const authRouter = Router();

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  created_at: Date;
}

/** 회원가입 */
authRouter.post('/register', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username과 password가 필요합니다' });
  }
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
    return res.status(400).json({ error: '아이디는 3~32자의 영문/숫자/언더바만 가능합니다' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다' });
  }
  const existing = await queryOne('SELECT id FROM users WHERE username = $1', [username]);
  if (existing) return res.status(409).json({ error: '이미 사용 중인 아이디입니다' });

  const user = await queryOne<UserRow>(
    'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
    [username, hashPassword(password), 'user']
  );
  const token = signToken({ sub: user!.id, username: user!.username, role: user!.role as 'admin' | 'user' });
  res.status(201).json({ token, user: publicUser(user!) });
});

/** 로그인 */
authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요' });

  const user = await queryOne<UserRow>('SELECT * FROM users WHERE username = $1', [username]);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' });
  }
  const token = signToken({ sub: user.id, username: user.username, role: user.role as 'admin' | 'user' });
  res.json({ token, user: publicUser(user) });
});

/** 내 정보 */
authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [req.user!.sub]);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
  res.json({ user: publicUser(user) });
});

/** 프로필 변경 (비밀번호) */
authRouter.patch('/profile', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: '새 비밀번호는 최소 6자 이상이어야 합니다' });
  }
  const user = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [req.user!.sub]);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
  if (currentPassword && !verifyPassword(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다' });
  }
  await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
    hashPassword(newPassword),
    user.id,
  ]);
  res.json({ ok: true });
});

function publicUser(u: UserRow) {
  return { id: u.id, username: u.username, role: u.role, createdAt: u.created_at };
}
