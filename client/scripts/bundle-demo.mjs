// Fasst das Ergebnis von `vite build --config vite.config.demo.ts` (Ordner
// client/demo-dist) zu EINER eigenstaendigen HTML-Datei zusammen: JavaScript
// und CSS werden inline eingebettet, sodass keine weiteren Dateien noetig sind.
//
// Ergebnis:  Plattform/stars-Prototyp-Demo.html
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '..', 'demo-dist');
const htmlPath = join(distDir, 'index.demo.html');
const outPath = resolve(__dirname, '..', '..', 'stars-Prototyp-Demo.html');

if (!existsSync(htmlPath)) {
  console.error(`Build-Ergebnis nicht gefunden: ${htmlPath}\nBitte zuerst den Vite-Build ausfuehren.`);
  process.exit(1);
}

let html = readFileSync(htmlPath, 'utf8');

// Inhalte so entschaerfen, dass sie ein <script>/<style>-Element nicht vorzeitig beenden.
const safeScript = (s) => s.replace(/<\/script/gi, '<\\/script');
const safeStyle = (s) => s.replace(/<\/style/gi, '<\\/style');

let inlinedJs = 0;
let inlinedCss = 0;

// <script type="module" ... src="./assets/demo.js"></script>  ->  inline
html = html.replace(
  /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi,
  (match, src) => {
    const file = join(distDir, src.replace(/^\.?\//, ''));
    if (!existsSync(file)) return match;
    inlinedJs++;
    return `<script type="module">\n${safeScript(readFileSync(file, 'utf8'))}\n</script>`;
  }
);

// <link rel="stylesheet" href="./assets/demo.css">  ->  <style>
html = html.replace(
  /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
  (match, href) => {
    const file = join(distDir, href.replace(/^\.?\//, ''));
    if (!existsSync(file)) return match;
    inlinedCss++;
    return `<style>\n${safeStyle(readFileSync(file, 'utf8'))}\n</style>`;
  }
);

// Modul-Preloads verweisen auf nun nicht mehr vorhandene Dateien.
html = html.replace(/<link\b[^>]*\brel=["']modulepreload["'][^>]*>\s*/gi, '');

if (inlinedJs === 0) {
  console.error('Kein JavaScript-Bundle gefunden – Abbruch.');
  process.exit(1);
}

const banner = `<!--
  stars Community-Plattform – MVP-Prototyp (Bachelorarbeit, Kalaidos FH)
  EIGENSTAENDIGE DEMO-VERSION

  Diese Datei enthaelt das vollstaendige Frontend des Prototyps sowie ein
  funktionsgleiches Demo-Backend, das direkt im Browser laeuft. Es wird weder
  ein Server noch eine Internetverbindung benoetigt: Datei einfach im Browser
  oeffnen (Chrome, Edge, Firefox oder Safari).

  Demo-Zugaenge – Passwort fuer alle Konten: stars1234
    Administration   admin@the-stars.ch
    Expert:in        anna.keller@example.com
    Entrepreneur:in  amara.okafor@example.com

  Alle Inhalte sind fiktive Demonstrationsdaten, KEINE empirischen
  Erhebungsdaten. Aenderungen werden nur lokal im Browser gespeichert und
  koennen ueber den Chip unten rechts zurueckgesetzt werden.
-->
`;

writeFileSync(outPath, banner + html, 'utf8');

const kb = (Buffer.byteLength(banner + html, 'utf8') / 1024).toFixed(0);
console.log(`Demo-Datei erstellt: ${outPath}`);
console.log(`  ${inlinedJs} JS-Bundle(s), ${inlinedCss} CSS-Datei(en) eingebettet – ${kb} kB`);
