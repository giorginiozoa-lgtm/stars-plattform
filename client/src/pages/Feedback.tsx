// Iteration 3 – Feedback an das Entwicklungsteam (FA-28).
// Laufender Evaluationskanal fuer die Testprojekte: Nutzer:innen melden Fehler,
// Ideen und Usability-Probleme; die Administration triagiert und antwortet.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n, lx, trx } from '../i18n';
import { Spinner, timeAgo } from '../components';
import { FEEDBACK_EMAIL, ISSUES_URL, isDemo } from '../config';
import type { FeedbackCategory, FeedbackEntry } from '../types';

const CATS: Record<FeedbackCategory, { de: string; en: string; ico: string }> = {
  bug: { de: 'Fehler', en: 'Bug', ico: '🐞' },
  usability: { de: 'Bedienung unklar', en: 'Usability', ico: '🧭' },
  idea: { de: 'Idee / Wunsch', en: 'Idea / wish', ico: '💡' },
  praise: { de: 'Lob', en: 'Praise', ico: '👍' },
  other: { de: 'Sonstiges', en: 'Other', ico: '💬' },
};
const STATUS: Record<FeedbackEntry['status'], { de: string; en: string; cls: string }> = {
  new: { de: 'neu', en: 'new', cls: 'badge-gold' },
  in_progress: { de: 'in Bearbeitung', en: 'in progress', cls: 'badge-stage' },
  done: { de: 'erledigt', en: 'done', cls: 'badge-resolved' },
};
const AREAS: [string, string][] = [
  ['Allgemein', 'General'], ['Dashboard', 'Dashboard'], ['Communities', 'Communities'], ['Support Journey', 'Support Journey'],
  ['Netzwerk & Intros', 'Network & intros'], ['Veranstaltungen', 'Events'], ['Foren', 'Forums'], ['Expertenfragen', 'Expert questions'],
  ['Nachrichten', 'Messages'], ['Microlearning', 'Microlearning'], ['Profil', 'Profile'], ['Mobil / Offline', 'Mobile / offline'],
];

function toCsv(rows: FeedbackEntry[]) {
  const head = ['id', 'created_at', 'user', 'role', 'category', 'area', 'rating', 'page', 'status', 'body', 'response'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [head.join(';'), ...rows.map((r) => [r.id, r.created_at, r.user_name, r.user_role, r.category, r.area, r.rating, r.page, r.status, r.body, r.response].map(esc).join(';'))].join('\n');
}

function AdminItem({ f, reload }: { f: FeedbackEntry; reload: () => void }) {
  const { locale } = useI18n();
  const tx = trx;
  const [resp, setResp] = useState(f.response || '');
  return (
    <div className="subcard">
      <div className="flex gap-sm wrap items-center">
        <select value={f.status} style={{ width: 'auto' }} onChange={async (e) => { await api.patch(`/feedback/${f.id}`, { status: e.target.value }); reload(); }}>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{lx(v)}</option>)}
        </select>
        <input value={resp} onChange={(e) => setResp(e.target.value)} placeholder={tx('Antwort an die Person …', 'Reply to the person …')} style={{ flex: 1, minWidth: 180 }} />
        <button className="btn-outline btn-sm" disabled={!resp.trim() || resp === f.response} onClick={async () => { await api.patch(`/feedback/${f.id}`, { response: resp }); reload(); }}>{tx('Antworten', 'Reply')}</button>
      </div>
    </div>
  );
}

export default function Feedback() {
  const { user } = useAuth();
  const { locale } = useI18n();
  const tx = trx;
  const [params] = useSearchParams();
  const from = params.get('from') || '';
  const [list, setList] = useState<FeedbackEntry[] | null>(null);
  const [f, setF] = useState<{ category: FeedbackCategory; area: string; rating: number; body: string }>({ category: 'idea', area: '', rating: 0, body: '' });
  const [sent, setSent] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | FeedbackEntry['status']>('all');
  const isAdmin = user!.role === 'admin';

  const load = async () => setList((await api.get<{ feedback: FeedbackEntry[] }>('/feedback')).feedback);
  useEffect(() => { load(); }, []);

  const mailBody = `${CATS[f.category].de}${f.area ? ` · ${f.area}` : ''}${f.rating ? ` · ${f.rating}/5` : ''}\n${tx('Seite', 'Page')}: ${from || '-'}\n${tx('Rolle', 'Role')}: ${user!.role}\n\n${f.body}`;
  const subject = `stars-Plattform Feedback: ${CATS[f.category].de}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/feedback', { ...f, rating: f.rating || null, page: from || null });
    setSent(mailBody);
    setF({ category: f.category, area: f.area, rating: 0, body: '' });
    load();
  }

  if (!list) return <Spinner />;
  const shown = filter === 'all' ? list : list.filter((x) => x.status === filter);

  return (
    <div>
      <div className="page-head flex items-center">
        <div>
          <h1>{tx('Feedback an die Entwickler', 'Feedback to the developers')}</h1>
          <p>{tx(
            'Was funktioniert nicht, was ist unklar, was fehlt? Jede Rückmeldung fliesst in die nächste Iteration der Plattform ein.',
            'What does not work, what is unclear, what is missing? Every message feeds into the next iteration of the platform.'
          )}</p>
        </div>
        {isAdmin && list.length > 0 && (
          <a className="btn btn-outline right" download={`stars-feedback-${new Date().toISOString().slice(0, 10)}.csv`}
            href={`data:text/csv;charset=utf-8,${encodeURIComponent('﻿' + toCsv(list))}`}>⬇ CSV</a>
        )}
      </div>

      {(
        <form className="card" onSubmit={submit}>
          <div className="field">
            <label>{tx('Art der Rückmeldung', 'Type of feedback')}</label>
            <div className="flex wrap gap-sm">
              {(Object.keys(CATS) as FeedbackCategory[]).map((c) => (
                <button type="button" key={c} className={f.category === c ? 'btn-gold btn-sm' : 'btn-outline btn-sm'} onClick={() => setF({ ...f, category: c })}>
                  {CATS[c].ico} {lx(CATS[c])}
                </button>
              ))}
            </div>
          </div>
          <div className="row">
            <div className="field"><label>{tx('Bereich', 'Area')}</label>
              <select value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>
                <option value="">–</option>
                {AREAS.map(([de, en]) => <option key={de} value={de}>{trx(de, en)}</option>)}
              </select></div>
            <div className="field"><label>{tx('Gesamteindruck (optional)', 'Overall impression (optional)')}</label>
              <div className="flex gap-sm" role="radiogroup">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button" key={n} aria-label={`${n}/5`} className={f.rating >= n ? 'btn-gold btn-sm' : 'btn-outline btn-sm'}
                    onClick={() => setF({ ...f, rating: f.rating === n ? 0 : n })}>★</button>
                ))}
              </div></div>
          </div>
          <div className="field"><label>{tx('Beschreibung', 'Description')}</label>
            <textarea rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required
              placeholder={f.category === 'bug'
                ? tx('Was hast du gemacht, was ist passiert, was hättest du erwartet?', 'What did you do, what happened, what did you expect?')
                : tx('Beschreibe deine Rückmeldung möglichst konkret …', 'Describe your feedback as concretely as possible …')} /></div>
          {from && <small className="muted">{tx('Gesendet von Seite', 'Sent from page')}: {from}</small>}
          <div className="mt-sm"><button className="btn-gold" type="submit">{tx('Feedback senden', 'Send feedback')}</button></div>
        </form>
      )}

      {sent && (
        <div className="notice mt">
          <b>{tx('Danke für dein Feedback!', 'Thank you for your feedback!')}</b>
          {isDemo() && (
            <>
              <div style={{ marginTop: '.3rem' }}>{tx(
                'Hinweis: In dieser Demo-Version werden Daten nur in deinem Browser gespeichert. Damit dein Feedback das Entwicklungsteam erreicht, sende es bitte zusätzlich ab:',
                'Note: this demo version stores data only in your browser. To make sure your feedback reaches the developers, please also send it:')}</div>
              <div className="flex wrap gap-sm mt-sm">
                {FEEDBACK_EMAIL && <a className="btn btn-gold btn-sm" href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(sent)}`}>✉ {tx('Per E-Mail senden', 'Send by email')}</a>}
                <a className="btn btn-outline btn-sm" target="_blank" rel="noreferrer" href={`${ISSUES_URL}?title=${encodeURIComponent(subject)}&body=${encodeURIComponent(sent)}`}>{tx('Als GitHub-Issue melden', 'Report as GitHub issue')}</a>
                <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(sent)}>{tx('Text kopieren', 'Copy text')}</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex items-center mt">
        <h3 style={{ margin: 0 }}>{isAdmin ? tx('Eingegangenes Feedback', 'Received feedback') : tx('Mein Feedback', 'My feedback')} ({list.length})</h3>
        {isAdmin && (
          <div className="tabs right" style={{ marginBottom: 0 }}>
            {(['all', 'new', 'in_progress', 'done'] as const).map((s) => (
              <button key={s} className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>
                {s === 'all' ? tx('Alle', 'All') : lx(STATUS[s])} ({s === 'all' ? list.length : list.filter((x) => x.status === s).length})
              </button>
            ))}
          </div>
        )}
      </div>
      {shown.length === 0 && <p className="muted">{tx('Noch kein Feedback.', 'No feedback yet.')}</p>}
      {shown.map((x) => (
        <div key={x.id} className="card mt-sm">
          <div className="flex items-center gap-sm wrap">
            <span className="badge">{CATS[x.category].ico} {lx(CATS[x.category])}</span>
            {x.area && <span className="badge badge-domain">{x.area}</span>}
            {x.rating && <span className="badge">{'★'.repeat(x.rating)}</span>}
            <small className="muted">{isAdmin && x.user_name ? `${x.user_name} · ` : ''}{timeAgo(x.created_at, locale)}{x.page ? ` · ${x.page}` : ''}</small>
            <span className={`badge ${STATUS[x.status].cls} right`}>{lx(STATUS[x.status])}</span>
          </div>
          <p style={{ whiteSpace: 'pre-wrap', margin: '.5rem 0 0' }}>{x.body}</p>
          {x.response && !isAdmin && <div className="notice mt-sm">💬 <b>{tx('Antwort des Teams', 'Reply from the team')}:</b> {x.response}</div>}
          {isAdmin && <AdminItem f={x} reload={load} />}
        </div>
      ))}
    </div>
  );
}
