// Freigabe neuer Registrierungen durch stars (Administration).
// Neue Konten starten mit Status 'pending' und koennen sich erst nach der
// Freigabe anmelden; stars kann Konten auch ablehnen bzw. wieder sperren.
import { Router } from 'express';
import { db } from '../db.js';
import { authRequired, requireRole } from '../auth.js';
import { notify } from '../helpers.js';

const router = Router();
router.use(authRequired, requireRole('admin'));

router.get('/', (_req, res) => {
  const users = db
    .prepare(
      `SELECT id, email, name, role, country, headline, signup_note, status, created_at, reviewed_at, can_view_analytics
       FROM users ORDER BY (status = 'pending') DESC, created_at DESC`
    )
    .all();
  res.json({ users });
});

// Freigeben ('active'), ablehnen/sperren ('rejected') oder zuruecksetzen ('pending');
// optional mit Korrektur der Rolle (Entrepreneur:in / Expert:in).
router.post('/:id/status', (req, res) => {
  const { status, role } = req.body || {};
  if (!['active', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Ungültiger Status' });
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Konto nicht gefunden' });
  if (u.role === 'admin') return res.status(400).json({ error: 'Admin-Konten können hier nicht geändert werden' });
  const newRole = ['entrepreneur', 'mentor'].includes(role) ? role : u.role;
  db.prepare(`UPDATE users SET status = ?, role = ?, reviewed_at = datetime('now') WHERE id = ?`).run(status, newRole, u.id);
  if (status === 'active' && u.status !== 'active') {
    notify(u.id, {
      type: 'system', title: 'Willkommen bei stars!',
      body: 'Dein Konto wurde freigegeben. Tritt einer Community bei, um loszulegen.', link: '/communities',
    });
  }
  res.json({ ok: true });
});

// Lesezugriff auf das KPI-Dashboard erteilen oder entziehen (ohne Admin-Rechte).
router.post('/:id/analytics', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Konto nicht gefunden' });
  if (u.role === 'admin') return res.status(400).json({ error: 'Admin-Konten haben bereits Zugriff' });
  const enabled = !!(req.body || {}).enabled;
  db.prepare('UPDATE users SET can_view_analytics = ? WHERE id = ?').run(enabled ? 1 : 0, u.id);
  if (enabled && !u.can_view_analytics) {
    notify(u.id, { type: 'system', title: 'Zugriff auf das KPI-Dashboard', body: 'stars hat dir Lesezugriff auf das KPI-Dashboard gegeben.', link: '/analytics' });
  }
  res.json({ ok: true });
});

export default router;
