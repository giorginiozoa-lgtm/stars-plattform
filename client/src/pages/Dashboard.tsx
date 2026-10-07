import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Spinner } from '../components';
import { STEP_LABEL, PROGRESS_LABEL } from '../journey';
import { Stepper } from './Journey';
import type { Step } from '../types';

interface DashData {
  role: string;
  kpis: Record<string, number>;
  growth?: { month: string; n: number }[];
  topTags?: { name_de: string; name_en: string; weight: number }[];
  programme?: {
    kpis: Record<string, number>;
    funnel: { step: Step; n: number }[];
    reviewMix: Record<string, number>;
    reviewsDue: { need_id: number; review_date: string; goal: string; case_id: number; eem_name: string }[];
    outcomes: { progress: string; outcome: string; created_at: string; goal: string; case_id: number; eem_name: string }[];
  };
  network?: Record<string, number>;
  journey?: { case_id: number; step: Step; needs: { id: number; goal: string; status: string; priority_rank: number; review_date: string | null }[] } | null;
}

function Kpi({ num, label, accent }: { num: number; label: string; accent?: boolean }) {
  return (
    <div className={`kpi ${accent ? 'accent' : ''}`}>
      <div className="num">{num}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t, loc, locale } = useI18n();
  const [data, setData] = useState<DashData | null>(null);

  useEffect(() => {
    api.get<DashData>('/dashboard').then(setData).catch(() => setData(null));
  }, []);

  if (!data) return <Spinner />;
  const k = data.kpis;

  const labels: Record<string, { de: string; en: string }> = {
    entrepreneurs: { de: 'Entrepreneurs', en: 'Entrepreneurs' },
    mentors: { de: 'Expert:innen', en: 'Experts' },
    forums: { de: 'Foren', en: 'Forums' },
    threads: { de: 'Beiträge', en: 'Threads' },
    comments: { de: 'Kommentare', en: 'Comments' },
    questions_open: { de: 'Offene Fragen', en: 'Open questions' },
    questions_matched: { de: 'Zugeordnet', en: 'Matched' },
    questions_resolved: { de: 'Verbunden', en: 'Connected' },
    matches_accepted: { de: 'Aktive Mentorings', en: 'Active mentorships' },
    messages: { de: 'Nachrichten', en: 'Messages' },
    modules: { de: 'Lernmodule', en: 'Learning modules' },
    completions: { de: 'Abschlüsse', en: 'Completions' },
    suggested_matches: { de: 'Neue Vorschläge', en: 'New suggestions' },
    active_mentorships: { de: 'Aktive Mentorings', en: 'Active mentorships' },
    unread_messages: { de: 'Ungelesene Nachr.', en: 'Unread messages' },
    threads_started: { de: 'Eigene Beiträge', en: 'Threads started' },
    comments_written: { de: 'Kommentare', en: 'Comments' },
    questions_asked: { de: 'Gestellte Fragen', en: 'Questions asked' },
    conversations: { de: 'Konversationen', en: 'Conversations' },
    modules_started: { de: 'Module begonnen', en: 'Modules started' },
    modules_completed: { de: 'Abgeschlossen', en: 'Completed' },
    avg_progress: { de: 'Ø Fortschritt %', en: 'Avg. progress %' },
    invitations_open: { de: 'Offene Anfragen von stars', en: 'Open requests from stars' },
    supports_active: { de: 'Aktive Begleitungen', en: 'Active support' },
    communities_joined: { de: 'Meine Communities', en: 'My communities' },
    cases_active: { de: 'Aktive Fälle', en: 'Active cases' },
    intake_pending: { de: 'Offene Aufnahmeanträge', en: 'Pending intake requests' },
    needs_prioritized: { de: 'Priorisierte Bedarfe', en: 'Prioritised needs' },
    needs_achieved: { de: 'Erreichte Ziele', en: 'Goals achieved' },
    matches_confirmed: { de: 'Bestätigte Matches', en: 'Confirmed matches' },
    matches_pending: { de: 'Offene Einladungen', en: 'Open invitations' },
    avg_days_to_match: { de: 'Ø Tage bis zum Match', en: 'Avg. days to match' },
    communities: { de: 'Communities', en: 'Communities' },
    community_members: { de: 'Community-Mitglieder', en: 'Community members' },
    sessions_upcoming: { de: 'Geplante Sessions', en: 'Upcoming sessions' },
  };
  const tx = (de: string, en: string) => (locale === 'de' ? de : en);
  const prog = data.programme;
  const maxFunnel = Math.max(1, ...(prog?.funnel.map((f) => f.n) ?? [1]));
  const lbl = (key: string) => labels[key]?.[locale] ?? key;

  const maxGrowth = Math.max(1, ...(data.growth?.map((g) => g.n) ?? [1]));

  return (
    <div>
      <div className="page-head">
        <h1>{t('dash.welcome')}, {user!.name.split(' ')[0]} 👋</h1>
        <p>{t('dash.title')} · {t('role.' + user!.role)}</p>
      </div>

      {data.journey && (
        <div className="card">
          <div className="flex items-center"><h3 style={{ margin: 0 }}>Support Journey</h3>
            <Link className="btn btn-outline btn-sm right" to={`/journey/${data.journey.case_id}`}>{tx('Fall öffnen', 'Open case')}</Link></div>
          <Stepper step={data.journey.step} />
          {data.journey.needs.map((n) => (
            <div key={n.id} className="flex items-center gap-sm" style={{ margin: '.3rem 0' }}>
              <span className="badge badge-gold">#{n.priority_rank}</span> {n.goal}
              <span className="right">
                {n.status === 'achieved' ? <span className="badge badge-resolved">{tx('erreicht', 'achieved')}</span>
                  : n.review_date ? <span className="badge badge-stage">Review {n.review_date}</span> : null}
              </span>
            </div>
          ))}
        </div>
      )}
      {data.role === 'entrepreneur' && !data.journey && (
        <div className="card">
          <h3>Support Journey</h3>
          <p className="muted">{tx('Du brauchst gezielte Begleitung für ein konkretes Ziel? Beantrage die Aufnahme.', 'Need targeted support for a specific goal? Apply for intake.')}</p>
          <Link className="btn btn-gold" to="/journey">{tx('Aufnahme beantragen', 'Apply for intake')}</Link>
        </div>
      )}

      {data.network && (
        <div className="card">
          <h3>{tx('Netzwerk, Förderplätze & Feedback', 'Network, scholarships & feedback')}</h3>
          <p className="muted" style={{ marginTop: '-.3rem' }}>{tx('Offene Aufgaben für stars aus Iteration 3.', 'Open tasks for stars from iteration 3.')}</p>
          <div className="grid grid-4">
            <Link to="/network"><Kpi num={data.network.intros_open} label={tx('Offene Intro-Anfragen', 'Open intro requests')} accent={data.network.intros_open > 0} /></Link>
            <Link to="/network"><Kpi num={data.network.intros_accepted} label={tx('Erfolgte Vorstellungen', 'Introductions made')} /></Link>
            <Link to="/events"><Kpi num={data.network.scholarship_requests} label={tx('Offene Förderanträge', 'Open scholarship requests')} accent={data.network.scholarship_requests > 0} /></Link>
            <Link to="/communities"><Kpi num={data.network.session_requests} label={tx('Offene Slot-Anträge', 'Open slot requests')} /></Link>
            <Kpi num={data.network.peer_experts} label={tx('Peer-Expert:innen', 'Peer experts')} />
            <Link to="/registrations"><Kpi num={data.network.registrations_pending ?? 0} label={tx('Offene Registrierungen', 'Pending registrations')} accent={(data.network.registrations_pending ?? 0) > 0} /></Link>
            <Link to="/feedback"><Kpi num={data.network.feedback_new} label={tx('Neues Feedback', 'New feedback')} accent={data.network.feedback_new > 0} /></Link>
          </div>
        </div>
      )}

      {prog && (
        <div className="card">
          <h3>{tx('Programm & Wirkung', 'Programme & impact')}</h3>
          <p className="muted" style={{ marginTop: '-.3rem' }}>{tx('Outcome-orientierte Kennzahlen der Support Journey und der Communities.', 'Outcome-oriented indicators of the Support Journey and the communities.')}</p>
          <div className="grid grid-4">
            {Object.entries(prog.kpis).map(([key, val], i) => <Kpi key={key} num={val} label={lbl(key)} accent={i === 3} />)}
          </div>
          <div className="grid grid-2 mt">
            <div>
              <b>{tx('Fälle je Schritt', 'Cases per step')}</b>
              {prog.funnel.map((f) => (
                <div key={f.step} className="flex items-center gap-sm" style={{ margin: '.25rem 0' }}>
                  <small style={{ width: 110 }}>{STEP_LABEL[f.step][locale]}</small>
                  <div className="meter" style={{ flex: 1 }}><i style={{ width: `${(f.n / maxFunnel) * 100}%` }} /></div>
                  <small style={{ width: 20, textAlign: 'right' }}>{f.n}</small>
                </div>
              ))}
            </div>
            <div>
              <b>{tx('Fällige Reviews (14 Tage)', 'Reviews due (14 days)')}</b>
              {prog.reviewsDue.length === 0 && <p className="muted">{tx('Keine.', 'None.')}</p>}
              {prog.reviewsDue.map((r) => (
                <div key={r.need_id} style={{ margin: '.3rem 0' }}>
                  <Link to={`/journey/${r.case_id}`}><b>{r.eem_name}</b></Link> <span className="badge badge-stage">{r.review_date}</span>
                  <div><small className="muted">{r.goal}</small></div>
                </div>
              ))}
              <b className="mt" style={{ display: 'block' }}>{tx('Zielerreichung in Reviews', 'Goal attainment in reviews')}</b>
              <div className="flex wrap gap-sm mt-sm">
                {Object.entries(prog.reviewMix).map(([key, v]) => <span key={key} className="badge">{PROGRESS_LABEL[key][locale]}: {v}</span>)}
              </div>
            </div>
          </div>
          {prog.outcomes.length > 0 && (
            <div className="mt">
              <b>{tx('Zuletzt dokumentierte Outcomes', 'Recently documented outcomes')}</b>
              {prog.outcomes.map((o, i) => (
                <div key={i} className="list-item" style={{ padding: '.45rem 0' }}>
                  <span className={`badge ${o.progress === 'achieved' ? 'badge-resolved' : 'badge-matched'}`}>{PROGRESS_LABEL[o.progress][locale]}</span>
                  <div className="grow"><b>{o.eem_name}</b> – {o.outcome}<div><small className="muted">{o.goal}</small></div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <h3 className="mt">{tx('Aktivität', 'Activity')}</h3>
      <div className="grid grid-4">
        {Object.entries(k).map(([key, val], i) => (
          <Kpi key={key} num={val} label={lbl(key)} accent={i === 0} />
        ))}
      </div>

      {data.role === 'admin' && data.growth && (
        <div className="card mt">
          <h3>{t('dash.network')}</h3>
          <p className="muted" style={{ marginTop: '-.3rem' }}>{t('dash.newRegistrations')}</p>
          <div className="bars">
            {data.growth.map((g) => (
              <div className="bar" key={g.month}>
                <div className="fill" style={{ height: `${(g.n / maxGrowth) * 100}%` }} title={`${g.n}`} />
                <div className="cap">{g.month.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.role === 'mentor' && data.topTags && data.topTags.length > 0 && (
        <div className="card mt">
          <h3>{t('mentors.expertise')}</h3>
          {data.topTags.map((tg) => (
            <div key={tg.name_de} style={{ margin: '.6rem 0' }}>
              <div className="flex items-center"><span>{loc(tg, 'name')}</span><span className="right muted">{tg.weight}/5</span></div>
              <div className="meter"><i style={{ width: `${(tg.weight / 5) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}

      <div className="card mt">
        <h3>{t('dash.quicklinks')}</h3>
        <div className="flex wrap gap mt-sm">
          <Link className="btn btn-gold" to="/communities">{t('nav.communities')}</Link>
          <Link className="btn btn-outline" to="/journey">{t('nav.journey')}</Link>
          {user!.role === 'entrepreneur' && <Link className="btn btn-outline" to="/mentoring">{t('mentoring.ask')}</Link>}
          <Link className="btn btn-outline" to="/community">{t('nav.community')}</Link>
          <Link className="btn btn-outline" to="/mentors">{t('nav.mentors')}</Link>
          <Link className="btn btn-outline" to="/learning">{t('nav.learning')}</Link>
          <Link className="btn btn-outline" to="/messages">{t('nav.messages')}</Link>
        </div>
      </div>
    </div>
  );
}
