// Saeule 2b – 1:1-Kommunikation: Konversationen und Direktnachrichten.
import { Router } from 'express';
import { db, orderPair } from '../db.js';
import { authRequired } from '../auth.js';
import { publicUser, notify } from '../helpers.js';

const router = Router();

// Alle Konversationen der angemeldeten Person mit Gegenueber und letzter Nachricht.
router.get('/', authRequired, (req, res) => {
  const uid = req.user.id;
  const convs = db
    .prepare(
      `SELECT c.id, c.user_low, c.user_high, c.created_at
       FROM conversations c WHERE c.user_low = ? OR c.user_high = ?
       ORDER BY c.id DESC`
    )
    .all(uid, uid);

  const result = convs.map((c) => {
    const otherId = c.user_low === uid ? c.user_high : c.user_low;
    const other = db.prepare('SELECT * FROM users WHERE id = ?').get(otherId);
    const last = db
      .prepare(
        `SELECT body, sender_id, created_at FROM messages
         WHERE conversation_id = ? ORDER BY id DESC LIMIT 1`
      )
      .get(c.id);
    const unread = db
      .prepare(
        `SELECT COUNT(*) AS n FROM messages
         WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL`
      )
      .get(c.id, uid).n;
    return { id: c.id, partner: publicUser(other), lastMessage: last, unread };
  });
  res.json({ conversations: result });
});

// Konversation mit jemandem starten oder bestehende finden.
router.post('/with/:userId', authRequired, (req, res) => {
  const otherId = Number(req.params.userId);
  if (otherId === req.user.id) return res.status(400).json({ error: 'Nicht mit sich selbst' });
  const other = db.prepare('SELECT id FROM users WHERE id = ?').get(otherId);
  if (!other) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  const [low, high] = orderPair(req.user.id, otherId);
  db.prepare(
    'INSERT INTO conversations (user_low, user_high) VALUES (?, ?) ON CONFLICT DO NOTHING'
  ).run(low, high);
  const conv = db
    .prepare('SELECT id FROM conversations WHERE user_low = ? AND user_high = ?')
    .get(low, high);
  res.json({ conversationId: conv.id });
});

// Nachrichten einer Konversation (markiert eingehende als gelesen).
router.get('/:id', authRequired, (req, res) => {
  const uid = req.user.id;
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv || (conv.user_low !== uid && conv.user_high !== uid)) {
    return res.status(404).json({ error: 'Konversation nicht gefunden' });
  }
  const otherId = conv.user_low === uid ? conv.user_high : conv.user_low;
  const partner = db.prepare('SELECT * FROM users WHERE id = ?').get(otherId);

  db.prepare(
    `UPDATE messages SET read_at = datetime('now')
     WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL`
  ).run(req.params.id, uid);

  const messages = db
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC')
    .all(req.params.id);
  res.json({ partner: publicUser(partner), messages });
});

// Nachricht senden (benachrichtigt das Gegenueber).
router.post('/:id/messages', authRequired, (req, res) => {
  const uid = req.user.id;
  const { body } = req.body || {};
  if (!body) return res.status(400).json({ error: 'body erforderlich' });
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv || (conv.user_low !== uid && conv.user_high !== uid)) {
    return res.status(404).json({ error: 'Konversation nicht gefunden' });
  }
  const info = db
    .prepare('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)')
    .run(req.params.id, uid, body);
  const otherId = conv.user_low === uid ? conv.user_high : conv.user_low;
  notify(otherId, {
    type: 'message',
    title: `Neue Nachricht von ${req.user.name}`,
    body: body.length > 80 ? body.slice(0, 80) + '…' : body,
    link: `/messages/${conv.id}`,
  });
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ message });
});

export default router;
