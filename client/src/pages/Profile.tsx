import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n, lx, trx } from '../i18n';
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
  const tx = trx;

  return (
    <div>
      <div className="page-head flex items-center">
        <h1>{t('profile.title')}</h1>
        <Link className="btn btn-outline btn-sm right" to="/welcome">★ {tx('Einführung erneut ansehen', 'Show introduction again')}</Link>
      </div>

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
                  <b>{on ? '✓ ' : ''}{lx(ROLE_LABEL[r])}</b>
                  <small>{lx(ROLE_HINT[r])}</small>
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
            <label>{lx(cat.label)}</label>
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

      <NotificationSettings />
    </div>
  );
}

// E-Mail-Benachrichtigungen je Kategorie und Sichtbarkeit des Online-Status.
const MAIL_CATEGORIES: { key: string; label: { de: string; en: string } }[] = [
  { key: 'messages', label: { de: 'Direktnachrichten', en: 'Direct messages' } },
  { key: 'forum', label: { de: 'Foren: Antworten auf meine Beiträge und neue Fragen', en: 'Forums: replies to my posts and new questions' } },
  { key: 'questions', label: { de: 'Expertenfragen und Matching', en: 'Expert questions and matching' } },
  { key: 'journey', label: { de: 'Support Journey', en: 'Support Journey' } },
  { key: 'communities', label: { de: 'Communities und Sessions', en: 'Communities and sessions' } },
  { key: 'network', label: { de: 'Netzwerk und Intros', en: 'Network and intros' } },
  { key: 'events', label: { de: 'Veranstaltungen und Förderplätze', en: 'Events and funded places' } },
  { key: 'account', label: { de: 'Konto, Feedback und Administration', en: 'Account, feedback and administration' } },
];

interface NotifPrefs {
  email: string;
  mail_configured: boolean;
  prefs: { enabled: boolean; categories: Record<string, boolean> };
  show_online: boolean;
}

function NotificationSettings() {
  const tx = trx;
  const [p, setP] = useState<NotifPrefs | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.get<NotifPrefs>('/notifications/preferences').then((r) => {
      setP(r);
      if (location.hash === '#notifications') setTimeout(() => document.getElementById('notifications')?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
  }, []);

  async function save(body: Partial<{ prefs: Partial<NotifPrefs['prefs']>; show_online: boolean }>) {
    const r = await api.put<NotifPrefs>('/notifications/preferences', body);
    setP(r);
    setMsg({ ok: true, text: tx('Gespeichert', 'Saved') });
    setTimeout(() => setMsg(null), 2000);
  }
  async function test() {
    try {
      const r = await api.post<{ email: string }>('/notifications/preferences/test');
      setMsg({ ok: true, text: `${tx('Test-E-Mail verschickt an', 'Test email sent to')} ${r.email}` });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
  }

  if (!p) return null;
  return (
    <div className="card mt" id="notifications">
      <h3>{tx('Benachrichtigungen per E-Mail', 'Email notifications')}</h3>
      <p className="muted" style={{ marginTop: '-.4rem' }}>{tx(
        'Wähle, wofür du eine E-Mail erhalten möchtest. Bist du gerade online oder hast du die Benachrichtigung schon in der App gelesen, kommt keine E-Mail. Mehrere Benachrichtigungen werden zusammengefasst.',
        'Choose what you want to receive an email for. If you are online or have already read the notification in the app, no email is sent. Several notifications are combined into one email.'
      )}</p>
      {!p.mail_configured && (
        <p className="badge badge-stage" style={{ whiteSpace: 'normal' }}>{tx(
          'Hinweis: Der E-Mail-Versand ist auf diesem Server noch nicht eingerichtet. Deine Auswahl wird trotzdem gespeichert.',
          'Note: email delivery is not yet set up on this server. Your choice is saved anyway.'
        )}</p>
      )}
      <label className="switch-row">
        <input type="checkbox" checked={p.prefs.enabled} onChange={(e) => save({ prefs: { enabled: e.target.checked } })} />
        <b>{tx('E-Mail-Benachrichtigungen erhalten an', 'Receive email notifications at')} {p.email}</b>
      </label>
      <div style={{ paddingLeft: '1.4rem', opacity: p.prefs.enabled ? 1 : 0.5 }}>
        {MAIL_CATEGORIES.map((c) => (
          <label key={c.key} className="switch-row">
            <input type="checkbox" disabled={!p.prefs.enabled} checked={!!p.prefs.categories[c.key]}
              onChange={(e) => save({ prefs: { categories: { [c.key]: e.target.checked } } })} />
            {lx(c.label)}
          </label>
        ))}
      </div>
      {p.mail_configured && p.prefs.enabled && (
        <button className="btn-outline btn-sm mt-sm" onClick={test}>{tx('Test-E-Mail senden', 'Send test email')}</button>
      )}

      <h3 className="mt">{tx('Online-Status', 'Online status')}</h3>
      <label className="switch-row">
        <input type="checkbox" checked={p.show_online} onChange={(e) => save({ show_online: e.target.checked })} />
        {tx('Anderen zeigen, wann ich online bin (grüner Punkt, «zuletzt online»)', 'Show others when I am online (green dot, “last seen”)')}
      </label>
      {msg && <span className={`badge ${msg.ok ? 'badge-resolved' : 'badge-gold'}`} style={{ marginTop: '.4rem' }}>{msg.text}</span>}
    </div>
  );
}
