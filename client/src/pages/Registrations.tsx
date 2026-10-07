// Freigabe neuer Registrierungen durch stars (Administration).
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { Avatar, Spinner, timeAgo } from '../components';
import type { Role } from '../types';

interface Account {
  id: number;
  email: string;
  name: string;
  role: Role;
  country: string | null;
  headline: string | null;
  signup_note: string | null;
  status: 'pending' | 'active' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
}

const STATUS: Record<Account['status'], { de: string; en: string; cls: string }> = {
  pending: { de: 'wartet auf Freigabe', en: 'awaiting approval', cls: 'badge-gold' },
  active: { de: 'aktiv', en: 'active', cls: 'badge-resolved' },
  rejected: { de: 'abgelehnt / gesperrt', en: 'rejected / blocked', cls: 'badge-open' },
};

export default function Registrations() {
  const { locale, t } = useI18n();
  const tx = (de: string, en: string) => (locale === 'de' ? de : en);
  const [users, setUsers] = useState<Account[] | null>(null);
  const [roles, setRoles] = useState<Record<number, Role>>({});
  const [filter, setFilter] = useState('');

  const load = async () => setUsers((await api.get<{ users: Account[] }>('/users')).users);
  useEffect(() => { load(); }, []);

  async function setStatus(u: Account, status: Account['status']) {
    await api.post(`/users/${u.id}/status`, { status, role: roles[u.id] ?? u.role });
    load();
  }

  if (!users) return <Spinner />;
  const pending = users.filter((u) => u.status === 'pending');
  const q = filter.trim().toLowerCase();
  const others = users
    .filter((u) => u.status !== 'pending' && u.role !== 'admin')
    .filter((u) => !q || `${u.name} ${u.email} ${u.country ?? ''}`.toLowerCase().includes(q));

  return (
    <div>
      <div className="page-head">
        <h1>{tx('Registrierungen', 'Registrations')}</h1>
        <p>{tx(
          'Neue Konten können die Plattform erst nutzen, wenn stars sie freigibt. So bleibt die Community auf Fellows, Alumni und eingeladene Expert:innen beschränkt.',
          'New accounts can use the platform only after stars approves them. This keeps the community limited to fellows, alumni and invited experts.'
        )}</p>
      </div>

      <div className="card">
        <h3>{tx('Zur Freigabe', 'Awaiting approval')} ({pending.length})</h3>
        {pending.length === 0 && <p className="muted">{tx('Keine offenen Registrierungen.', 'No pending registrations.')}</p>}
        {pending.map((u) => (
          <div key={u.id} className="list-item">
            <Avatar name={u.name} size="sm" />
            <div className="grow">
              <b>{u.name}</b> <small className="muted">{u.email} · {timeAgo(u.created_at, locale)}</small>
              <div className="muted">{[u.country, u.headline].filter(Boolean).join(' · ')}</div>
              {u.signup_note && <div>«{u.signup_note}»</div>}
            </div>
            <div className="flex gap-sm wrap items-center" style={{ justifyContent: 'flex-end' }}>
              <select style={{ width: 'auto' }} value={roles[u.id] ?? u.role} onChange={(e) => setRoles({ ...roles, [u.id]: e.target.value as Role })} aria-label={tx('Rolle', 'Role')}>
                <option value="entrepreneur">{t('role.entrepreneur')}</option>
                <option value="mentor">{t('role.mentor')}</option>
              </select>
              <button className="btn-gold btn-sm" onClick={() => setStatus(u, 'active')}>{tx('Freigeben', 'Approve')}</button>
              <button className="btn-outline btn-sm" onClick={() => setStatus(u, 'rejected')}>{tx('Ablehnen', 'Reject')}</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card mt">
        <div className="flex items-center gap-sm">
          <h3 style={{ margin: 0 }}>{tx('Alle Konten', 'All accounts')} ({others.length})</h3>
          <input className="right" style={{ maxWidth: 260 }} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={tx('Suchen …', 'Search …')} />
        </div>
        {others.map((u) => (
          <div key={u.id} className="list-item">
            <Avatar name={u.name} size="sm" />
            <div className="grow">
              <b>{u.name}</b> <small className="muted">{u.email} · {t('role.' + u.role)}</small>
              <div className="muted">{u.country}</div>
            </div>
            <span className={`badge ${STATUS[u.status].cls}`} style={{ alignSelf: 'center' }}>{STATUS[u.status][locale]}</span>
            {u.status === 'active'
              ? <button className="btn-ghost btn-sm" onClick={() => setStatus(u, 'rejected')}>{tx('Sperren', 'Block')}</button>
              : <button className="btn-outline btn-sm" onClick={() => setStatus(u, 'active')}>{tx('Freigeben', 'Approve')}</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
