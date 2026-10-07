// Verzeichnis der Expert:innen/Mentor:innen mit Filter nach Fachgebiet.
import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../auth.js';
import { publicUser, userTags } from '../helpers.js';

const router = Router();

// Liste aller Mentor:innen (optional gefiltert nach ?tag=slug). Seit Iteration 3
// erscheinen auch Entrepreneurs, die ihre Erfahrung teilen (Peer-Expert:innen, FA-27).
router.get('/', authRequired, (req, res) => {
  const { tag } = req.query;
  let mentors = db
    .prepare(`SELECT * FROM users WHERE status = 'active' AND (role = 'mentor' OR (role = 'entrepreneur' AND offers_peer_support = 1)) ORDER BY role DESC, name`)
    .all();
  let list = mentors.map((m) => ({ ...publicUser(m), tags: userTags(m.id) }));
  if (tag) {
    list = list.filter((m) => m.tags.some((t) => t.slug === tag));
  }
  res.json({ mentors: list });
});

// Einzelprofil (fuer Mentor:innen und Entrepreneurs).
router.get('/:id', authRequired, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Profil nicht gefunden' });
  res.json({ user: publicUser(u), tags: userTags(u.id) });
});

export default router;
