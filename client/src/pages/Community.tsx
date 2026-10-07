import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useI18n } from '../i18n';
import { Avatar, Spinner, RoleBadge, timeAgo } from '../components';
import type { Forum, Thread } from '../types';

export default function Community() {
  const { t, loc, locale } = useI18n();
  const nav = useNavigate();
  const [forums, setForums] = useState<Forum[] | null>(null);
  const [active, setActive] = useState<Forum | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '' });

  useEffect(() => {
    api.get<{ forums: Forum[] }>('/forums').then((r) => setForums(r.forums));
  }, []);

  async function openForum(f: Forum) {
    setActive(f);
    setShowForm(false);
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
        <button className="btn-ghost" onClick={() => setActive(null)}>← {t('community.title')}</button>
        <div className="page-head flex items-center">
          <div>
            <h1>{loc(active, 'title')}</h1>
            <p>{loc(active, 'description')}</p>
          </div>
          <button className="btn-gold right" onClick={() => setShowForm((s) => !s)}>{t('community.newThread')}</button>
        </div>

        {showForm && (
          <form className="card" onSubmit={createThread}>
            <div className="field">
              <label>{t('community.threadTitle')}</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="field">
              <label>{t('community.threadBody')}</label>
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
      <div className="grid grid-2">
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
