// Saeule 2a – Frage-Experten-Matching: Entrepreneurs stellen Fragen, die
// regelbasiert passenden Expert:innen zugeordnet werden.
import { Router } from 'express';
import { db, orderPair, withTx } from '../db.js';
import { authRequired } from '../auth.js';
import { computeMatches, rankMentors } from '../matching.js';
import { notify } from '../helpers.js';

const router = Router();

function tagsForQuestion(qid) {
  return db
    .prepare(
      `SELECT t.id, t.slug, t.name_de, t.name_en, t.category
       FROM question_tags qt JOIN tags t ON t.id = qt.tag_id WHERE qt.question_id = ?`
    )
    .all(qid);
}

// Fragen auflisten (eigene zuerst; Admin sieht alle).
router.get('/', authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT q.*, u.name AS asker_name, u.avatar_seed AS asker_avatar, u.country AS asker_country
       FROM questions q JOIN users u ON u.id = q.asker_id
       ORDER BY q.created_at DESC`
    )
    .all();
  const questions = rows.map((q) => ({ ...q, tags: tagsForQuestion(q.id) }));
  res.json({ questions });
});

// Neue Frage inkl. Tags -> Matching wird direkt berechnet.
router.post('/', authRequired, (req, res) => {
  const { title, body, tagIds } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title und body erforderlich' });
  const info = db
    .prepare('INSERT INTO questions (asker_id, title, body) VALUES (?, ?, ?)')
    .run(req.user.id, title, body);
  const qid = info.lastInsertRowid;

  if (Array.isArray(tagIds) && tagIds.length) {
    const ins = db.prepare(
      'INSERT INTO question_tags (question_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING'
    );
    withTx(() => tagIds.forEach((id) => ins.run(qid, id)));
  }

  const matches = computeMatches(qid, 5);

  // Vorgeschlagene Expert:innen benachrichtigen.
  for (const m of matches) {
    notify(m.mentor.id, {
      type: 'match',
      title: 'Passende Anfrage für dich',
      body: `${req.user.name} sucht Expertise: "${title}"`,
      link: `/mentoring/question/${qid}`,
    });
  }

  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(qid);
  res.status(201).json({ question: { ...question, tags: tagsForQuestion(qid) }, matches });
});

// Frage mit Matches abrufen.
router.get('/:id', authRequired, (req, res) => {
  const question = db
    .prepare(
      `SELECT q.*, u.name AS asker_name, u.avatar_seed AS asker_avatar, u.country AS asker_country
       FROM questions q JOIN users u ON u.id = q.asker_id WHERE q.id = ?`
    )
    .get(req.params.id);
  if (!question) return res.status(404).json({ error: 'Frage nicht gefunden' });

  // Live-Ranking (inkl. Begruendung) mit gespeichertem Status ueberlagern.
  const persisted = new Map(
    db.prepare('SELECT mentor_id, status FROM matches WHERE question_id = ?')
      .all(req.params.id)
      .map((m) => [m.mentor_id, m.status])
  );
  const matches = rankMentors(req.params.id, 5).map((r) => ({
    mentor_id: r.mentor.id,
    mentor_name: r.mentor.name,
    headline: r.mentor.headline,
    country: r.mentor.country,
    region: r.mentor.region,
    avatar_seed: r.mentor.avatar_seed,
    score: r.score,
    coverage: r.coverage,
    expertise: r.expertise,
    market: r.market,
    matchedTags: r.matchedTags,
    status: persisted.get(r.mentor.id) || 'suggested',
  }));

  res.json({ question: { ...question, tags: tagsForQuestion(question.id) }, matches });
});

// Neu berechnen (z.B. nachdem sich Expertise-Profile geaendert haben).
router.post('/:id/rematch', authRequired, (req, res) => {
  const matches = computeMatches(req.params.id, 5);
  res.json({ matches });
});

// Match annehmen -> eroeffnet automatisch eine 1:1-Konversation (Bruecke zu Saeule 2b).
router.post('/:id/matches/:mentorId/accept', authRequired, (req, res) => {
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!question) return res.status(404).json({ error: 'Frage nicht gefunden' });
  if (question.asker_id !== req.user.id) {
    return res.status(403).json({ error: 'Nur die fragende Person kann annehmen' });
  }
  const mentorId = Number(req.params.mentorId);
  db.prepare(`UPDATE matches SET status = 'accepted' WHERE question_id = ? AND mentor_id = ?`).run(
    req.params.id,
    mentorId
  );
  db.prepare(`UPDATE questions SET status = 'resolved' WHERE id = ?`).run(req.params.id);

  // Konversation anlegen (idempotent).
  const [low, high] = orderPair(req.user.id, mentorId);
  db.prepare(
    'INSERT INTO conversations (user_low, user_high) VALUES (?, ?) ON CONFLICT DO NOTHING'
  ).run(low, high);
  const conv = db
    .prepare('SELECT id FROM conversations WHERE user_low = ? AND user_high = ?')
    .get(low, high);

  notify(mentorId, {
    type: 'match',
    title: 'Deine Unterstützung wurde angenommen',
    body: `${req.user.name} möchte mit dir zu "${question.title}" sprechen.`,
    link: `/messages/${conv.id}`,
  });

  res.json({ conversationId: conv.id });
});

export default router;
