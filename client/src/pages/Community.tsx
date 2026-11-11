import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useI18n, trx } from '../i18n';
import { Avatar, Spinner, RoleBadge, timeAgo } from '../components';
import type { Forum, Thread } from '../types';

export default function Community({ forumSlug }: { forumSlug?: string } = {}) {
  const { t, loc, locale } = useI18n();
  const nav = useNavigate();
  const [forums, setForums] = useState<Forum[] | null>(null);
  const [active, setActive] = useState<Forum | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '' });
  const [params, setParams] = useSearchParams();
  const tx = trx;

  // Direkteinstieg: /help (Seitenleiste «Allgemeine Fragen») bzw.
  // «Frage stellen»: /help?ask=1 oder /community?forum=general&ask=1
  useEffect(() => {
    api.get<{ forums: Forum[] }>('/forums').then((r) => {
      setForums(r.forums);
      const slug = forumSlug || params.get('forum');
      const f = slug && r.forums.find((x) => x.slug === slug);
      if (f) {
        openForum(f, params.get('ask') === '1');
        setParams({}, { replace: true });
      }
    });
  }, []);

  async function openForum(f: Forum, ask = false) {
    setActive(f);
    setShowForm(ask);
    const r = await api.get<{ threads: Thread[] }>(`/forums/${f.id}/threads`);
    setThreads(r.threads);
  }

  async function createThread(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    await api.post(`/forums/${active.id}/threads`, form);
    setForm({ title: '', body: '' });
    setShowForm(false);
    openForum(active);
  }

  if (!forums) return <Spinner />;

  if (active) {
    return (
      <div>
        <button className="btn-ghost" onClick={() => (forumSlug ? nav('/community') : setActive(null))}>← {t('community.title')}</button>
        <div className="page-head flex items-center">
          <div>
            <h1>{loc(active, 'title')}</h1>
            <p>{loc(active, 'description')}</p>
          </div>
          <button className="btn-gold right" onClick={() => setShowForm((s) => !s)}>{active.slug === 'general' ? tx('Frage stellen', 'Ask a question') : t('community.newThread')}</button>
        </div>

        {showForm && (
          <form className="card" onSubmit={createThread}>
            <div className="field">
              <label>{active.slug === 'general' ? tx('Deine Frage in einem Satz', 'Your question in one sentence') : t('community.threadTitle')}</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required autoFocus={active.slug === 'general'} />
            </div>
            <div className="field">
              <label>{active.slug === 'general' ? tx('Details (was hast du schon versucht, was brauchst du?)', 'Details (what have you tried, what do you need?)') : t('community.threadBody')}</label>
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
            </div>
            <button className="btn-gold" type="submit">{t('community.post')}</button>
          </form>
        )}

        <div className="card mt">
          {threads.length === 0 && <p className="muted">{t('common.empty')}</p>}
          {threads.map((th) => (
            <div key={th.id} className="list-item card-hover" style={{ cursor: 'pointer', padding: '.9rem .5rem' }}
              onClick={() => nav(`/community/thread/${th.id}`)}>
              <Avatar name={th.author_name!} seed={th.author_avatar} />
              <div className="grow">
                <h4>{th.title}</h4>
                <div className="muted clamp">{th.body}</div>
                <div className="flex items-center gap-sm mt-sm">
                  <small>{th.author_name}</small>
                  <RoleBadge role={th.author_role!} />
                  <small>· {timeAgo(th.created_at, locale)}</small>
                  <small className="right">💬 {th.comment_count}</small>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>{t('community.title')}</h1>
        <p>{t('community.subtitle')}</p>
      </div>
      <div className="card" style={{ background: 'var(--gold-soft)', borderColor: 'transparent' }}>
        <b>{tx('Wo stelle ich meine Frage?', 'Where do I ask my question?')}</b>
        <ul style={{ margin: '.4rem 0 .6rem', paddingLeft: '1.2rem' }}>
          <li>{tx('Einfache Frage (zur Plattform, zu stars oder allgemein): im Forum «Allgemeine Fragen & Hilfe» – die Community und das stars-Team antworten.', 'Simple question (about the platform, stars or in general): in the forum “General questions & help” – the community and the stars team will answer.')}</li>
          <li>{tx('Fachfrage, für die du eine passende Expert:in suchst:', 'Specialist question for which you need a suitable expert:')} <Link to="/mentoring">{t('nav.mentoring')}</Link></li>
          <li>{tx('Längerfristige, strukturierte Begleitung durch stars:', 'Longer-term, structured support by stars:')} <Link to="/journey">Support Journey</Link></li>
        </ul>
        {forums.some((f) => f.slug === 'general') && (
          <button className="btn-gold btn-sm" onClick={() => openForum(forums.find((f) => f.slug === 'general')!, true)}>{tx('Einfache Frage stellen', 'Ask a simple question')}</button>
        )}
      </div>
      <div className="grid grid-2 mt">
        {forums.map((f) => (
          <div key={f.id} className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => openForum(f)}>
            <h3>{loc(f, 'title')}</h3>
            <p className="muted">{loc(f, 'description')}</p>
            <div className="flex items-center gap-sm">
              <span className="badge">{f.thread_count} {t('community.threads')}</span>
              {f.last_activity && <small>· {timeAgo(f.last_activity, locale)}</small>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
