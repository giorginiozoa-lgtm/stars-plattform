// Iteration 3 – Warm Introductions mit stars-Empfehlung (FA-23).
// Abgeleitet aus dem Feedback eines EEM (Oktober 2026): Vorstellungen bei
// Alumni in Stiftungen/CSR und stars als «Buerge» (Vouching). Ablauf analog zum
// moderierten Matching (Human-in-the-Loop):
//   requested (EEM fragt an) -> proposed (stars waehlt Person + Empfehlung)
//   -> accepted (Person nimmt an, Konversation wird eroeffnet) | declined
//   bzw. closed (stars schliesst die Anfrage ohne Vorstellung).
import { Router } from 'express';
import { db, withTx, orderPair } from '../db.js';
import { authRequired } from '../auth.js';
import { notify } from '../helpers.js';
import { scoreSupporter } from '../matching.js';

const router = Router();
router.use(authRequired);

const isAdmin = (req) => req.user.role === 'admin';

const baseSql = `
  SELECT i.*, r.name AS requester_name, r.country AS requester_country, r.headline AS requester_headline,
         r.avatar_seed AS requester_avatar, s.name AS supporter_name, s.headline AS supporter_headline,
         s.avatar_seed AS supporter_avatar
  FROM intro_requests i
  JOIN users r ON r.id = i.requester_id
  LEFT JOIN users s ON s.id = i.supporter_id`;

function tagsOf(introId) {
  return db
    .prepare(
      `SELECT t.id, t.slug, t.name_de, t.name_en, t.category FROM intro_request_tags it
       JOIN tags t ON t.id = it.tag_id WHERE it.intro_id = ?`
    )
    .all(introId);
}

function load(id) {
  const intro = db.prepare(`${baseSql} WHERE i.id = ?`).get(id);
  return intro ? { ...intro, tags: tagsOf(intro.id) } : null;
}

function canSee(req, intro) {
  return isAdmin(req) || intro.requester_id === req.user.id || intro.supporter_id === req.user.id;
}

// Eigene Anfragen (EEM), an mich gerichtete Vorstellungen (Alumni) bzw. alle (stars).
router.get('/', (req, res) => {
  const rows = isAdmin(req)
    ? db.prepare(`${baseSql} ORDER BY (i.status = 'requested') DESC, i.updated_at DESC`).all()
    : db
        .prepare(
          `${baseSql} WHERE i.requester_id = ? OR (i.supporter_id = ? AND i.status != 'requested')
           ORDER BY i.updated_at DESC`
        )
        .all(req.user.id, req.user.id);
  res.json({ intros: rows.map((r) => ({ ...r, tags: tagsOf(r.id) })) });
});

router.post('/', (req, res) => {
  const { target_profile, purpose, tag_ids } = req.body || {};
  if (!target_profile || !purpose) return res.status(400).json({ error: 'target_profile und purpose erforderlich' });
  const id = withTx(() => {
    const info = db
      .prepare('INSERT INTO intro_requests (requester_id, target_profile, purpose) VALUES (?, ?, ?)')
      .run(req.user.id, target_profile, purpose);
    const introId = Number(info.lastInsertRowid);
    const ins = db.prepare('INSERT INTO intro_request_tags (intro_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING');
    for (const t of Array.isArray(tag_ids) ? tag_ids : []) ins.run(introId, Number(t));
    return introId;
  });
  for (const a of db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all()) {
    notify(a.id, { type: 'system', title: 'Neue Intro-Anfrage', body: `${req.user.name}: ${target_profile}`, link: '/network' });
  }
  res.status(201).json({ id });
});

router.get('/:id', (req, res) => {
  const intro = load(req.params.id);
  if (!intro || !canSee(req, intro)) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
  res.json({ intro });
});

// Vorschlaege fuer stars: Alumni und Peer-Expert:innen, bewertet mit der
// Unterstuetzer-Logik in der Rolle «Connector» (Netzwerkzugang zaehlt).
router.get('/:id/suggestions', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const intro = load(req.params.id);
  if (!intro) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
  const candidates = db
    .prepare(
      `SELECT * FROM users WHERE id != ? AND status = 'active' AND (role = 'mentor' OR (role = 'entrepreneur' AND offers_peer_support = 1))`
    )
    .all(intro.requester_id);
  const tagStmt = db.prepare(
    `SELECT t.id, t.category, ut.weight FROM user_tags ut JOIN tags t ON t.id = ut.tag_id WHERE ut.user_id = ?`
  );
  const names = new Map(intro.tags.map((t) => [t.id, { de: t.name_de, en: t.name_en }]));
  const suggestions = candidates
    .map((u) => {
      const r = scoreSupporter(
        { tags: intro.tags, role: 'connector', language: null },
        {
          tags: tagStmt.all(u.id),
          languages: u.languages ? u.languages.split(',') : [],
          capacity_hours: u.capacity_hours,
          available: u.available === null || u.available === undefined ? true : !!u.available,
          support_roles: [], // fuer eine Vorstellung genuegt Netzwerk/Fachbezug, keine Rollenpflicht
        }
      );
      return {
        user: { id: u.id, name: u.name, role: u.role, country: u.country, headline: u.headline, avatar_seed: u.avatar_seed },
        peer: u.role === 'entrepreneur',
        score: r.score,
        matchedTags: r.matchedTagIds.map((id) => names.get(id)).filter(Boolean),
      };
    })
    .filter((s) => s.matchedTags.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  res.json({ suggestions });
});

router.post('/:id/propose', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const intro = load(req.params.id);
  if (!intro) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
  if (!['requested', 'declined'].includes(intro.status))
    return res.status(409).json({ error: 'Anfrage ist bereits vergeben oder abgeschlossen' });
  const { supporter_id, vouch_note } = req.body || {};
  const supporter = db.prepare('SELECT id, name FROM users WHERE id = ?').get(supporter_id);
  if (!supporter || supporter.id === intro.requester_id) return res.status(400).json({ error: 'Ungültige Person' });
  if (!vouch_note) return res.status(400).json({ error: 'Empfehlungsnotiz erforderlich' });
  db.prepare(
    `UPDATE intro_requests SET status = 'proposed', supporter_id = ?, vouch_note = ?, response_note = NULL,
       updated_at = datetime('now') WHERE id = ?`
  ).run(supporter.id, vouch_note, intro.id);
  notify(supporter.id, {
    type: 'match', title: `stars möchte dich ${intro.requester_name} vorstellen`, body: intro.target_profile, link: '/network',
  });
  notify(intro.requester_id, { type: 'system', title: 'Deine Intro-Anfrage ist in Bearbeitung', body: `Vorgeschlagen: ${supporter.name}`, link: '/network' });
  res.json({ intro: load(intro.id) });
});

// Antwort der vorgestellten Person. Bei Annahme eroeffnet das System die
// Konversation mit einer Einleitungsnachricht, die die Empfehlung enthaelt.
router.post('/:id/respond', (req, res) => {
  const intro = load(req.params.id);
  if (!intro || intro.supporter_id !== req.user.id) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
  if (intro.status !== 'proposed') return res.status(409).json({ error: 'Keine offene Vorstellung' });
  const { accept, note } = req.body || {};
  if (!accept) {
    db.prepare(
      `UPDATE intro_requests SET status = 'declined', response_note = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(note || null, intro.id);
    for (const a of db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all()) {
      notify(a.id, { type: 'system', title: 'Vorstellung abgelehnt', body: `${req.user.name} → ${intro.requester_name}`, link: '/network' });
    }
    return res.json({ intro: load(intro.id) });
  }
  const convId = withTx(() => {
    const [low, high] = orderPair(intro.requester_id, req.user.id);
    db.prepare('INSERT INTO conversations (user_low, user_high) VALUES (?, ?) ON CONFLICT DO NOTHING').run(low, high);
    const conv = db.prepare('SELECT id FROM conversations WHERE user_low = ? AND user_high = ?').get(low, high);
    const body =
      `stars stellt vor: ${intro.requester_name} ↔ ${req.user.name}\n\n` +
      `Anliegen: ${intro.purpose}\n\nEmpfehlung von stars: ${intro.vouch_note}` +
      (note ? `\n\n${req.user.name}: ${note}` : '');
    db.prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)').run(conv.id, req.user.id, body);
    db.prepare(
      `UPDATE intro_requests SET status = 'accepted', response_note = ?, conversation_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(note || null, conv.id, intro.id);
    return conv.id;
  });
  notify(intro.requester_id, {
    type: 'match', title: `${req.user.name} hat die Vorstellung angenommen`, body: intro.target_profile, link: `/messages/${convId}`,
  });
  res.json({ intro: load(intro.id), conversation_id: convId });
});

router.post('/:id/close', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const intro = load(req.params.id);
  if (!intro) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
  const { note } = req.body || {};
  db.prepare(
    `UPDATE intro_requests SET status = 'closed', response_note = COALESCE(?, response_note), updated_at = datetime('now') WHERE id = ?`
  ).run(note || null, intro.id);
  notify(intro.requester_id, { type: 'system', title: 'Intro-Anfrage abgeschlossen', body: note || intro.target_profile, link: '/network' });
  res.json({ intro: load(intro.id) });
});

export default router;
