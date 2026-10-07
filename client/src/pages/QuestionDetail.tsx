import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n, trx, lx } from '../i18n';
import { Avatar, Spinner, TagPill, timeAgo } from '../components';
import type { Question, Match, Community } from '../types';
import { CommunityCard } from './Communities';

export default function QuestionDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [question, setQuestion] = useState<Question | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);

  async function load() {
    const r = await api.get<{ question: Question; matches: Match[] }>(`/questions/${id}`);
    setQuestion(r.question);
    setMatches(r.matches);
    // Community first (DP10): passende Communities of Practice zu den Frage-Tags.
    const ids = (r.question.tags || []).map((tg) => tg.id).join(',');
    if (ids) api.get<{ communities: Community[] }>(`/communities/suggest?tagIds=${ids}`).then((c) => setCommunities(c.communities)).catch(() => undefined);
  }
  useEffect(() => { load(); }, [id]);

  async function accept(mentorId: number) {
    const r = await api.post<{ conversationId: number }>(`/questions/${id}/matches/${mentorId}/accept`);
    nav(`/messages/${r.conversationId}`);
  }

  async function contact(mentorId: number) {
    const r = await api.post<{ conversationId: number }>(`/messages/with/${mentorId}`);
    nav(`/messages/${r.conversationId}`);
  }

  if (!question) return <Spinner />;
  const isAsker = user!.id === question.asker_id;

  return (
    <div>
      <button className="btn-ghost" onClick={() => nav('/mentoring')}>← {t('mentoring.title')}</button>

      <div className="card mt-sm">
        <div className="flex items-center gap-sm">
          <Avatar name={question.asker_name!} seed={question.asker_avatar} />
          <div>
            <b>{question.asker_name}</b>
            <div><small>{question.asker_country} · {timeAgo(question.created_at, locale)}</small></div>
          </div>
          <span className={`badge badge-${question.status} right`}>{t('mentoring.status.' + question.status)}</span>
        </div>
        <h1 className="mt-sm" style={{ fontSize: '1.4rem' }}>{question.title}</h1>
        <p style={{ whiteSpace: 'pre-wrap' }}>{question.body}</p>
        <div className="flex wrap gap-sm">{question.tags?.map((tg) => <TagPill key={tg.id} tag={tg} />)}</div>
      </div>

      {communities.length > 0 && (
        <div className="mt">
          <h2 style={{ margin: '0 0 .3rem' }}>{trx('Community first: hier wird dein Thema schon diskutiert', 'Community first: your topic is already discussed here')}</h2>
          <p className="muted">{trx('Stelle deine Frage auch in einer Community – dort antworten mehrere Entrepreneurs und Alumni mit Erfahrung aus vergleichbaren Märkten.', 'Also ask your question in a community – several entrepreneurs and alumni with experience from comparable markets can answer there.')}</p>
          <div className="grid grid-2">{communities.map((c) => <CommunityCard key={c.id} c={c} />)}</div>
        </div>
      )}

      <div className="page-head mt flex items-center">
        <h2 style={{ margin: 0 }}>{t('mentoring.matches')}</h2>
      </div>

      {matches.length === 0 && <div className="card"><p className="muted">{t('common.empty')}</p></div>}

      <div className="grid" style={{ gap: '.8rem' }}>
        {matches.map((m, i) => (
          <div key={m.mentor_id} className={`match ${i === 0 ? 'top' : ''}`}>
            <div className="flex items-center gap">
              <Avatar name={m.mentor_name} seed={m.avatar_seed} size="lg" />
              <div className="grow">
                <div className="flex items-center gap-sm">
                  <b style={{ fontSize: '1.05rem' }}>{m.mentor_name}</b>
                  {i === 0 && <span className="badge badge-gold">★ Top-Match</span>}
                  {m.status === 'accepted' && <span className="badge badge-resolved">✓ {t('mentoring.status.resolved')}</span>}
                </div>
                <div className="muted">{m.headline}</div>
                <small className="muted">{m.country}{m.region ? ` · ${m.region}` : ''}</small>
              </div>
              <div className="score-ring" style={{ ['--p' as any]: m.score }}>
                <span>{Math.round(m.score)}</span>
              </div>
            </div>

            {/* Nachvollziehbare Begruendung des Scores */}
            <div className="mt-sm">
              {m.matchedTags && m.matchedTags.length > 0 && (
                <div className="flex wrap gap-sm" style={{ marginBottom: '.5rem' }}>
                  <small className="muted">{t('mentoring.why')}</small>
                  {m.matchedTags.map((tg, j) => (
                    <span key={j} className="badge badge-domain">{lx(tg)}</span>
                  ))}
                </div>
              )}
              <div className="grid grid-3" style={{ gap: '.5rem' }}>
                {[
                  { l: t('mentoring.coverage'), v: m.coverage ?? 0 },
                  { l: t('mentoring.expertise'), v: m.expertise ?? 0 },
                  { l: t('mentoring.market'), v: m.market ?? 0 },
                ].map((c) => (
                  <div key={c.l}>
                    <div className="flex items-center"><small>{c.l}</small><small className="right">{c.v}%</small></div>
                    <div className="meter"><i style={{ width: `${c.v}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-sm mt">
              {isAsker && m.status !== 'accepted' && (
                <button className="btn-gold btn-sm" onClick={() => accept(m.mentor_id)}>{t('mentoring.accept')}</button>
              )}
              <button className="btn-outline btn-sm" onClick={() => contact(m.mentor_id)}>{t('mentors.message')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
