import { Router } from 'express';
import { query } from '../database/pool';
import { requireAuth, requireAdmin } from '../middleware/auth';

export const userRouter = Router();

/** 사용자 목록 (관리자 — 권한 부여 화면용) */
userRouter.get('/', requireAuth, requireAdmin, async (_req, res) => {
  const users = await query(
    `SELECT id, username, role, created_at
     FROM users ORDER BY created_at`
  );
  res.json({ users });
});

/** 사용자 역할 변경 (관리자) */
userRouter.patch('/:userId/role', requireAuth, requireAdmin, async (req, res) => {
  const { role } = req.body ?? {};
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: '유효하지 않은 역할입니다' });
  }
  await query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.userId]);
  res.json({ ok: true });
});

/** 사용자 삭제 (관리자) */
userRouter.delete('/:userId', requireAuth, requireAdmin, async (req, res) => {
  await query('DELETE FROM users WHERE id = $1', [req.params.userId]);
  res.json({ ok: true });
});
