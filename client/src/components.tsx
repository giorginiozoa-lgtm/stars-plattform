// Kleine, wiederverwendbare Praesentationskomponenten.
import { useI18n } from './i18n';
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

// Relative Zeitangabe, lokalisiert.
export function timeAgo(iso: string, locale: 'de' | 'en'): string {
  const then = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z')).getTime();
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (locale === 'de') {
    if (d > 0) return `vor ${d} Tag${d > 1 ? 'en' : ''}`;
    if (h > 0) return `vor ${h} Std.`;
    if (m > 0) return `vor ${m} Min.`;
    return 'gerade eben';
  }
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}
