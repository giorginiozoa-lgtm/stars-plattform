// Uebersetzung von Inhalten der Nutzer:innen (Foren, Posts, Nachrichten) in die
// Sprache der lesenden Person (Wunsch Markus Prandini, Feedback 11/2026).
// Anbieter per Umgebungsvariable:
//   DEEPL_API_KEY          DeepL (Free-Schluessel endet auf ':fx')
//   GOOGLE_TRANSLATE_KEY   Google Cloud Translation v2 (alle 16 Sprachen)
// Ohne Schluessel antwortet die API mit 501; der Client weicht dann auf die
// Uebersetzung im Browser bzw. Google Translate aus.
// Ergebnisse werden in der Tabelle translations zwischengespeichert, damit
// jeder Text pro Zielsprache nur einmal uebersetzt (und bezahlt) wird.
import { Router } from 'express';
import { createHash } from 'node:crypto';
import { db } from '../db.js';
import { authRequired } from '../auth.js';

const router = Router();

const DEEPL_KEY = process.env.DEEPL_API_KEY || '';
const GOOGLE_KEY = process.env.GOOGLE_TRANSLATE_KEY || '';
const LANGS = new Set(['en', 'de', 'fr', 'es', 'pt', 'ar', 'hi', 'bn', 'ne', 'ur', 'sw', 'am', 'vi', 'id', 'zh', 'tr']);
// Zielsprachen, die DeepL anbietet (Rest -> Google, falls vorhanden).
const DEEPL_TARGET = { en: 'EN-GB', de: 'DE', fr: 'FR', es: 'ES', pt: 'PT-PT', ar: 'AR', id: 'ID', tr: 'TR', zh: 'ZH-HANS', vi: 'VI' };

function providerFor(target) {
  if (DEEPL_KEY && DEEPL_TARGET[target]) return 'deepl';
  if (GOOGLE_KEY) return 'google';
  return null;
}

db.exec(`CREATE TABLE IF NOT EXISTS translations (
  hash        TEXT NOT NULL,
  target      TEXT NOT NULL,
  text        TEXT NOT NULL,
  source      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (hash, target)
)`);
const hashOf = (s) => createHash('sha256').update(s).digest('hex');

async function viaDeepl(texts, target) {
  const host = DEEPL_KEY.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
  const r = await fetch(`https://${host}/v2/translate`, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texts, target_lang: DEEPL_TARGET[target] }),
  });
  if (!r.ok) throw new Error(`DeepL ${r.status}`);
  const d = await r.json();
  return d.translations.map((t) => ({ text: t.text, source: String(t.detected_source_language || '').toLowerCase() }));
}

async function viaGoogle(texts, target) {
  const r = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(GOOGLE_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, target, format: 'text' }),
  });
  if (!r.ok) throw new Error(`Google ${r.status}`);
  const d = await r.json();
  return d.data.translations.map((t) => ({ text: t.translatedText, source: t.detectedSourceLanguage || '' }));
}

router.get('/status', authRequired, (_req, res) => {
  res.json({ deepl: !!DEEPL_KEY, google: !!GOOGLE_KEY });
});

router.post('/', authRequired, async (req, res) => {
  const { texts, target } = req.body || {};
  if (!LANGS.has(target)) return res.status(400).json({ error: 'Unbekannte Zielsprache' });
  if (!Array.isArray(texts) || !texts.length || texts.length > 50 || texts.some((t) => typeof t !== 'string' || t.length > 5000)) {
    return res.status(400).json({ error: 'texts: 1–50 Texte mit je max. 5000 Zeichen' });
  }
  const provider = providerFor(target);
  if (!provider) return res.status(501).json({ error: 'Kein Übersetzungsdienst eingerichtet' });

  const get = db.prepare('SELECT text, source FROM translations WHERE hash = ? AND target = ?');
  const out = texts.map((t) => (t.trim() ? get.get(hashOf(t), target) : { text: t, source: '' }) || null);
  const missing = texts.map((t, i) => (out[i] ? -1 : i)).filter((i) => i >= 0);
  if (missing.length) {
    try {
      const fresh = await (provider === 'deepl' ? viaDeepl : viaGoogle)(missing.map((i) => texts[i]), target);
      const ins = db.prepare('INSERT OR REPLACE INTO translations (hash, target, text, source) VALUES (?, ?, ?, ?)');
      missing.forEach((i, k) => {
        out[i] = fresh[k];
        ins.run(hashOf(texts[i]), target, fresh[k].text, fresh[k].source);
      });
    } catch (err) {
      console.error('[translate]', err.message || err);
      return res.status(502).json({ error: 'Übersetzung fehlgeschlagen' });
    }
  }
  res.json({ translations: out.map((o) => ({ text: o.text, source: o.source || null })) });
});

export default router;
