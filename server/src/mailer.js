// E-Mail-Benachrichtigungen: Jede Nutzer:in legt im Profil fest, fuer welche
// Kategorien sie E-Mails erhalten will. Versand ueber SMTP (Konfiguration per
// Umgebungsvariablen); ohne Konfiguration bleibt der Versand ausgeschaltet.
//
//   SMTP_HOST, SMTP_PORT (Standard 465), SMTP_USER, SMTP_PASS,
//   SMTP_SECURE ('false' fuer STARTTLS auf Port 587), MAIL_FROM (Standard SMTP_USER),
//   APP_URL (Standard https://plattform.the-stars.ch)
//
// Ablauf: notify() legt wie bisher eine Benachrichtigung an. Ein Sweeper prueft
// jede Minute die noch ungelesenen Benachrichtigungen und verschickt pro
// Person eine Sammel-E-Mail. Wer gerade online ist, erhaelt keine E-Mail
// (die Glocke genuegt); liest die Person die Benachrichtigung vorher in der
// App, entfaellt die E-Mail ebenfalls.
import nodemailer from 'nodemailer';
import { db } from './db.js';
import { isOnline } from './presence.js';

export const CATEGORIES = [
  { key: 'messages', de: 'Direktnachrichten', en: 'Direct messages' },
  { key: 'forum', de: 'Foren: Antworten auf meine Beiträge und neue Fragen', en: 'Forums: replies to my posts and new questions' },
  { key: 'questions', de: 'Expertenfragen und Matching', en: 'Expert questions and matching' },
  { key: 'journey', de: 'Support Journey', en: 'Support Journey' },
  { key: 'communities', de: 'Communities und Sessions', en: 'Communities and sessions' },
  { key: 'network', de: 'Netzwerk und Intros', en: 'Network and intros' },
  { key: 'events', de: 'Veranstaltungen und Förderplätze', en: 'Events and funded places' },
  { key: 'account', de: 'Konto, Feedback und Administration', en: 'Account, feedback and administration' },
];
const KEYS = CATEGORIES.map((c) => c.key);

// Kategorie einer Benachrichtigung anhand ihres Ziel-Links (alle bestehenden
// notify()-Aufrufe setzen einen Link; so muss keiner angepasst werden).
export function categoryOf(link) {
  const l = link || '';
  if (l.startsWith('/messages')) return 'messages';
  if (l.startsWith('/communities')) return 'communities';
  if (l.startsWith('/community')) return 'forum';
  if (l.startsWith('/mentoring') || l.startsWith('/mentors')) return 'questions';
  if (l.startsWith('/journey')) return 'journey';
  if (l.startsWith('/network')) return 'network';
  if (l.startsWith('/events')) return 'events';
  return 'account';
}

// Standard: E-Mails an, alle Kategorien aktiv ausser Communities (viele Sessions).
const DEFAULTS = { enabled: true, categories: Object.fromEntries(KEYS.map((k) => [k, k !== 'communities'])) };

export function prefsOf(user) {
  let p = {};
  try { p = user?.email_prefs ? JSON.parse(user.email_prefs) : {}; } catch { p = {}; }
  const categories = { ...DEFAULTS.categories };
  for (const k of KEYS) if (typeof p.categories?.[k] === 'boolean') categories[k] = p.categories[k];
  return { enabled: typeof p.enabled === 'boolean' ? p.enabled : DEFAULTS.enabled, categories };
}

export function savePrefs(userId, input) {
  const cur = prefsOf(db.prepare('SELECT email_prefs FROM users WHERE id = ?').get(userId));
  const next = {
    enabled: typeof input?.enabled === 'boolean' ? input.enabled : cur.enabled,
    categories: { ...cur.categories },
  };
  for (const k of KEYS) if (typeof input?.categories?.[k] === 'boolean') next.categories[k] = input.categories[k];
  db.prepare('UPDATE users SET email_prefs = ? WHERE id = ?').run(JSON.stringify(next), userId);
  return next;
}

// --- Versand ------------------------------------------------------------------
const APP_URL = (process.env.APP_URL || 'https://plattform.the-stars.ch').replace(/\/$/, '');
export const mailConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport = null;
function getTransport() {
  if (!mailConfigured) return null;
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE !== 'false' : port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

// Demo-Konten (@example.com) erhalten nie E-Mails.
const deliverable = (email) => !!email && !/@example\.(com|org|net)$/i.test(email);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function sendMail(to, subject, items) {
  const t = getTransport();
  if (!t || !deliverable(to)) return false;
  const text = [
    ...items.map((n) => `• ${n.title}${n.body ? `\n  ${n.body}` : ''}${n.link ? `\n  ${APP_URL}${n.link}` : ''}`),
    '',
    `Benachrichtigungen anpassen / Manage notifications: ${APP_URL}/profile#notifications`,
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;color:#0e2a47">
    <p style="font-size:18px;font-weight:bold;margin:0 0 12px">★ stars</p>
    ${items.map((n) => `<div style="border-left:3px solid #c9a227;padding:6px 12px;margin:0 0 12px">
      <b>${esc(n.title)}</b>${n.body ? `<br><span style="color:#555">${esc(n.body)}</span>` : ''}
      ${n.link ? `<br><a href="${esc(APP_URL + n.link)}" style="color:#1d5fa8">Auf der Plattform öffnen / Open on the platform</a>` : ''}
    </div>`).join('')}
    <p style="font-size:12px;color:#888;margin-top:24px">Du erhältst diese E-Mail, weil du E-Mail-Benachrichtigungen auf der stars-Plattform aktiviert hast.
    <a href="${esc(APP_URL)}/profile#notifications" style="color:#888">Einstellungen ändern / Change settings</a></p></div>`;
  await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html });
  return true;
}

// --- Sweeper ------------------------------------------------------------------
const STARTED_AT = new Date().toISOString().replace('T', ' ').slice(0, 19);
const DELAY_MIN = Number(process.env.EMAIL_DELAY_MIN || 1); // so lange darf die Person zuerst in der App reagieren

export async function sweep() {
  if (!mailConfigured) return;
  // Nur Benachrichtigungen seit Serverstart (sonst gaebe es nach einem Update
  // E-Mails fuer alle alten, ungelesenen Eintraege) und hoechstens 1 Tag alt.
  const due = db
    .prepare(
      `SELECT n.*, u.email, u.email_prefs, u.last_seen_at, u.status
       FROM notifications n JOIN users u ON u.id = n.user_id
       WHERE n.emailed_at IS NULL AND n.read_at IS NULL
         AND n.created_at >= ? AND n.created_at >= datetime('now', '-1 day')
         AND n.created_at <= datetime('now', ?)
       ORDER BY n.id`
    )
    .all(STARTED_AT, `-${DELAY_MIN} minutes`);
  const mark = db.prepare('UPDATE notifications SET emailed_at = ? WHERE id = ?');
  const recentSame = db.prepare(
    `SELECT 1 FROM notifications WHERE user_id = ? AND link = ? AND id != ? AND read_at IS NULL
       AND emailed_at GLOB '[0-9]*' AND emailed_at > datetime('now', '-30 minutes') LIMIT 1`
  );

  const byUser = new Map();
  for (const n of due) {
    if (isOnline(n.last_seen_at)) continue; // spaeter erneut pruefen
    const prefs = prefsOf(n);
    const skip =
      n.status !== 'active' || !deliverable(n.email) || !prefs.enabled || !prefs.categories[categoryOf(n.link)] ||
      (n.link && recentSame.get(n.user_id, n.link, n.id)); // z.B. mehrere Nachrichten im selben Chat
    if (skip) { mark.run('skip', n.id); continue; }
    if (!byUser.has(n.user_id)) byUser.set(n.user_id, []);
    byUser.get(n.user_id).push(n);
  }

  for (const items of byUser.values()) {
    const subject = items.length === 1 ? `stars: ${items[0].title}` : `stars: ${items.length} neue Benachrichtigungen`;
    try {
      await sendMail(items[0].email, subject, items);
      const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
      for (const n of items) mark.run(ts, n.id);
    } catch (err) {
      console.error('[mail] Versand fehlgeschlagen:', err.message || err);
      for (const n of items) mark.run('error', n.id); // kein Endlos-Wiederholen
    }
  }
}

export function startMailer() {
  if (!mailConfigured) {
    console.log('[mail] SMTP nicht konfiguriert – E-Mail-Benachrichtigungen sind ausgeschaltet.');
    return;
  }
  console.log(`[mail] E-Mail-Benachrichtigungen aktiv (${process.env.SMTP_HOST}).`);
  const run = () => sweep().catch((err) => console.error('[mail]', err.message || err));
  setInterval(run, 60_000).unref();
}
