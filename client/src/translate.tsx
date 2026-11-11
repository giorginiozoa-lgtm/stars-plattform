// Uebersetzung von Inhalten der Nutzer:innen in die eingestellte Sprache.
// Reihenfolge: 1) Uebersetzungsdienst des Servers (DeepL/Google, falls
// eingerichtet), 2) Uebersetzung direkt im Browser (Chrome Translator API,
// ohne Datenuebertragung), 3) Google Translate in neuem Tab.
import { useState } from 'react';
import { api } from './api';
import { useI18n, trx } from './i18n';

type Result = { text: string; source: string | null };
const cache = new Map<string, Result>();
const key = (target: string, t: string) => `${target}\u0000${t}`;

async function viaServer(texts: string[], target: string): Promise<Result[] | null> {
  try {
    const r = await api.post<{ translations: Result[] }>('/translate', { texts, target });
    return r.translations;
  } catch {
    return null; // 501 = kein Dienst eingerichtet, 404 = Demo ohne Server
  }
}

async function viaBrowser(texts: string[], target: string): Promise<Result[] | null> {
  const w = window as any;
  if (!w.Translator || !w.LanguageDetector) return null;
  try {
    const detector = await w.LanguageDetector.create();
    const out: Result[] = [];
    const translators = new Map<string, any>();
    for (const t of texts) {
      const src: string = ((await detector.detect(t))[0]?.detectedLanguage || '').slice(0, 2);
      if (!src || src === 'un') return null;
      if (src === target) { out.push({ text: t, source: src }); continue; }
      if (!translators.has(src)) {
        const avail = await w.Translator.availability({ sourceLanguage: src, targetLanguage: target });
        if (avail === 'unavailable') return null;
        translators.set(src, await w.Translator.create({ sourceLanguage: src, targetLanguage: target }));
      }
      out.push({ text: await translators.get(src).translate(t), source: src });
    }
    return out;
  } catch {
    return null;
  }
}

/** Uebersetzt Texte; null, wenn weder Server noch Browser uebersetzen koennen. */
export async function translateTexts(texts: string[], target: string): Promise<Result[] | null> {
  const todo = texts.filter((t) => !cache.has(key(target, t)));
  if (todo.length) {
    const r = (await viaServer(todo, target)) ?? (await viaBrowser(todo, target));
    if (!r) return null;
    todo.forEach((t, i) => cache.set(key(target, t), r[i]));
  }
  return texts.map((t) => cache.get(key(target, t))!);
}

export function openGoogleTranslate(text: string, target: string) {
  const tl = target === 'zh' ? 'zh-CN' : target;
  window.open(`https://translate.google.com/?sl=auto&tl=${tl}&op=translate&text=${encodeURIComponent(text.slice(0, 4500))}`, '_blank', 'noopener');
}

/**
 * Knopf «Übersetzen» fuer eine Gruppe von Texten (z.B. ganzer Forenbeitrag mit
 * Kommentaren). onChange erhaelt die Uebersetzungen bzw. null fuer das Original.
 */
export function TranslateButton({ texts, onChange, translated, small }: {
  texts: string[];
  translated: boolean;
  onChange: (r: string[] | null) => void;
  small?: boolean;
}) {
  const { locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const cls = small ? 'btn-ghost btn-sm translate-btn' : 'btn-outline btn-sm translate-btn';

  if (translated) {
    return (
      <button type="button" className={cls} onClick={() => onChange(null)}>
        🌐 {trx('Übersetzt', 'Translated')}{source ? ` (${source.toUpperCase()} → ${locale.toUpperCase()})` : ''} · {trx('Original anzeigen', 'Show original')}
      </button>
    );
  }
  async function run() {
    setBusy(true);
    try {
      const r = await translateTexts(texts, locale);
      if (!r) { openGoogleTranslate(texts.join('\n\n'), locale); return; }
      setSource(r.find((x) => x.source && x.source !== locale)?.source ?? null);
      onChange(r.map((x) => x.text));
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" className={cls} onClick={run} disabled={busy}
      title={trx('In meine Sprache übersetzen', 'Translate into my language')}>
      🌐 {busy ? '…' : trx('Übersetzen', 'Translate')}
    </button>
  );
}

/** Einzelner Text mit eigenem Übersetzen-Knopf (Posts, Nachrichten, Fragen). */
export function TranslatableText({ text, style, small = true }: { text: string; style?: React.CSSProperties; small?: boolean }) {
  const [tr, setTr] = useState<string[] | null>(null);
  return (
    <>
      <div style={{ whiteSpace: 'pre-wrap', ...style }}>{tr ? tr[0] : text}</div>
      <TranslateButton texts={[text]} translated={!!tr} onChange={setTr} small={small} />
    </>
  );
}
