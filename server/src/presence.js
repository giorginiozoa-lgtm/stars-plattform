// Online-Status und Zustellbestaetigung (wie bei Messenger-Apps).
// Jede angemeldete Anfrage zaehlt als Aktivitaet. Die App fragt alle 20 s die
// Benachrichtigungen ab, solange der Tab sichtbar ist; wer laenger als
// ONLINE_WINDOW_S nichts mehr gesendet hat, gilt als offline.
// Ist die Person aktiv, gelten alle an sie gerichteten Direktnachrichten als
// zugestellt (✓✓); «gelesen» setzt erst das Oeffnen der Konversation.
import { db } from './db.js';

export const ONLINE_WINDOW_S = 70;

// SQLite-Zeitstempel (UTC, 'YYYY-MM-DD HH:MM:SS') -> online?
export function isOnline(lastSeen) {
  if (!lastSeen) return false;
  const t = Date.parse(String(lastSeen).replace(' ', 'T') + 'Z');
  return Number.isFinite(t) && Date.now() - t < ONLINE_WINDOW_S * 1000;
}

let touchStmt, deliverStmt;
export function touchPresence(userId) {
  touchStmt ??= db.prepare(
    `UPDATE users SET last_seen_at = datetime('now')
     WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < datetime('now', '-15 seconds'))`
  );
  deliverStmt ??= db.prepare(
    `UPDATE messages SET delivered_at = datetime('now')
     WHERE delivered_at IS NULL AND sender_id != ?
       AND conversation_id IN (SELECT id FROM conversations WHERE user_low = ? OR user_high = ?)`
  );
  touchStmt.run(userId);
  deliverStmt.run(userId, userId, userId);
}
