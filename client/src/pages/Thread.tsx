import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useI18n } from '../i18n';
import { Avatar, Spinner, RoleBadge, timeAgo } from '../components';
import type { Thread as Th, Comment } from '../types';

export default function Thread() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t, locale } = useI18n();
  const [thread, setThread] = useState<Th | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');

  async function load() {
    const r = await api.get<{ thread: Th; comments: Comment[] }>(`/forums/threads/${id}`);
    setThread(r.thread);
    setComments(r.comments);
  }
  useEffect(() => { load(); }, [id]);

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await api.post(`/forums/threads/${id}/comments`, { body });
    setBody('');
    load();
  }

  if (!thread) return <Spinner />;

  return (
    <div>
      <button className="btn-ghost" onClick={() => nav('/community')}>← {t('nav.community')}</button>
      <div className="card mt-sm">
        <div className="post">
          <Avatar name={thread.author_name!} seed={thread.author_avatar} />
          <div className="body">
            <div className="meta flex items-center gap-sm">
              <b>{thread.author_name}</b>
              <RoleBadge role={thread.author_role!} />
              <span>· {timeAgo(thread.created_at, locale)}</span>
            </div>
            <h1 style={{ fontSize: '1.4rem' }}>{thread.title}</h1>
            <p style={{ whiteSpace: 'pre-wrap' }}>{thread.body}</p>
          </div>
        </div>
      </div>

      <div className="card mt">
        <h3>{t('community.comments')} ({comments.length})</h3>
        {comments.map((c) => (
          <div key={c.id} className="comment post">
            <Avatar name={c.author_name} seed={c.author_avatar} size="sm" />
            <div className="body">
              <div className="meta flex items-center gap-sm">
                <b>{c.author_name}</b>
                <RoleBadge role={c.author_role} />
                <span>· {timeAgo(c.created_at, locale)}</span>
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
            </div>
          </div>
        ))}

        <form className="mt" onSubmit={addComment}>
          <textarea placeholder={t('community.addComment')} value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn-gold mt-sm" type="submit">{t('community.post')}</button>
        </form>
      </div>
    </div>
  );
}
