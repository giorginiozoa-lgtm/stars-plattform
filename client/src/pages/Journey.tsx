// Iteration 2 – Uebersicht der Support Journey: Entrepreneurs beantragen die
// Aufnahme und sehen ihren Fall, Unterstuetzer:innen ihre Anfragen, stars
// (Administration) alle Faelle nach Prozessschritt.
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Avatar, Spinner, timeAgo } from '../components';
import { STEP_ORDER, STEP_LABEL, STEP_OUTPUT, CASE_TYPE_LABEL, ROLE_LABEL } from '../journey';
import type { CaseListItem, Step } from '../types';

export function StepBadge({ step }: { step: Step }) {
  const { locale } = useI18n();
  const cls = step === 'closed' ? 'badge-resolved' : step === 'intake' ? 'badge-open' : 'badge-matched';
  return <span className={`badge ${cls}`}>{STEP_LABEL[step][locale]}</span>;
}

export function Stepper({ step }: { step: Step }) {
  const { locale } = useI18n();
  const idx = step === 'closed' ? STEP_ORDER.length : STEP_ORDER.indexOf(step);
  return (
    <ol className="stepper">
      {STEP_ORDER.map((s, i) => (
        <li key={s} className={i < idx ? 'done' : i === idx ? 'current' : ''} title={STEP_OUTPUT[s][locale]}>
          <span className="n">{i < idx ? '✓' : i + 1}</span>
          <span className="l">{STEP_LABEL[s][locale]}</span>
        </li>
      ))}
    </ol>
  );
}

function CaseCard({ c }: { c: CaseListItem }) {
  const { locale } = useI18n();
  const nav = useNavigate();
  const tx = (de: string, en: string) => (locale === 'de' ? de : en);
  return (
    <div className="card card-hover" style={{ cursor: 'pointer', padding: '.8rem' }} onClick={() => nav(`/journey/${c.id}`)}>
      <div className="flex items-center gap-sm">
        <Avatar name={c.eem.name} seed={c.eem.avatar_seed} size="sm" />
        <div style={{ minWidth: 0 }}>
          <b className="clamp" style={{ display: 'block' }}>{c.eem.name}</b>
          <small>{c.eem.country}{c.case_type ? ` · ${CASE_TYPE_LABEL[c.case_type][locale]}` : ''}</small>
        </div>
      </div>
      {c.prioritized.length > 0 && (
        <ul className="mini-list">
          {c.prioritized.map((n) => (
            <li key={n.id} className={n.status === 'achieved' ? 'ok' : ''}>{n.goal}</li>
          ))}
        </ul>
      )}
      {c.step === 'intake' && c.motivation && <p className="muted clamp" style={{ margin: '.4rem 0 0' }}>{c.motivation}</p>}
      <div className="flex wrap gap-sm mt-sm">
        {c.step !== 'closed' && (
          c.handover.canAdvance
            ? <span className="badge badge-resolved">{tx('Bereit für nächsten Schritt', 'Ready for next step')}</span>
            : <span className="badge">{c.handover.missing.length} {tx('offen', 'open')}</span>
        )}
        {c.next_review && <span className="badge badge-stage">Review {c.next_review}</span>}
        {c.my_invitations?.map((m) => (
          <span key={m.id} className={`badge ${m.status === 'confirmed' ? 'badge-resolved' : 'badge-gold'}`}>
            {ROLE_LABEL[m.role][locale]} · {m.status === 'confirmed' ? tx('bestätigt', 'confirmed') : m.supporter_ok ? tx('zugesagt', 'accepted') : tx('Anfrage offen', 'request open')}
          </span>
        ))}
      </div>
      <small className="muted">{tx('aktualisiert', 'updated')} {timeAgo(c.updated_at, locale)}</small>
    </div>
  );
}

export default function Journey() {
  const { user } = useAuth();
  const { locale } = useI18n();
  const nav = useNavigate();
  const tx = (de: string, en: string) => (locale === 'de' ? de : en);
  const [cases, setCases] = useState<CaseListItem[] | null>(null);
  const [motivation, setMotivation] = useState('');
  const [error, setError] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    api.get<{ cases: CaseListItem[] }>('/journey/cases').then((r) => setCases(r.cases));
  }, []);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const r = await api.post<{ case: { id: number } }>('/journey/cases', { motivation });
      nav(`/journey/${r.case.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  if (!cases) return <Spinner />;

  const head = (
    <div className="page-head">
      <h1>Support Journey</h1>
      <p>{tx(
        'Begleitete Unterstützung in acht Schritten: erst Bedarf klären, dann gezielt vermitteln und Fortschritt überprüfen.',
        'Guided support in eight steps: clarify the need first, then connect in a targeted way and review progress.'
      )}</p>
    </div>
  );

  // --- Entrepreneur -------------------------------------------------------
  if (user!.role === 'entrepreneur') {
    const open = cases.find((c) => c.step !== 'closed');
    return (
      <div>
        {head}
        {open ? (
          <div className="card">
            <div className="flex items-center gap-sm">
              <h3 style={{ margin: 0 }}>{tx('Mein Fall', 'My case')}</h3>
              <span className="right"><StepBadge step={open.step} /></span>
            </div>
            <Stepper step={open.step} />
            <p className="muted">{tx('Nächster Output', 'Next output')}: {STEP_OUTPUT[open.step][locale]}</p>
            <Link className="btn btn-gold" to={`/journey/${open.id}`}>{tx('Fall öffnen', 'Open case')}</Link>{' '}
            <Link className="btn btn-outline" to="/journey/profile">{tx('Mein EEM-Profil', 'My EEM profile')}</Link>
          </div>
        ) : (
          <form className="card" onSubmit={apply}>
            <h3>{tx('Aufnahme beantragen', 'Apply for intake')}</h3>
            <p className="muted">{tx(
              'Beschreibe kurz dein Anliegen. stars prüft die Aufnahme und klärt mit dir Umfang, Dauer und gegenseitige Erwartungen.',
              'Briefly describe your concern. stars reviews the intake and clarifies scope, duration and mutual expectations with you.'
            )}</p>
            <div className="field">
              <label>{tx('Mein Anliegen', 'My concern')}</label>
              <textarea value={motivation} onChange={(e) => setMotivation(e.target.value)} required />
            </div>
            <button className="btn-gold" type="submit">{tx('Antrag senden', 'Submit application')}</button>
            {error && <div className="error">{error}</div>}
          </form>
        )}
        <div className="card mt">
          <h3>{tx('Community first', 'Community first')}</h3>
          <p className="muted" style={{ margin: 0 }}>{tx(
            'Viele Fragen lösen sich am schnellsten im Austausch mit anderen Entrepreneurs und Alumni. Die Support Journey ist für priorisierte Bedarfe gedacht, die eine gezielte Begleitung brauchen.',
            'Many questions are solved fastest in exchange with other entrepreneurs and alumni. The Support Journey is meant for prioritised needs that require targeted support.'
          )}</p>
          <Link className="btn btn-outline mt-sm" to="/communities">{tx('Zu den Communities', 'Go to communities')}</Link>
        </div>
        {cases.filter((c) => c.step === 'closed').length > 0 && (
          <div className="card mt">
            <h3>{tx('Abgeschlossene Fälle', 'Closed cases')}</h3>
            {cases.filter((c) => c.step === 'closed').map((c) => <CaseCard key={c.id} c={c} />)}
          </div>
        )}
      </div>
    );
  }

  // --- Unterstuetzer:in ----------------------------------------------------
  if (user!.role === 'mentor') {
    return (
      <div>
        {head}
        {cases.length === 0 && (
          <div className="card"><p className="muted" style={{ margin: 0 }}>{tx(
            'Noch keine Anfragen. stars lädt dich ein, wenn dein Profil zu einem Matching Brief passt. Halte Rollen und Kapazität im Profil aktuell.',
            'No requests yet. stars invites you when your profile fits a matching brief. Keep roles and capacity up to date in your profile.'
          )}</p><Link className="btn btn-outline mt-sm" to="/profile">{tx('Profil', 'Profile')}</Link></div>
        )}
        <div className="grid grid-2">{cases.map((c) => <CaseCard key={c.id} c={c} />)}</div>
      </div>
    );
  }

  // --- stars-Programmkoordination: Board nach Schritten ----------------------
  const active = cases.filter((c) => c.step !== 'closed');
  const closed = cases.filter((c) => c.step === 'closed');
  return (
    <div>
      {head}
      <div className="board">
        {STEP_ORDER.map((s) => {
          const list = active.filter((c) => c.step === s);
          return (
            <div key={s} className="board-col">
              <div className="board-head">
                <b>{STEP_LABEL[s][locale]}</b>
                <span className="badge right">{list.length}</span>
              </div>
              <small className="muted" style={{ display: 'block', marginBottom: '.4rem' }}>{STEP_OUTPUT[s][locale]}</small>
              {list.map((c) => <CaseCard key={c.id} c={c} />)}
            </div>
          );
        })}
      </div>
      <div className="card mt">
        <div className="flex items-center">
          <h3 style={{ margin: 0 }}>{tx('Abgeschlossen', 'Closed')} ({closed.length})</h3>
          <button className="btn-ghost btn-sm right" onClick={() => setShowClosed((s) => !s)}>{showClosed ? '▲' : '▼'}</button>
        </div>
        {showClosed && <div className="grid grid-2 mt-sm">{closed.map((c) => <CaseCard key={c.id} c={c} />)}</div>}
      </div>
    </div>
  );
}
