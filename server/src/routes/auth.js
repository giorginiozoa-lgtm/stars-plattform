// Auth-Endpunkte: Registrierung, Login, aktuelles Profil, Tag-Zuordnung.
import { Router } from 'express';
import { db, withTx } from '../db.js';
import { hashPassword, verifyPassword, signToken, authRequired, statusMessage } from '../auth.js';
import { publicUser, userTags, notify } from '../helpers.js';

// Neue Registrierungen muessen von stars freigegeben werden (abschaltbar fuer lokale Tests).
const REQUIRE_APPROVAL = process.env.REQUIRE_APPROVAL !== 'false';

const router = Router();

router.post('/register', (req, res) => {
  const { email, password, name, role, country, region, headline, bio, languages, signup_note } = req.body || {};
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'email, password, name und role sind erforderlich' });
  }
  // Admin-Konten entstehen nur ueber den Seed bzw. die Datenbank, nie per
  // Selbstregistrierung (wichtig fuer den oeffentlichen Testbetrieb).
  if (!['entrepreneur', 'mentor'].includes(role)) {
    return res.status(400).json({ error: 'Ungültige Rolle' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'E-Mail bereits registriert' });

  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, name, role, country, region, headline, bio, languages, avatar_seed, status, signup_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      email,
      hashPassword(password),
      name,
      role,
      country || null,
      region || null,
      headline || null,
      bio || null,
      Array.isArray(languages) ? languages.join(',') : languages || 'en',
      name,
      REQUIRE_APPROVAL ? 'pending' : 'active',
      signup_note ? String(signup_note).slice(0, 1000) : null
    );

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  if (REQUIRE_APPROVAL) {
    for (const a of db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all()) {
      notify(a.id, {
        type: 'system', title: 'Neue Registrierung zur Freigabe',
        body: `${name} (${role === 'mentor' ? 'Expert:in' : 'Entrepreneur:in'})`, link: '/registrations',
      });
    }
    return res.status(202).json({ pending: true, message: statusMessage('pending') });
  }
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });
  }
  if ((user.status || 'active') !== 'active') {
    return res.status(403).json({ error: statusMessage(user.status), code: user.status });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  res.json({ user: publicUser(user), tags: userTags(user.id) });
});

// Profil aktualisieren (inkl. Sprache/Bio/Headline).
router.patch('/me', authRequired, (req, res) => {
  const { name, country, region, headline, bio, languages, support_roles, capacity_hours, available,
    offers_peer_support } = req.body || {};
  const roles = Array.isArray(support_roles)
    ? support_roles.filter((r) => ['lead_mentor', 'expert', 'connector'].includes(r)).join(',')
    : null;
  const capacity =
    capacity_hours === undefined || capacity_hours === null || capacity_hours === ''
      ? null
      : Math.max(0, Math.min(80, Number(capacity_hours) || 0));
  db.prepare(
    `UPDATE users SET
       name = COALESCE(?, name),
       country = COALESCE(?, country),
       region = COALESCE(?, region),
       headline = COALESCE(?, headline),
       bio = COALESCE(?, bio),
       languages = COALESCE(?, languages),
       support_roles = COALESCE(?, support_roles),
       capacity_hours = COALESCE(?, capacity_hours),
       available = COALESCE(?, available),
       offers_peer_support = COALESCE(?, offers_peer_support)
     WHERE id = ?`
  ).run(
    name ?? null,
    country ?? null,
    region ?? null,
    headline ?? null,
    bio ?? null,
    Array.isArray(languages) ? languages.join(',') : languages ?? null,
    roles,
    capacity,
    available === undefined ? null : available ? 1 : 0,
    offers_peer_support === undefined ? null : offers_peer_support ? 1 : 0,
    req.user.id
  );
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user), tags: userTags(user.id) });
});

// Eigene Fachgebiete/Interessen setzen (ersetzt die bestehende Auswahl).
router.put('/me/tags', authRequired, (req, res) => {
  const { tags } = req.body || {}; // [{ tag_id, weight }]
  if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags-Array erwartet' });
  const del = db.prepare('DELETE FROM user_tags WHERE user_id = ?');
  const ins = db.prepare(
    'INSERT INTO user_tags (user_id, tag_id, weight) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
  );
  withTx(() => {
    del.run(req.user.id);
    for (const t of tags) ins.run(req.user.id, t.tag_id, Math.min(5, Math.max(1, t.weight || 3)));
  });
  res.json({ tags: userTags(req.user.id) });
});

export default router;
