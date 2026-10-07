// Datensicherung fuer den kostenlosen Testbetrieb (Iteration 3).
// Gratis-Webdienste (z.B. Render Free) haben kein dauerhaftes Dateisystem: bei
// jedem Neustart waere die SQLite-Datei leer. Dieses Modul spiegelt die
// Datenbank daher in ein PRIVATES GitHub-Repository:
//   - beim Start wird der letzte Stand heruntergeladen (restore),
//   - nach schreibenden Anfragen wird gebuendelt gesichert (hoechstens alle
//     BACKUP_INTERVAL_S Sekunden) und beim Herunterfahren ein letztes Mal.
// Jede Sicherung ist ein Commit – die Historie dient zugleich als Versionierung.
//
// Konfiguration (nur aktiv, wenn beide gesetzt sind):
//   BACKUP_REPO   owner/name des privaten Repositorys, z.B. 'user/stars-plattform-data'
//   BACKUP_TOKEN  Fine-grained Token mit «Contents: Read and write» nur fuer dieses Repo
//   BACKUP_PATH   Dateipfad im Repo (Standard 'data.sqlite')
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';

const REPO = process.env.BACKUP_REPO;
const TOKEN = process.env.BACKUP_TOKEN;
const PATH = process.env.BACKUP_PATH || 'data.sqlite';
const INTERVAL = Math.max(15, Number(process.env.BACKUP_INTERVAL_S) || 60) * 1000;

export const backupEnabled = !!(REPO && TOKEN);

const API_BASE = process.env.BACKUP_API_BASE || 'https://api.github.com'; // ueberschreibbar fuer Tests
const api = `${API_BASE}/repos/${REPO}/contents/${PATH}`;
const headers = (accept = 'application/vnd.github+json') => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: accept,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'stars-plattform-backup',
});

let sha = null;

// Laedt den letzten Stand in dbPath. Muss VOR dem Oeffnen der Datenbank laufen.
export async function restore(dbPath) {
  if (!backupEnabled) return false;
  const meta = await fetch(api, { headers: headers() });
  if (meta.status === 404) {
    console.log('[backup] Noch keine Sicherung vorhanden – Start mit neuer Datenbank.');
    return false;
  }
  if (!meta.ok) throw new Error(`[backup] Metadaten nicht lesbar: ${meta.status} ${await meta.text()}`);
  sha = (await meta.json()).sha;
  const raw = await fetch(api, { headers: headers('application/vnd.github.raw') });
  if (!raw.ok) throw new Error(`[backup] Download fehlgeschlagen: ${raw.status}`);
  for (const ext of ['', '-wal', '-shm']) rmSync(dbPath + ext, { force: true });
  writeFileSync(dbPath, Buffer.from(await raw.arrayBuffer()));
  console.log(`[backup] Datenbank aus ${REPO}/${PATH} wiederhergestellt.`);
  return true;
}

// Schreibt einen konsistenten Schnappschuss (VACUUM INTO) und laedt ihn hoch.
async function upload(db, tmpPath) {
  rmSync(tmpPath, { force: true });
  db.exec(`VACUUM INTO '${tmpPath.replace(/'/g, "''")}'`);
  const content = readFileSync(tmpPath).toString('base64');
  rmSync(tmpPath, { force: true });
  const body = { message: `Sicherung ${new Date().toISOString()}`, content, ...(sha ? { sha } : {}) };
  let r = await fetch(api, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
  if (r.status === 409 || r.status === 422) {
    // sha veraltet (z.B. parallele Instanz) – aktuellen Stand holen und erneut versuchen.
    const meta = await fetch(api, { headers: headers() });
    sha = meta.ok ? (await meta.json()).sha : null;
    r = await fetch(api, { method: 'PUT', headers: headers(), body: JSON.stringify({ ...body, sha }) });
  }
  if (!r.ok) throw new Error(`[backup] Upload fehlgeschlagen: ${r.status} ${await r.text()}`);
  sha = (await r.json()).content.sha;
}

// Startet die gebuendelte Sicherung. Liefert eine Express-Middleware, die
// schreibende API-Anfragen als «Aenderung» markiert.
export function startBackups(db, dbPath) {
  if (!backupEnabled) return (_req, _res, next) => next();
  const tmpPath = dbPath + '.snapshot';
  let dirty = !existsSync(dbPath) || sha === null; // erste Sicherung nach frischem Seed
  let running = false;

  async function flush(reason) {
    if (!dirty || running) return;
    running = true;
    dirty = false;
    try {
      await upload(db, tmpPath);
      console.log(`[backup] gesichert (${reason})`);
    } catch (err) {
      dirty = true;
      console.error(err.message || err);
    } finally {
      running = false;
    }
  }

  const timer = setInterval(() => flush('Intervall'), INTERVAL);
  timer.unref();
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.once(sig, async () => {
      clearInterval(timer);
      await flush(sig);
      process.exit(0);
    });
  }

  return (req, res, next) => {
    if (req.method !== 'GET' && req.path.startsWith('/api') && req.path !== '/api/auth/login') {
      res.on('finish', () => {
        if (res.statusCode < 400) dirty = true;
      });
    }
    next();
  };
}
