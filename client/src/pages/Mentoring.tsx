import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n, trx } from '../i18n';
import { Avatar, Spinner, TagPill, timeAgo } from '../components';
import type { Question, Tag } from '../types';

export default function Mentoring() {
  const { t, loc, locale } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '' });
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await api.get<{ questions: Question[] }>('/questions');
    setQuestions(r.questions);
  }
  useEffect(() => {
    load();
    api.get<{ tags: Tag[] }>('/tags').then((r) => setTags(r.tags));
  }, []);

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<{ question: Question }>('/questions', {
        title: form.title,
        body: form.body,
        tagIds: selected,
      });
      nav(`/mentoring/question/${r.question.id}`);
    } finally {
      setBusy(false);
    }
  }

  if (!questions) return <Spinner />;

  const byCat = (cat: string) => tags.filter((t) => t.category === cat);
  const statusBadge = (s: string) => <span className={`badge badge-${s}`}>{t('mentoring.status.' + s)}</span>;

  return (
    <div>
      <div className="page-head flex items-center">
        <div>
          <h1>{t('mentoring.title')}</h1>
          <p>{t('mentoring.subtitle')}</p>
        </div>
        {user!.role === 'entrepreneur' && (
          <button className="btn-gold right" onClick={() => setShowForm((s) => !s)}>{t('mentoring.ask')}</button>
        )}
      </div>

      {showForm && (
        <form className="card" onSubmit={submit}>
          <div className="field">
            <label>{t('mentoring.qTitle')}</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="field">
            <label>{t('mentoring.qBody')}</label>
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
          </div>
          <label>{t('mentoring.selectTags')}</label>
          {['domain', 'market', 'stage'].map((cat) => (
            <div key={cat} className="flex wrap gap-sm" style={{ margin: '.4rem 0' }}>
              {byCat(cat).map((tg) => (
                <button
                  type="button"
                  key={tg.id}
                  className={selected.includes(tg.id) ? 'btn-sm btn-gold' : 'btn-sm btn-outline'}
                  onClick={() => toggle(tg.id)}
                >
                  {loc(tg, 'name')}
                </button>
              ))}
            </div>
          ))}
          <button className="btn-gold mt" type="submit" disabled={busy || selected.length === 0}>
            {t('mentoring.ask')}
          </button>
          {selected.length === 0 && <small className="muted" style={{ display: 'block', marginTop: '.4rem' }}>
            {trx('Bitte mindestens ein Fachgebiet wählen.', 'Please select at least one domain.')}
          </small>}
        </form>
      )}

      <div className="card mt">
        <h3>{t('mentoring.myQuestions')}</h3>
        {questions.length === 0 && <p className="muted">{t('common.empty')}</p>}
        {questions.map((q) => (
          <div key={q.id} className="list-item card-hover" style={{ cursor: 'pointer', padding: '.9rem .4rem' }}
            onClick={() => nav(`/mentoring/question/${q.id}`)}>
            <Avatar name={q.asker_name!} seed={q.asker_avatar} />
            <div className="grow">
              <div className="flex items-center gap-sm">
                <h4>{q.title}</h4>
                <span className="right">{statusBadge(q.status)}</span>
              </div>
              <div className="muted clamp">{q.body}</div>
              <div className="flex wrap gap-sm mt-sm">
                {q.tags?.map((tg) => <TagPill key={tg.id} tag={tg} />)}
              </div>
              <small className="muted">{q.asker_name} · {timeAgo(q.created_at, locale)}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
