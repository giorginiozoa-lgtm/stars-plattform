// Iteration 3 – Feedback an das Entwicklungsteam (FA-28).
// Laufender Evaluationskanal fuer die Testprojekte (Build-Measure-Learn):
// Nutzer:innen melden Fehler, Ideen und Usability-Probleme direkt aus der
// Plattform; die Administration triagiert und antwortet.
import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../auth.js';
import { notify } from '../helpers.js';

const router = Router();
router.use(authRequired);

const CATEGORIES = ['bug', 'idea', 'usability', 'praise', 'other'];
const STATUSES = ['new', 'in_progress', 'done'];

router.get('/', (req, res) => {
  const all = req.user.role === 'admin';
  const feedback = db
    .prepare(
      `SELECT f.*, u.name AS user_name, u.role AS user_role
       FROM feedback f LEFT JOIN users u ON u.id = f.user_id
       ${all ? '' : 'WHERE f.user_id = ?'}
       ORDER BY (f.status = 'new') DESC, f.created_at DESC`
    )
    .all(...(all ? [] : [req.user.id]));
  res.json({ feedback });
});

router.post('/', (req, res) => {
  const { category, area, rating, body, page } = req.body || {};
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Ungültige Kategorie' });
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'Beschreibung erforderlich' });
  const r = rating ? Math.max(1, Math.min(5, Number(rating) || 0)) || null : null;
  const info = db
    .prepare('INSERT INTO feedback (user_id, category, area, rating, body, page) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, category, area || null, r, String(body).slice(0, 5000), page ? String(page).slice(0, 200) : null);
  for (const a of db.prepare(`SELECT id FROM users WHERE role = 'admin' AND id != ?`).all(req.user.id)) {
    notify(a.id, { type: 'system', title: 'Neues Feedback', body: `${req.user.name}: ${String(body).slice(0, 80)}`, link: `/feedback?focus=${info.lastInsertRowid}` });
  }
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

router.patch('/:id', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Keine Berechtigung' });
  const fb = db.prepare('SELECT * FROM feedback WHERE id = ?').get(req.params.id);
  if (!fb) return res.status(404).json({ error: 'Feedback nicht gefunden' });
  const { status, response } = req.body || {};
  if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Ungültiger Status' });
  db.prepare(
    `UPDATE feedback SET status = COALESCE(?, status), response = COALESCE(?, response), updated_at = datetime('now') WHERE id = ?`
  ).run(status || null, response ?? null, fb.id);
  if (fb.user_id && response && response !== fb.response) {
    notify(fb.user_id, { type: 'system', title: 'Antwort auf dein Feedback', body: String(response).slice(0, 80), link: `/feedback?focus=${fb.id}` });
  }
  res.json({ feedback: db.prepare('SELECT * FROM feedback WHERE id = ?').get(fb.id) });
});

export default router;
