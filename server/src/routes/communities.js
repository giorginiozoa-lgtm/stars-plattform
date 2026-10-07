// Iteration 2 – Communities of Practice (FA-20, DP10): moderierte Gruppen mit
// gemeinsamer Domaene, Peer-Austausch und terminierten Knowledge-Sharing-
// Sessions. Communities sind der Normalfall der Unterstuetzung; das 1:1-Matching
// der Support Journey bleibt die gezielte Ergaenzung.
import { Router } from 'express';
import { db, withTx } from '../db.js';
import { authRequired } from '../auth.js';
import { notify } from '../helpers.js';

const router = Router();
router.use(authRequired);

const FORMATS = ['peer_session', 'roundtable', 'masterclass', 'pitch_learn'];

function membership(communityId, userId) {
  return db.prepare('SELECT role FROM community_members WHERE community_id = ? AND user_id = ?').get(communityId, userId);
}

function canModerate(req, communityId) {
  return req.user.role === 'admin' || membership(communityId, req.user.id)?.role === 'moderator';
}

const listSql = `
  SELECT c.*, t.slug AS tag_slug, t.name_de AS tag_name_de, t.name_en AS tag_name_en, t.category AS tag_category,
    (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id) AS member_count,
    (SELECT COUNT(*) FROM community_posts p WHERE p.community_id = c.id) AS post_count,
    (SELECT MIN(starts_at) FROM community_sessions s WHERE s.community_id = c.id AND s.starts_at >= strftime('%Y-%m-%d %H:%M','now')) AS next_session,
    (SELECT role FROM community_members m WHERE m.community_id = c.id AND m.user_id = ?) AS my_role
  FROM communities c LEFT JOIN tags t ON t.id = c.tag_id`;

router.get('/', (req, res) => {
  const communities = db.prepare(`${listSql} ORDER BY member_count DESC, c.name_de`).all(req.user.id);
  res.json({ communities });
});

// Vorschlaege passender Communities zu einer Tag-Auswahl (z.B. aus einer Frage).
router.get('/suggest', (req, res) => {
  const ids = String(req.query.tagIds || '')
    .split(',')
    .map(Number)
    .filter(Boolean);
  if (!ids.length) return res.json({ communities: [] });
  const communities = db
    .prepare(`${listSql} WHERE c.tag_id IN (${ids.map(() => '?').join(',')}) ORDER BY member_count DESC`)
    .all(req.user.id, ...ids);
  res.json({ communities });
});

router.post('/', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Keine Berechtigung' });
  const { name_de, name_en, description_de, description_en, tag_id } = req.body || {};
  if (!name_de) return res.status(400).json({ error: 'name_de erforderlich' });
  const slug = name_de.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
  const info = db
    .prepare(
      `INSERT INTO communities (slug, name_de, name_en, description_de, description_en, tag_id) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(slug, name_de, name_en || name_de, description_de || null, description_en || description_de || null, tag_id || null);
  db.prepare(`INSERT INTO community_members (community_id, user_id, role) VALUES (?, ?, 'moderator')`).run(
    info.lastInsertRowid, req.user.id
  );
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

router.get('/:id', (req, res) => {
  const community = db.prepare(`${listSql} WHERE c.id = ?`).get(req.user.id, req.params.id);
  if (!community) return res.status(404).json({ error: 'Community nicht gefunden' });
  const members = db
    .prepare(
      `SELECT u.id, u.name, u.role AS user_role, u.country, u.headline, u.avatar_seed, m.role
       FROM community_members m JOIN users u ON u.id = m.user_id
       WHERE m.community_id = ? ORDER BY m.role DESC, u.name`
    )
    .all(req.params.id);
  const sessions = db
    .prepare(
      `SELECT s.*, u.name AS host_name,
        (SELECT COUNT(*) FROM session_attendees a WHERE a.session_id = s.id) AS attendee_count,
        EXISTS(SELECT 1 FROM session_attendees a WHERE a.session_id = s.id AND a.user_id = ?) AS attending
       FROM community_sessions s LEFT JOIN users u ON u.id = s.host_id
       WHERE s.community_id = ? ORDER BY s.starts_at DESC`
    )
    .all(req.user.id, req.params.id);
  const posts = db
    .prepare(
      `SELECT p.id, p.body, p.created_at, u.id AS author_id, u.name AS author_name, u.role AS author_role,
              u.avatar_seed AS author_avatar
       FROM community_posts p JOIN users u ON u.id = p.author_id
       WHERE p.community_id = ? ORDER BY p.created_at DESC LIMIT 100`
    )
    .all(req.params.id);
  // Iteration 3: Slot-Antraege (Moderation sieht alle, Mitglieder ihre eigenen).
  const mod = canModerate(req, Number(req.params.id));
  const sessionRequests = db
    .prepare(
      `SELECT r.*, u.name AS requester_name, u.avatar_seed AS requester_avatar
       FROM session_requests r JOIN users u ON u.id = r.requester_id
       WHERE r.community_id = ? ${mod ? '' : 'AND r.requester_id = ?'}
       ORDER BY (r.status = 'pending') DESC, r.created_at DESC`
    )
    .all(...(mod ? [req.params.id] : [req.params.id, req.user.id]));
  res.json({ community, members, sessions, posts, sessionRequests, canModerate: mod });
});

router.post('/:id/join', (req, res) => {
  const c = db.prepare('SELECT id FROM communities WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Community nicht gefunden' });
  db.prepare('INSERT INTO community_members (community_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(
    req.params.id, req.user.id
  );
  res.json({ ok: true });
});

router.post('/:id/leave', (req, res) => {
  db.prepare('DELETE FROM community_members WHERE community_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.post('/:id/posts', (req, res) => {
  if (!membership(req.params.id, req.user.id) && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Nur Mitglieder können posten' });
  const { body } = req.body || {};
  if (!body) return res.status(400).json({ error: 'body erforderlich' });
  db.prepare('INSERT INTO community_posts (community_id, author_id, body) VALUES (?, ?, ?)').run(
    req.params.id, req.user.id, body
  );
  res.status(201).json({ ok: true });
});

// Session ansetzen (Moderation); alle Mitglieder werden benachrichtigt.
router.post('/:id/sessions', (req, res) => {
  const id = Number(req.params.id);
  if (!canModerate(req, id)) return res.status(403).json({ error: 'Nur Moderation kann Sessions ansetzen' });
  const { title, description, format, starts_at } = req.body || {};
  if (!title || !starts_at) return res.status(400).json({ error: 'title und starts_at erforderlich' });
  const fmt = FORMATS.includes(format) ? format : 'peer_session';
  db.prepare(
    `INSERT INTO community_sessions (community_id, host_id, title, description, format, starts_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.id, title, description || null, fmt, String(starts_at).replace('T', ' ').slice(0, 16));
  const community = db.prepare('SELECT name_de FROM communities WHERE id = ?').get(id);
  for (const m of db.prepare('SELECT user_id FROM community_members WHERE community_id = ? AND user_id != ?').all(id, req.user.id)) {
    notify(m.user_id, { type: 'system', title: `Neue Session: ${title}`, body: community?.name_de, link: `/communities/${id}` });
  }
  res.status(201).json({ ok: true });
});

router.post('/sessions/:sessionId/attend', (req, res) => {
  const s = db.prepare('SELECT * FROM community_sessions WHERE id = ?').get(req.params.sessionId);
  if (!s) return res.status(404).json({ error: 'Session nicht gefunden' });
  const exists = db
    .prepare('SELECT 1 FROM session_attendees WHERE session_id = ? AND user_id = ?')
    .get(s.id, req.user.id);
  if (exists) db.prepare('DELETE FROM session_attendees WHERE session_id = ? AND user_id = ?').run(s.id, req.user.id);
  else {
    db.prepare('INSERT INTO community_members (community_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(s.community_id, req.user.id);
    db.prepare('INSERT INTO session_attendees (session_id, user_id) VALUES (?, ?)').run(s.id, req.user.id);
  }
  res.json({ attending: !exists });
});

// Iteration 3 – Pitch-&-Learn-Slots (FA-24): Mitglieder beantragen einen
// Session-Slot (z.B. Innovation vorstellen und von Alumni lernen); die
// Moderation genehmigt und terminiert oder lehnt ab.
router.post('/:id/session-requests', (req, res) => {
  const id = Number(req.params.id);
  if (!membership(id, req.user.id) && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Nur Mitglieder können einen Slot beantragen' });
  const { title, description, audience, preferred_date } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title erforderlich' });
  db.prepare(
    `INSERT INTO session_requests (community_id, requester_id, title, description, audience, preferred_date) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.id, title, description || null, audience || null, preferred_date || null);
  const mods = db.prepare(`SELECT user_id FROM community_members WHERE community_id = ? AND role = 'moderator'`).all(id);
  for (const m of mods) {
    if (m.user_id !== req.user.id)
      notify(m.user_id, { type: 'system', title: `Slot-Antrag: ${title}`, body: req.user.name, link: `/communities/${id}` });
  }
  res.status(201).json({ ok: true });
});

router.post('/session-requests/:rid/decide', (req, res) => {
  const r = db.prepare('SELECT * FROM session_requests WHERE id = ?').get(req.params.rid);
  if (!r) return res.status(404).json({ error: 'Antrag nicht gefunden' });
  if (!canModerate(req, r.community_id)) return res.status(403).json({ error: 'Nur Moderation kann entscheiden' });
  if (r.status !== 'pending') return res.status(409).json({ error: 'Antrag bereits entschieden' });
  const { approve, starts_at, format } = req.body || {};
  if (!approve) {
    db.prepare(`UPDATE session_requests SET status = 'declined' WHERE id = ?`).run(r.id);
    notify(r.requester_id, { type: 'system', title: `Slot-Antrag abgelehnt: ${r.title}`, link: `/communities/${r.community_id}` });
    return res.json({ ok: true });
  }
  if (!starts_at) return res.status(400).json({ error: 'starts_at erforderlich' });
  const sessionId = withTx(() => {
    const info = db
      .prepare(
        `INSERT INTO community_sessions (community_id, host_id, title, description, format, starts_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        r.community_id, r.requester_id, r.title,
        [r.description, r.audience && `Publikum: ${r.audience}`].filter(Boolean).join('\n') || null,
        FORMATS.includes(format) ? format : 'pitch_learn', String(starts_at).replace('T', ' ').slice(0, 16)
      );
    const sid = Number(info.lastInsertRowid);
    db.prepare(`UPDATE session_requests SET status = 'approved', session_id = ? WHERE id = ?`).run(sid, r.id);
    db.prepare('INSERT INTO session_attendees (session_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(sid, r.requester_id);
    return sid;
  });
  for (const m of db.prepare('SELECT user_id FROM community_members WHERE community_id = ? AND user_id != ?').all(r.community_id, req.user.id)) {
    notify(m.user_id, {
      type: 'system',
      title: m.user_id === r.requester_id ? `Dein Slot ist bestätigt: ${r.title}` : `Neue Session: ${r.title}`,
      link: `/communities/${r.community_id}`,
    });
  }
  res.json({ ok: true, session_id: sessionId });
});

export default router;
