// Wer ist gerade online? (nur Personen, die ihren Online-Status teilen)
import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../auth.js';
import { publicUser } from '../helpers.js';
import { ONLINE_WINDOW_S } from '../presence.js';

const router = Router();

router.get('/online', authRequired, (req, res) => {
  const users = db
    .prepare(
      `SELECT * FROM users
       WHERE id != ? AND status = 'active' AND show_online != 0
         AND last_seen_at >= datetime('now', ?)
       ORDER BY last_seen_at DESC LIMIT 50`
    )
    .all(req.user.id, `-${ONLINE_WINDOW_S} seconds`)
    .map(publicUser);
  res.json({ users });
});

export default router;
