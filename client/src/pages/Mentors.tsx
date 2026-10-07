import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useI18n } from '../i18n';
import { Avatar, Spinner, TagPill } from '../components';
import type { User, Tag } from '../types';

interface MentorItem extends User {
  tags: Tag[];
}

export default function Mentors() {
  const { t, loc } = useI18n();
  const nav = useNavigate();
  const [mentors, setMentors] = useState<MentorItem[] | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [filter, setFilter] = useState('');

  async function load(tag?: string) {
    const r = await api.get<{ mentors: MentorItem[] }>(`/mentors${tag ? `?tag=${tag}` : ''}`);
    setMentors(r.mentors);
  }
  useEffect(() => {
    load();
    api.get<{ tags: Tag[] }>('/tags').then((r) => setTags(r.tags.filter((t) => t.category === 'domain')));
  }, []);

  function applyFilter(slug: string) {
    setFilter(slug);
    load(slug || undefined);
  }

  async function message(id: number) {
    const r = await api.post<{ conversationId: number }>(`/messages/with/${id}`);
    nav(`/messages/${r.conversationId}`);
  }

  if (!mentors) return <Spinner />;

  return (
    <div>
      <div className="page-head">
        <h1>{t('mentors.title')}</h1>
        <p>{t('mentors.subtitle')}</p>
      </div>

      <div className="card" style={{ padding: '.8rem 1rem' }}>
        <label>{t('mentors.filter')}</label>
        <div className="flex wrap gap-sm">
          <button className={filter === '' ? 'btn-sm btn-gold' : 'btn-sm btn-outline'} onClick={() => applyFilter('')}>{t('common.all')}</button>
          {tags.map((tg) => (
            <button key={tg.id} className={filter === tg.slug ? 'btn-sm btn-gold' : 'btn-sm btn-outline'} onClick={() => applyFilter(tg.slug)}>
              {loc(tg, 'name')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-2 mt">
        {mentors.map((m) => (
          <div key={m.id} className="card">
            <div className="flex items-center gap">
              <Avatar name={m.name} seed={m.avatar_seed} size="lg" />
              <div className="grow">
                <b style={{ fontSize: '1.05rem' }}>{m.name}</b>
                {m.role === 'entrepreneur' && <span className="badge badge-stage" style={{ marginLeft: '.4rem' }} title="Entrepreneur, teilt eigene Erfahrung">Peer</span>}
                <div className="muted">{m.headline}</div>
                <small className="muted">{m.country}{m.region ? ` · ${m.region}` : ''}</small>
              </div>
            </div>
            {m.bio && <p className="mt-sm muted" style={{ fontSize: '.9rem' }}>{m.bio}</p>}
            <div className="flex wrap gap-sm">
              {m.tags.map((tg) => <TagPill key={tg.id} tag={tg} />)}
            </div>
            <button className="btn-outline btn-sm mt" onClick={() => message(m.id)}>{t('mentors.message')}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
