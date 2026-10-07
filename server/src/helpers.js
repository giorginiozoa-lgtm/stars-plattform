// Gemeinsame Hilfsfunktionen fuer die Routen.
import { db } from './db.js';

// Gibt nur oeffentlich unbedenkliche Nutzerfelder zurueck (nie password_hash).
export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    country: u.country,
    region: u.region,
    headline: u.headline,
    bio: u.bio,
    languages: u.languages ? u.languages.split(',') : [],
    avatar_seed: u.avatar_seed || u.name,
    support_roles: u.support_roles ? u.support_roles.split(',') : [],
    capacity_hours: u.capacity_hours ?? null,
    available: u.available === undefined ? true : !!u.available,
    offers_peer_support: !!u.offers_peer_support,
  };
}

// Laedt die Tags einer Nutzer:in (mit Gewicht) als Array.
export function userTags(userId) {
  return db
    .prepare(
      `SELECT t.id, t.slug, t.name_de, t.name_en, t.category, ut.weight
       FROM user_tags ut JOIN tags t ON t.id = ut.tag_id
       WHERE ut.user_id = ? ORDER BY ut.weight DESC`
    )
    .all(userId);
}

// Erstellt eine Benachrichtigung (Kann-Ziel Notification-Logik).
export function notify(userId, { type, title, body = null, link = null }) {
  db.prepare(
    `INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, type, title, body, link);
}
