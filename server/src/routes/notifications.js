// Kann-Ziel: Benachrichtigungen abrufen und als gelesen markieren.
import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../auth.js';
import { CATEGORIES, prefsOf, savePrefs, mailConfigured, sendMail } from '../mailer.js';

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

// E-Mail-Benachrichtigungen: eigene Einstellungen lesen und speichern.
function prefsResponse(uid) {
  const u = db.prepare('SELECT email, email_prefs, show_online FROM users WHERE id = ?').get(uid);
  return {
    email: u.email,
    mail_configured: mailConfigured,
    categories: CATEGORIES,
    prefs: prefsOf(u),
    show_online: u.show_online !== 0,
  };
}
router.get('/preferences', authRequired, (req, res) => res.json(prefsResponse(req.user.id)));

router.put('/preferences', authRequired, (req, res) => {
  const { prefs, show_online } = req.body || {};
  if (prefs) savePrefs(req.user.id, prefs);
  if (typeof show_online === 'boolean') {
    db.prepare('UPDATE users SET show_online = ? WHERE id = ?').run(show_online ? 1 : 0, req.user.id);
  }
  res.json(prefsResponse(req.user.id));
});

// Test-E-Mail an die eigene Adresse (hoechstens einmal pro Minute).
const lastTest = new Map();
router.post('/preferences/test', authRequired, async (req, res) => {
  if (!mailConfigured) return res.status(400).json({ error: 'Der E-Mail-Versand ist auf diesem Server noch nicht eingerichtet.' });
  if (Date.now() - (lastTest.get(req.user.id) || 0) < 60_000) {
    return res.status(429).json({ error: 'Bitte warte eine Minute bis zur nächsten Test-E-Mail.' });
  }
  lastTest.set(req.user.id, Date.now());
  const u = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id);
  try {
    const sent = await sendMail(u.email, 'stars: Test-E-Mail', [
      { title: 'E-Mail-Benachrichtigungen funktionieren', body: 'Diese Test-E-Mail wurde über dein Profil ausgelöst.', link: '/profile' },
    ]);
    if (!sent) return res.status(400).json({ error: 'An diese Adresse werden keine E-Mails verschickt (Demo-Konto).' });
    res.json({ ok: true, email: u.email });
  } catch (err) {
    console.error('[mail] Test fehlgeschlagen:', err.message || err);
    res.status(502).json({ error: 'Die E-Mail konnte nicht verschickt werden. Bitte stars informieren.' });
  }
});

export default router;
