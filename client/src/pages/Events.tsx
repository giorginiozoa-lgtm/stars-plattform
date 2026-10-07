// Iteration 3 – Veranstaltungen und Foerderplaetze (FA-26).
// Die Plattform erfasst Interesse und Antraege; ueber die Vergabe entscheidet stars.
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n, dateLocale, lx, trx } from '../i18n';
import { Avatar, Spinner } from '../components';
import type { EventRegistration, StarsEvent } from '../types';

const KIND: Record<StarsEvent['kind'], { de: string; en: string }> = {
  symposium: { de: 'Symposium', en: 'Symposium' },
  study_tour: { de: 'Studienreise', en: 'Study tour' },
  online: { de: 'Online', en: 'Online' },
};
const REG: Record<EventRegistration['status'], { de: string; en: string; cls: string }> = {
  interested: { de: 'Interesse gemeldet', en: 'Interest registered', cls: 'badge-domain' },
  requested: { de: 'Förderplatz beantragt', en: 'Scholarship requested', cls: 'badge-gold' },
  granted: { de: 'Förderplatz gewährt', en: 'Scholarship granted', cls: 'badge-resolved' },
  waitlist: { de: 'Warteliste', en: 'Waiting list', cls: 'badge-stage' },
  declined: { de: 'Förderplatz abgelehnt', en: 'Scholarship declined', cls: 'badge-open' },
};

function range(e: StarsEvent, _locale?: string) {
  const f = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return e.ends_on && e.ends_on !== e.starts_on ? `${f(e.starts_on)} – ${f(e.ends_on)}` : f(e.starts_on);
}

function EventCard({ e, reload }: { e: StarsEvent; reload: () => void }) {
  const { user } = useAuth();
  const { locale, loc } = useI18n();
  const tx = trx;
  const [apply, setApply] = useState(false);
  const [motivation, setMotivation] = useState(e.my_motivation || '');
  const isAdmin = user!.role === 'admin';
  return (
    <div className="card">
      <div className="flex items-center gap-sm">
        <span className="badge badge-stage">{lx(KIND[e.kind])}</span>
        {e.my_status && <span className={`badge ${REG[e.my_status].cls} right`}>{lx(REG[e.my_status])}</span>}
      </div>
      <h3 style={{ margin: '.5rem 0 .2rem' }}>{loc(e, 'title')}</h3>
      <div className="muted">📅 {range(e, locale)} · 📍 {e.location}</div>
      <p>{loc(e, 'description')}</p>
      <small className="muted">{e.interested_count} {tx('Interessierte', 'interested')} · {e.scholarship_count} {tx('Förderanträge', 'scholarship requests')}</small>
      {!isAdmin && (
        <div className="flex wrap gap-sm mt-sm">
          {!e.my_status && <button className="btn-outline btn-sm" onClick={async () => { await api.post(`/events/${e.id}/register`, {}); reload(); }}>{tx('Interesse bekunden', 'Register interest')}</button>}
          {(!e.my_status || e.my_status === 'interested') && <button className="btn-gold btn-sm" onClick={() => setApply((a) => !a)}>{tx('Förderplatz beantragen', 'Apply for scholarship')}</button>}
          {e.my_status && <button className="btn-ghost btn-sm" onClick={async () => { await api.post(`/events/${e.id}/withdraw`); reload(); }}>{tx('Zurückziehen', 'Withdraw')}</button>}
        </div>
      )}
      {apply && (
        <form className="subcard" onSubmit={async (ev) => { ev.preventDefault(); await api.post(`/events/${e.id}/register`, { scholarship: true, motivation }); setApply(false); reload(); }}>
          <div className="field"><label>{tx('Weshalb brauchst du einen Förderplatz und was erhoffst du dir von der Teilnahme?', 'Why do you need a scholarship and what do you hope to gain?')}</label>
            <textarea value={motivation} onChange={(ev) => setMotivation(ev.target.value)} required /></div>
          <small className="muted">{tx('stars entscheidet über die Vergabe. Die Kriterien legt stars fest.', 'stars decides on allocation according to its own criteria.')}</small>
          <div><button className="btn-gold btn-sm mt-sm" type="submit">{tx('Antrag senden', 'Send application')}</button></div>
        </form>
      )}
    </div>
  );
}

function AdminRequests() {
  const { locale, loc } = useI18n();
  const tx = trx;
  const [regs, setRegs] = useState<EventRegistration[] | null>(null);
  const load = async () => setRegs((await api.get<{ registrations: EventRegistration[] }>('/events/registrations')).registrations);
  useEffect(() => { load(); }, []);
  if (!regs) return <Spinner />;
  return (
    <div className="card mt">
      <h3>{tx('Interesse und Förderanträge', 'Interest and scholarship requests')}</h3>
      {regs.length === 0 && <p className="muted">{tx('Noch keine Anmeldungen.', 'No registrations yet.')}</p>}
      {regs.map((r) => (
        <div key={`${r.event_id}-${r.user_id}`} className="list-item">
          <Avatar name={r.name} seed={r.avatar_seed || undefined} size="sm" />
          <div className="grow">
            <b>{r.name}</b> <small className="muted">{r.country} · {loc(r, 'title')}</small>
            {r.motivation && <div className="muted">«{r.motivation}»</div>}
          </div>
          <span className={`badge ${REG[r.status].cls}`}>{lx(REG[r.status])}</span>
          {r.scholarship === 1 && (
            <div className="flex gap-sm">
              {(['granted', 'waitlist', 'declined'] as const).map((s) => (
                <button key={s} className={s === 'granted' ? 'btn-gold btn-sm' : 'btn-outline btn-sm'} disabled={r.status === s}
                  onClick={async () => { await api.post(`/events/registrations/${r.event_id}/${r.user_id}/decide`, { status: s }); load(); }}>
                  {{ granted: tx('Gewähren', 'Grant'), waitlist: tx('Warteliste', 'Waitlist'), declined: tx('Ablehnen', 'Decline') }[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Events() {
  const { user } = useAuth();
  const { locale } = useI18n();
  const tx = trx;
  const [events, setEvents] = useState<StarsEvent[] | null>(null);
  const [n, setN] = useState(0);
  const load = async () => { setEvents((await api.get<{ events: StarsEvent[] }>('/events')).events); setN((x) => x + 1); };
  useEffect(() => { load(); }, []);
  if (!events) return <Spinner />;
  return (
    <div>
      <div className="page-head">
        <h1>{tx('Veranstaltungen & Förderplätze', 'Events & scholarships')}</h1>
        <p>{tx(
          'Symposien und Studienreisen von stars. Wer keine Unterstützung durch ein Unternehmen hat, kann einen Förderplatz beantragen.',
          'stars symposia and study tours. If no company sponsors you, you can apply for a scholarship.'
        )}</p>
      </div>
      <div className="grid grid-2">{events.map((e) => <EventCard key={e.id} e={e} reload={load} />)}</div>
      {user!.role === 'admin' && <AdminRequests key={n} />}
    </div>
  );
}
