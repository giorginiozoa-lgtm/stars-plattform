import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Avatar, Spinner } from '../components';
import type { Tag, User, SupportRole } from '../types';
import { ROLE_LABEL, ROLE_HINT } from '../journey';

export default function Profile() {
  const { refresh } = useAuth();
  const { t, loc, locale } = useI18n();
  const [me, setMe] = useState<User | null>(null);
  const [myTags, setMyTags] = useState<Map<number, number>>(new Map()); // tagId -> weight
  const [catalog, setCatalog] = useState<Tag[]>([]);
  const [form, setForm] = useState({ country: '', headline: '', bio: '' });
  const [saved, setSaved] = useState('');
  const [support, setSupport] = useState<{ roles: SupportRole[]; capacity: string; available: boolean }>({ roles: [], capacity: '', available: true });

  async function load() {
    const r = await api.get<{ user: User; tags: Tag[] }>('/auth/me');
    setMe(r.user);
    setForm({ country: r.user.country || '', headline: r.user.headline || '', bio: r.user.bio || '' });
    setMyTags(new Map(r.tags.map((tg) => [tg.id, tg.weight || 3])));
    setSupport({
      roles: r.user.support_roles || [],
      capacity: r.user.capacity_hours == null ? '' : String(r.user.capacity_hours),
      available: r.user.available !== false,
    });
    const c = await api.get<{ tags: Tag[] }>('/tags');
    setCatalog(c.tags);
  }
  useEffect(() => { load(); }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    await api.patch('/auth/me', form);
    await refresh();
    setSaved(t('profile.saved'));
    setTimeout(() => setSaved(''), 2000);
  }

  async function saveSupport() {
    await api.patch('/auth/me', { support_roles: support.roles, capacity_hours: support.capacity, available: support.available });
    setSaved(t('profile.saved'));
    setTimeout(() => setSaved(''), 2000);
  }

  function toggleTag(id: number) {
    const next = new Map(myTags);
    if (next.has(id)) next.delete(id);
    else next.set(id, 3);
    setMyTags(next);
  }
  function setWeight(id: number, w: number) {
    const next = new Map(myTags);
    next.set(id, w);
    setMyTags(next);
  }
  async function saveTags() {
    const tags = Array.from(myTags.entries()).map(([tag_id, weight]) => ({ tag_id, weight }));
    await api.put('/auth/me/tags', { tags });
    setSaved(t('profile.saved'));
    setTimeout(() => setSaved(''), 2000);
  }

  if (!me) return <Spinner />;
  const cats: { key: string; label: { de: string; en: string } }[] = [
    { key: 'domain', label: { de: 'Fachgebiete', en: 'Domains' } },
    { key: 'market', label: { de: 'Märkte', en: 'Markets' } },
    { key: 'stage', label: { de: 'Phasen', en: 'Stages' } },
    { key: 'network', label: { de: 'Netzwerkzugänge (für die Connector-Rolle)', en: 'Network access (for the connector role)' } },
  ];
  const tx = (de: string, en: string) => (locale === 'de' ? de : en);

  return (
    <div>
      <div className="page-head"><h1>{t('profile.title')}</h1></div>

      <div className="card">
        <div className="flex items-center gap">
          <Avatar name={me.name} seed={me.avatar_seed} size="lg" />
          <div>
            <h2 style={{ margin: 0 }}>{me.name}</h2>
            <span className={`badge badge-role-${me.role}`}>{t('role.' + me.role)}</span>
          </div>
        </div>
        <form className="mt" onSubmit={saveProfile}>
          <div className="row">
            <div className="field">
              <label>{t('auth.country')}</label>
              <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('auth.headline')}</label>
              <input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>{t('profile.bio')}</label>
            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
          <button className="btn-gold" type="submit">{t('common.save')}</button>
          {saved && <span className="badge badge-resolved" style={{ marginLeft: '.6rem' }}>{saved}</span>}
        </form>
      </div>

      {me.role === 'mentor' && (
        <div className="card mt">
          <h3>{tx('Mein Beitrag als Alumna/Alumnus', 'My contribution as alumna/alumnus')}</h3>
          <p className="muted" style={{ marginTop: '-.4rem' }}>{tx(
            'Grundlage für das moderierte Matching der Support Journey: Welche Rollen übernimmst du, und wie viel Zeit hast du pro Monat?',
            'Basis for the moderated matching of the Support Journey: which roles do you take on, and how much time do you have per month?'
          )}</p>
          <div className="grid grid-3">
            {(Object.keys(ROLE_LABEL) as SupportRole[]).map((r) => {
              const on = support.roles.includes(r);
              return (
                <div key={r} className={`format ${on ? 'on' : ''}`} style={{ cursor: 'pointer' }}
                  onClick={() => setSupport({ ...support, roles: on ? support.roles.filter((x) => x !== r) : [...support.roles, r] })}>
                  <b>{on ? '✓ ' : ''}{ROLE_LABEL[r][locale]}</b>
                  <small>{ROLE_HINT[r][locale]}</small>
                </div>
              );
            })}
          </div>
          <div className="row mt-sm">
            <div className="field">
              <label>{tx('Kapazität (Stunden pro Monat)', 'Capacity (hours per month)')}</label>
              <input type="number" min={0} max={80} value={support.capacity} onChange={(e) => setSupport({ ...support, capacity: e.target.value })} />
            </div>
            <div className="field">
              <label>{tx('Verfügbar für neue Anfragen', 'Available for new requests')}</label>
              <select value={support.available ? '1' : '0'} onChange={(e) => setSupport({ ...support, available: e.target.value === '1' })}>
                <option value="1">{tx('ja', 'yes')}</option>
                <option value="0">{tx('nein, aktuell ausgelastet', 'no, currently at capacity')}</option>
              </select>
            </div>
          </div>
          <button className="btn-gold" onClick={saveSupport}>{t('common.save')}</button>
          {saved && <span className="badge badge-resolved" style={{ marginLeft: '.6rem' }}>{saved}</span>}
        </div>
      )}

      {me.role === 'entrepreneur' && (
        <div className="card mt">
          <h3>{tx('EEM-Profil (Support Journey)', 'EEM profile (Support Journey)')}</h3>
          <p className="muted" style={{ margin: 0 }}>{tx('Context, Ecosystem, Venture und Entrepreneur in vier kurzen Fragebögen.', 'Context, ecosystem, venture and entrepreneur in four short questionnaires.')}</p>
          <Link className="btn btn-outline mt-sm" to="/journey/profile">{tx('Profil ausfüllen', 'Fill in profile')}</Link>
        </div>
      )}

      {me.role === 'entrepreneur' && (
        <div className="card mt">
          <h3>{tx('Give-back: Ich teile meine Erfahrung', 'Give-back: I share my experience')}</h3>
          <p className="muted" style={{ marginTop: '-.4rem' }}>{tx(
            'Auch als Entrepreneur:in hast du Erfahrung, die anderen hilft. Wenn du zustimmst, erscheinst du als «Peer» im Expert:innen-Verzeichnis, und stars kann dich bei passenden Intro-Anfragen anfragen. Massgeblich sind deine Fachgebiete unten.',
            'As an entrepreneur you have experience that helps others. If you opt in, you appear as a “peer” in the expert directory and stars can ask you for matching intro requests. Your domains below are used for matching.'
          )}</p>
          <label className="flex items-center gap-sm" style={{ cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={!!me.offers_peer_support}
              onChange={async (e) => {
                await api.patch('/auth/me', { offers_peer_support: e.target.checked });
                await refresh();
                setMe({ ...me, offers_peer_support: e.target.checked });
              }} />
            {tx('Ich bin bereit, meine Erfahrung mit anderen Entrepreneurs zu teilen', 'I am willing to share my experience with other entrepreneurs')}
          </label>
        </div>
      )}

      <div className="card mt">
        <h3>{t('profile.expertise')}</h3>
        <p className="muted" style={{ marginTop: '-.4rem' }}>{t('profile.expertiseHint')}</p>
        {cats.map((cat) => (
          <div key={cat.key} className="mt-sm">
            <label>{cat.label[locale]}</label>
            <div className="flex wrap gap-sm">
              {catalog.filter((tg) => tg.category === cat.key).map((tg) => {
                const active = myTags.has(tg.id);
                return (
                  <div key={tg.id} className={`badge ${active ? 'badge-gold' : ''}`} style={{ cursor: 'pointer', gap: '.4rem', padding: active ? '.3rem .55rem' : '.18rem .55rem' }}>
                    <span onClick={() => toggleTag(tg.id)}>{loc(tg, 'name')}</span>
                    {active && (
                      <select
                        value={myTags.get(tg.id)}
                        onChange={(e) => setWeight(tg.id, Number(e.target.value))}
                        style={{ width: 'auto', padding: '0 .2rem', height: 22, fontSize: '.75rem' }}
                      >
                        {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>{w}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <button className="btn-gold mt" onClick={saveTags}>{t('common.save')}</button>
        {saved && <span className="badge badge-resolved" style={{ marginLeft: '.6rem' }}>{saved}</span>}
      </div>
    </div>
  );
}
