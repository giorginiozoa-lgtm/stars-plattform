// Saeule 1 – Community: Foren, Threads (Beitraege) und Kommentare.
import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../auth.js';
import { publicUser, notify } from '../helpers.js';

const router = Router();

// Alle Foren mit Thread-Zaehler und letztem Aktivitaetszeitpunkt.
router.get('/', (_req, res) => {
  const forums = db
    .prepare(
      `SELECT f.*,
        (SELECT COUNT(*) FROM threads t WHERE t.forum_id = f.id) AS thread_count,
        (SELECT MAX(created_at) FROM threads t WHERE t.forum_id = f.id) AS last_activity
       FROM forums f ORDER BY f.sort_order, f.title_de`
    )
    .all();
  res.json({ forums });
});

// Threads eines Forums (mit Autor:in und Kommentarzahl).
router.get('/:id/threads', (req, res) => {
  const forum = db.prepare('SELECT * FROM forums WHERE id = ?').get(req.params.id);
  if (!forum) return res.status(404).json({ error: 'Forum nicht gefunden' });
  const threads = db
    .prepare(
      `SELECT t.id, t.title, t.body, t.created_at, u.id AS author_id, u.name AS author_name,
              u.role AS author_role, u.avatar_seed AS author_avatar,
        (SELECT COUNT(*) FROM comments c WHERE c.thread_id = t.id) AS comment_count
       FROM threads t JOIN users u ON u.id = t.author_id
       WHERE t.forum_id = ? ORDER BY t.created_at DESC`
    )
    .all(req.params.id);
  res.json({ forum, threads });
});

// Neuen Thread erstellen.
router.post('/:id/threads', authRequired, (req, res) => {
  const { title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title und body erforderlich' });
  const forum = db.prepare('SELECT * FROM forums WHERE id = ?').get(req.params.id);
  if (!forum) return res.status(404).json({ error: 'Forum nicht gefunden' });
  const info = db
    .prepare('INSERT INTO threads (forum_id, author_id, title, body) VALUES (?, ?, ?, ?)')
    .run(req.params.id, req.user.id, title, body);
  const thread = db.prepare('SELECT * FROM threads WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ thread });
});

// Einzelner Thread mit Kommentaren.
router.get('/threads/:threadId', (req, res) => {
  const thread = db
    .prepare(
      `SELECT t.*, u.name AS author_name, u.role AS author_role, u.avatar_seed AS author_avatar
       FROM threads t JOIN users u ON u.id = t.author_id WHERE t.id = ?`
    )
    .get(req.params.threadId);
  if (!thread) return res.status(404).json({ error: 'Thread nicht gefunden' });
  const comments = db
    .prepare(
      `SELECT c.id, c.body, c.created_at, u.id AS author_id, u.name AS author_name,
              u.role AS author_role, u.avatar_seed AS author_avatar
       FROM comments c JOIN users u ON u.id = c.author_id
       WHERE c.thread_id = ? ORDER BY c.created_at ASC`
    )
    .all(req.params.threadId);
  res.json({ thread, comments });
});

// Kommentar hinzufuegen (benachrichtigt die Thread-Autor:in).
router.post('/threads/:threadId/comments', authRequired, (req, res) => {
  const { body } = req.body || {};
  if (!body) return res.status(400).json({ error: 'body erforderlich' });
  const thread = db.prepare('SELECT * FROM threads WHERE id = ?').get(req.params.threadId);
  if (!thread) return res.status(404).json({ error: 'Thread nicht gefunden' });
  const info = db
    .prepare('INSERT INTO comments (thread_id, author_id, body) VALUES (?, ?, ?)')
    .run(req.params.threadId, req.user.id, body);

  if (thread.author_id !== req.user.id) {
    notify(thread.author_id, {
      type: 'comment',
      title: 'Neue Antwort auf deinen Beitrag',
      body: `${req.user.name}: "${thread.title}"`,
      link: `/community/thread/${thread.id}`,
    });
  }
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ comment });
});

export default router;
