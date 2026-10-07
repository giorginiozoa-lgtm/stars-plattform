// Sammelt alle englischen Quelltexte der Oberflaeche fuer die Uebersetzungs-
// kataloge (src/locales/<code>.json, Schluessel = englischer Text):
//   - tx(de, en) / trx(de, en) in den Komponenten
//   - { de: …, en: … }-Objekte (Woerterbuch, Labels, Frageboegen)
//   - Antwortoptionen o(value, de, en) der Frageboegen
//   - *_en-Felder der Stammdaten aus der Seed-Datenbank (Foren, Tags,
//     Communities, Lernmodule, Veranstaltungen)
// Ausfuehren (in client/):  node scripts/extract-i18n.mjs
// Ergebnis: src/locales/_source.json und je Sprache die Liste fehlender Texte.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const STR = String.raw`'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\x60(?:[^\x60\\$]|\\.)*\x60`;
const TX = new RegExp(String.raw`\b(?:tx|trx)\(\s*(${STR})\s*,\s*(${STR})\s*\)`, 'g');
const EN = new RegExp(String.raw`\ben:\s*(${STR})`, 'g');
// Antwortoptionen der Frageboegen: o(value, de, en?) in journey.ts
const OPT = new RegExp(String.raw`\bo\(\s*(${STR})\s*,\s*(${STR})\s*(?:,\s*(${STR})\s*)?\)`, 'g');

const unquote = (q) => {
  const body = q.slice(1, -1);
  return body.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c));
};

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== 'demo' && f !== 'locales') walk(p, out); }
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

const texts = new Set();
for (const file of walk(src)) {
  const s = readFileSync(file, 'utf8');
  for (const m of s.matchAll(TX)) texts.add(unquote(m[2]));
  for (const m of s.matchAll(EN)) texts.add(unquote(m[1]));
  for (const m of s.matchAll(OPT)) texts.add(unquote(m[3] ?? m[2]));
}

// Stammdaten aus der (frisch geseedeten) Datenbank.
const dbPath = join(here, '..', '..', 'server', 'data.sqlite');
if (existsSync(dbPath)) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const q = [
    'SELECT title_en a, description_en b FROM forums',
    'SELECT name_en a, NULL b FROM tags',
    'SELECT name_en a, description_en b FROM communities',
    'SELECT title_en a, description_en b FROM learning_modules',
    'SELECT title_en a, description_en b FROM events',
  ];
  for (const sql of q) for (const r of db.prepare(sql).all()) { if (r.a) texts.add(r.a); if (r.b) texts.add(r.b); }
}

const list = [...texts].filter((t) => t && /[A-Za-z]/.test(t)).sort();
writeFileSync(join(src, 'locales', '_source.json'), JSON.stringify(list, null, 1) + '\n');
console.log(`${list.length} Quelltexte -> src/locales/_source.json`);
for (const f of readdirSync(join(src, 'locales'))) {
  if (!/^[a-z]{2}\.json$/.test(f)) continue;
  const cat = JSON.parse(readFileSync(join(src, 'locales', f), 'utf8'));
  const missing = list.filter((t) => !(t in cat));
  console.log(`  ${f}: ${list.length - missing.length}/${list.length} uebersetzt`);
}
