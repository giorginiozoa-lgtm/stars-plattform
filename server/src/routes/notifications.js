// Kann-Ziel: Benachrichtigungen abrufen und als gelesen markieren.
import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../auth.js';

const router = Router();

router.get('/', authRequired, (req, res) => {
  const items = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50')
    .all(req.user.id);
  const unread = db
    .prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL')
    .get(req.user.id).n;
  res.json({ notifications: items, unread });
});

router.post('/:id/read', authRequired, (req, res) => {
  db.prepare(
    `UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?`
  ).run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.post('/read-all', authRequired, (req, res) => {
  db.prepare(
    `UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`
  ).run(req.user.id);
  res.json({ ok: true });
});

export default router;
