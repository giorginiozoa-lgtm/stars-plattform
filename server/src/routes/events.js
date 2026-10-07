// Iteration 3 – Veranstaltungen und Foerderplaetze (FA-26).
// Abgeleitet aus dem EEM-Feedback (Oktober 2026): Zugang zu Symposien ist fuer
// EMEs ohne Firmensponsoring schwierig. Die Plattform verwaltet nur Interesse
// und Antraege; ueber Kriterien und Vergabe entscheidet stars.
import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../auth.js';
import { notify } from '../helpers.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  const events = db
    .prepare(
      `SELECT e.*,
         (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id) AS interested_count,
         (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.scholarship = 1) AS scholarship_count,
         r.status AS my_status, r.scholarship AS my_scholarship, r.motivation AS my_motivation
       FROM events e
       LEFT JOIN event_registrations r ON r.event_id = e.id AND r.user_id = ?
       ORDER BY e.starts_on`
    )
    .all(req.user.id);
  res.json({ events });
});

// Interesse bekunden bzw. Foerderplatz beantragen (erneuter Aufruf aktualisiert).
router.post('/:id/register', (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Veranstaltung nicht gefunden' });
  const { scholarship, motivation } = req.body || {};
  if (scholarship && !motivation) return res.status(400).json({ error: 'Begründung für den Förderplatz erforderlich' });
  const status = scholarship ? 'requested' : 'interested';
  db.prepare(
    `INSERT INTO event_registrations (event_id, user_id, scholarship, motivation, status) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (event_id, user_id) DO UPDATE SET scholarship = excluded.scholarship,
       motivation = excluded.motivation, status = excluded.status`
  ).run(ev.id, req.user.id, scholarship ? 1 : 0, motivation || null, status);
  if (scholarship) {
    for (const a of db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all()) {
      notify(a.id, { type: 'system', title: 'Antrag auf Förderplatz', body: `${req.user.name}: ${ev.title_de}`, link: `/events?focus=reg-${ev.id}-${req.user.id}` });
    }
  }
  res.json({ ok: true, status });
});

router.post('/:id/withdraw', (req, res) => {
  db.prepare('DELETE FROM event_registrations WHERE event_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// Uebersicht fuer stars: alle Interessensbekundungen und Antraege.
router.get('/registrations', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Keine Berechtigung' });
  const registrations = db
    .prepare(
      `SELECT r.*, e.title_de, e.title_en, u.name, u.country, u.headline, u.avatar_seed, u.role
       FROM event_registrations r JOIN events e ON e.id = r.event_id JOIN users u ON u.id = r.user_id
       ORDER BY r.scholarship DESC, (r.status = 'requested') DESC, r.created_at DESC`
    )
    .all();
  res.json({ registrations });
});

router.post('/registrations/:eventId/:userId/decide', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Keine Berechtigung' });
  const { status } = req.body || {};
  if (!['granted', 'waitlist', 'declined'].includes(status)) return res.status(400).json({ error: 'Ungültiger Status' });
  const reg = db
    .prepare('SELECT r.*, e.title_de FROM event_registrations r JOIN events e ON e.id = r.event_id WHERE r.event_id = ? AND r.user_id = ?')
    .get(req.params.eventId, req.params.userId);
  if (!reg || !reg.scholarship) return res.status(404).json({ error: 'Antrag nicht gefunden' });
  db.prepare('UPDATE event_registrations SET status = ? WHERE event_id = ? AND user_id = ?').run(
    status, reg.event_id, reg.user_id
  );
  const label = { granted: 'gewährt', waitlist: 'auf der Warteliste', declined: 'abgelehnt' }[status];
  notify(reg.user_id, { type: 'system', title: `Förderplatz ${label}`, body: reg.title_de, link: `/events?focus=ev-${reg.event_id}` });
  res.json({ ok: true });
});

export default router;
