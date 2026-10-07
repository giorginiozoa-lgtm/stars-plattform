// Kleine, wiederverwendbare Praesentationskomponenten.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n, LANGUAGES } from './i18n';
import type { Tag, Role } from './types';

// Deterministische Farbe aus einem Seed (fuer Avatare ohne Bild-Upload).
function seedColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 45%, 42%)`;
}
function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
}

export function Avatar({ name, seed, size = '' }: { name: string; seed?: string; size?: '' | 'lg' | 'sm' }) {
  const s = seed || name;
  return (
    <div
      className={`avatar ${size ? 'avatar-' + size : ''}`}
      style={{ background: seedColor(s) }}
      title={name}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const { t } = useI18n();
  return <span className={`badge badge-role-${role}`}>{t('role.' + role)}</span>;
}

export function TagPill({ tag }: { tag: Tag }) {
  const { loc } = useI18n();
  const cls = tag.category === 'market' ? 'badge-market' : tag.category === 'stage' ? 'badge-stage' : 'badge-domain';
  return (
    <span className={`badge ${cls}`}>
      {loc(tag, 'name')}
      {tag.weight ? <b style={{ opacity: 0.7 }}>· {tag.weight}</b> : null}
    </span>
  );
}

export function Spinner() {
  const { t } = useI18n();
  return <div className="center-load">{t('common.loading')}</div>;
}

// Relative Zeitangabe, lokalisiert (Intl, funktioniert fuer alle Sprachen).
export function timeAgo(iso: string, locale: string): string {
  const then = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z')).getTime();
  const sec = Math.round((then - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  return rtf.format(Math.round(sec / 86400), 'day');
}

// Sprachauswahl (Kopfzeile und Anmeldeseite).
export function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <select className="lang-select" value={locale} onChange={(e) => setLocale(e.target.value)} aria-label="Language / Sprache">
      {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
    </select>
  );
}

// Deep-Link aus Benachrichtigungen: ?focus=<id> scrollt zum Element mit
// data-focus="<id>" und hebt es kurz hervor, sobald die Daten geladen sind.
export function useFocusTarget(ready: unknown) {
  const { search } = useLocation();
  useEffect(() => {
    const f = new URLSearchParams(search).get('focus');
    if (!f || !ready) return;
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-focus="${CSS.escape(f)}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('focus-flash');
      void (el as HTMLElement).offsetWidth; // Animation neu starten
      el.classList.add('focus-flash');
    }, 60);
    return () => clearTimeout(t);
  }, [search, ready]);
}
