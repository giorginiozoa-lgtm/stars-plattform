import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Avatar, Spinner, timeAgo } from '../components';
import type { Conversation, Message, User } from '../types';

export default function Messages() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [partner, setPartner] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  async function loadConvs() {
    const r = await api.get<{ conversations: Conversation[] }>('/messages');
    setConvs(r.conversations);
  }
  async function loadThread(cid: string) {
    const r = await api.get<{ partner: User; messages: Message[] }>(`/messages/${cid}`);
    setPartner(r.partner);
    setMessages(r.messages);
  }

  useEffect(() => { loadConvs(); }, []);
  useEffect(() => {
    if (!id) { setPartner(null); setMessages([]); return; }
    loadThread(id);
    const t = setInterval(() => loadThread(id), 8000); // sanftes Polling
    return () => clearInterval(t);
  }, [id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !id) return;
    await api.post(`/messages/${id}/messages`, { body: text });
    setText('');
    await loadThread(id);
    loadConvs();
  }

  if (!convs) return <Spinner />;

  return (
    <div>
      <div className="page-head"><h1>{t('messages.title')}</h1></div>
      <div className="chat card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="conv-list" style={{ borderRight: '1px solid var(--border)', padding: '.5rem' }}>
          {convs.length === 0 && <p className="muted" style={{ padding: '.6rem' }}>{t('messages.empty')}</p>}
          {convs.map((c) => (
            <div key={c.id} className={`conv ${String(c.id) === id ? 'active' : ''}`} onClick={() => nav(`/messages/${c.id}`)}>
              <Avatar name={c.partner.name} seed={c.partner.avatar_seed} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="flex items-center gap-sm">
                  <b className="clamp" style={{ fontSize: '.9rem' }}>{c.partner.name}</b>
                  {c.unread > 0 && <span className="badge badge-gold right">{c.unread}</span>}
                </div>
                {c.lastMessage && <div className="muted clamp" style={{ fontSize: '.8rem' }}>{c.lastMessage.body}</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="thread">
          {!id || !partner ? (
            <div className="center-load" style={{ height: '100%' }}>{t('messages.select')}</div>
          ) : (
            <>
              <div className="flex items-center gap-sm" style={{ padding: '.8rem 1rem', borderBottom: '1px solid var(--border)' }}>
                <Avatar name={partner.name} seed={partner.avatar_seed} size="sm" />
                <div>
                  <b>{partner.name}</b>
                  <div><small className="muted">{partner.headline}</small></div>
                </div>
              </div>
              <div className="messages">
                {messages.map((m) => (
                  <div key={m.id} className={`bubble ${m.sender_id === user!.id ? 'mine' : ''}`}>
                    <div>{m.body}</div>
                    <div className="t">{timeAgo(m.created_at, locale)}</div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <form className="composer" onSubmit={send}>
                <input placeholder={t('messages.placeholder')} value={text} onChange={(e) => setText(e.target.value)} />
                <button className="btn-gold" type="submit">{t('common.send')}</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
