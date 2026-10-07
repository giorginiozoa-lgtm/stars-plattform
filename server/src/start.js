// Produktionsstart fuer den Testbetrieb (z.B. Render): stellt zuerst die
// gesicherte Datenbank wieder her, befuellt eine leere Datenbank mit den
// Demo-Daten und startet dann die API inkl. ausgeliefertem Frontend.
//   ADMIN_PASSWORD  ersetzt das Demo-Passwort des Admin-Kontos (dringend empfohlen)
//   SEED_ON_EMPTY   'false' verhindert das Befuellen mit Demo-Daten
import { restore, backupEnabled } from './backup.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dbPath = process.env.DB_PATH || join(dirname(fileURLToPath(import.meta.url)), '..', 'data.sqlite');

try {
  await restore(dbPath);
} catch (err) {
  // Niemals mit leerer Datenbank weiterlaufen, wenn eine Sicherung existieren
  // koennte – sonst wuerde die naechste Sicherung die echten Daten ueberschreiben.
  console.error(err.message || err);
  process.exit(1);
}

const { db, initSchema } = await import('./db.js');
initSchema();
const users = db.prepare('SELECT COUNT(*) n FROM users').get().n;
if (users === 0 && process.env.SEED_ON_EMPTY !== 'false') {
  console.log('Leere Datenbank – Demo-Daten werden angelegt …');
  await import('./seed.js');
}
if (process.env.ADMIN_PASSWORD) {
  const { hashPassword } = await import('./auth.js');
  db.prepare(`UPDATE users SET password_hash = ? WHERE role = 'admin'`).run(hashPassword(process.env.ADMIN_PASSWORD));
}
if (!process.env.JWT_SECRET) console.warn('WARNUNG: JWT_SECRET ist nicht gesetzt (nur fuer lokale Tests geeignet).');
if (backupEnabled) console.log(`[backup] aktiv -> ${process.env.BACKUP_REPO}`);

await import('./index.js');
