// Iteration 2 – Communities of Practice (FA-20, DP10): Gruppen mit gemeinsamer
// Domaene, Peer-Austausch und terminierten Knowledge-Sharing-Sessions.
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n, dateLocale, lx, trx } from '../i18n';
import { Avatar, RoleBadge, Spinner, timeAgo } from '../components';
import type { Community, CommunitySession, CommunityPost, Role, Tag, SessionRequest } from '../types';

const SESSION_FORMAT: Record<string, { de: string; en: string }> = {
  peer_session: { de: 'Peer Session', en: 'Peer session' },
  roundtable: { de: 'Roundtable', en: 'Roundtable' },
  masterclass: { de: 'Masterclass', en: 'Masterclass' },
  pitch_learn: { de: 'Pitch & Learn', en: 'Pitch & learn' },
};

export function fmtDate(s: string, _locale?: string) {
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return d.toLocaleString(dateLocale(), { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function CommunityCard({ c }: { c: Community }) {
  const { loc, locale } = useI18n();
  const nav = useNavigate();
  const tx = trx;
  return (
    <div className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => nav(`/communities/${c.id}`)}>
      <div className="flex items-center gap-sm">
        <h3 style={{ margin: 0 }}>{loc(c, 'name')}</h3>
        {c.my_role && <span className="badge badge-resolved right">{c.my_role === 'moderator' ? tx('Moderation', 'Moderator') : tx('Mitglied', 'Member')}</span>}
      </div>
      <p className="muted" style={{ margin: '.4rem 0' }}>{loc(c, 'description')}</p>
      <div className="flex wrap gap-sm">
        {c.tag_name_de && <span className={`badge ${c.tag_category === 'market' ? 'badge-market' : 'badge-domain'}`}>{trx(c.tag_name_de, c.tag_name_en ?? c.tag_name_de)}</span>}
        <span className="badge">👥 {c.member_count}</span>
        <span className="badge">💬 {c.post_count}</span>
        {c.next_session && <span className="badge badge-stage">📅 {fmtDate(c.next_session, locale)}</span>}
      </div>
    </div>
  );
}

export default function Communities() {
  const { user } = useAuth();
  const { locale, loc } = useI18n();
  const tx = trx;
  const [list, setList] = useState<Community[] | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ name_de: '', name_en: '', description_de: '', tag_id: '' });

  async function load() {
    setList((await api.get<{ communities: Community[] }>('/communities')).communities);
  }
  useEffect(() => {
    load();
    api.get<{ tags: Tag[] }>('/tags').then((r) => setTags(r.tags));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/communities', { ...f, tag_id: f.tag_id ? Number(f.tag_id) : null });
    setShow(false);
    setF({ name_de: '', name_en: '', description_de: '', tag_id: '' });
    load();
  }

  if (!list) return <Spinner />;
  const mine = list.filter((c) => c.my_role);
  const others = list.filter((c) => !c.my_role);
  return (
    <div>
      <div className="page-head flex items-center">
        <div>
          <h1>Communities of Practice</h1>
          <p>{tx(
            'Entrepreneurs und Alumni unterstützen sich gegenseitig mit Erfahrung und Netzwerk – der erste Ort für Fragen, bevor eine Einzelbegleitung nötig ist.',
            'Entrepreneurs and alumni support each other with experience and networks – the first place for questions before individual support is needed.'
          )}</p>
        </div>
        {user!.role === 'admin' && <button className="btn-gold right" onClick={() => setShow((s) => !s)}>+ Community</button>}
      </div>
      {show && (
        <form className="card" onSubmit={create}>
          <div className="row">
            <div className="field"><label>Name (DE)</label><input value={f.name_de} onChange={(e) => setF({ ...f, name_de: e.target.value })} required /></div>
            <div className="field"><label>Name (EN)</label><input value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} /></div>
            <div className="field"><label>{tx('Domäne', 'Domain')}</label>
              <select value={f.tag_id} onChange={(e) => setF({ ...f, tag_id: e.target.value })}>
                <option value="">–</option>
                {tags.filter((t) => t.category === 'domain' || t.category === 'market').map((t) => <option key={t.id} value={t.id}>{loc(t, 'name')}</option>)}
              </select></div>
          </div>
          <div className="field"><label>{tx('Beschreibung', 'Description')}</label><textarea value={f.description_de} onChange={(e) => setF({ ...f, description_de: e.target.value })} /></div>
          <button className="btn-gold" type="submit">{tx('Anlegen', 'Create')}</button>
        </form>
      )}
      {mine.length > 0 && (
        <>
          <h3 className="mt">{tx('Meine Communities', 'My communities')}</h3>
          <div className="grid grid-2">{mine.map((c) => <CommunityCard key={c.id} c={c} />)}</div>
        </>
      )}
      <h3 className="mt">{tx('Weitere Communities', 'More communities')}</h3>
      <div className="grid grid-2">{others.map((c) => <CommunityCard key={c.id} c={c} />)}</div>
    </div>
  );
}

interface DetailResp {
  community: Community;
  members: { id: number; name: string; user_role: Role; country: string; headline: string; avatar_seed: string; role: 'member' | 'moderator' }[];
  sessions: CommunitySession[];
  posts: CommunityPost[];
  sessionRequests?: SessionRequest[];
  canModerate: boolean;
}

const REQ_STATUS: Record<SessionRequest['status'], { de: string; en: string }> = {
  pending: { de: 'offen', en: 'pending' },
  approved: { de: 'bestätigt', en: 'approved' },
  declined: { de: 'abgelehnt', en: 'declined' },
};

// Iteration 3 (FA-24): Mitglieder beantragen einen Slot, z.B. fuer «Pitch & Learn»;
// die Moderation terminiert oder lehnt ab.
function SlotRequests({ communityId, d, reload }: { communityId: string; d: DetailResp; reload: () => void }) {
  const { locale } = useI18n();
  const tx = trx;
  const [open, setOpen] = useState(false);
  const [rf, setRf] = useState({ title: '', description: '', audience: '', preferred_date: '' });
  const [when, setWhen] = useState<Record<number, string>>({});
  const reqs = d.sessionRequests || [];
  const member = !!d.community.my_role;
  if (!member && !d.canModerate) return null;
  return (
    <div className="card mt">
      <div className="flex items-center">
        <h3 style={{ margin: 0 }}>{tx('Slot beantragen: Pitch & Learn', 'Request a slot: pitch & learn')}</h3>
        {member && <button className="btn-outline btn-sm right" onClick={() => setOpen((o) => !o)}>{open ? tx('Schliessen', 'Close') : tx('+ Antrag', '+ Request')}</button>}
      </div>
      <p className="muted" style={{ marginTop: '.3rem' }}>{tx(
        'Stelle deine Innovation vor und lerne zugleich von Alumni – z. B. wie Stiftungen und CSR-Programme neue Projekte übernehmen. Die Moderation terminiert den Slot.',
        'Present your innovation and learn from alumni at the same time – e.g. how foundations and CSR programmes adopt new projects. The moderators schedule the slot.')}</p>
      {open && (
        <form className="subcard" onSubmit={async (e) => { e.preventDefault(); await api.post(`/communities/${communityId}/session-requests`, rf); setOpen(false); setRf({ title: '', description: '', audience: '', preferred_date: '' }); reload(); }}>
          <div className="field"><label>{tx('Thema', 'Topic')}</label><input value={rf.title} onChange={(e) => setRf({ ...rf, title: e.target.value })} required placeholder={tx('z. B. Pitch & Learn: Lernhardware für Schulen', 'e.g. Pitch & learn: learning hardware for schools')} /></div>
          <div className="field"><label>{tx('Ziel der Session', 'Goal of the session')}</label><textarea value={rf.description} onChange={(e) => setRf({ ...rf, description: e.target.value })} /></div>
          <div className="row">
            <div className="field"><label>{tx('Gewünschtes Publikum', 'Desired audience')}</label><input value={rf.audience} onChange={(e) => setRf({ ...rf, audience: e.target.value })} placeholder={tx('z. B. Alumni aus Stiftungen/CSR', 'e.g. alumni in foundations/CSR')} /></div>
            <div className="field"><label>{tx('Wunschdatum', 'Preferred date')}</label><input type="date" value={rf.preferred_date} onChange={(e) => setRf({ ...rf, preferred_date: e.target.value })} /></div>
          </div>
          <button className="btn-gold btn-sm" type="submit">{tx('Antrag senden', 'Send request')}</button>
        </form>
      )}
      {reqs.map((r) => (
        <div key={r.id} className="list-item">
          <Avatar name={r.requester_name} seed={r.requester_avatar || undefined} size="sm" />
          <div className="grow">
            <b>{r.title}</b> <span className={`badge ${r.status === 'approved' ? 'badge-resolved' : r.status === 'pending' ? 'badge-gold' : ''}`}>{lx(REQ_STATUS[r.status])}</span>
            {r.description && <div className="muted">{r.description}</div>}
            <small>{r.requester_name}{r.audience ? ` · ${tx('Publikum', 'Audience')}: ${r.audience}` : ''}{r.preferred_date ? ` · ${tx('Wunsch', 'Preferred')}: ${r.preferred_date}` : ''}</small>
          </div>
          {d.canModerate && r.status === 'pending' && (
            <div className="flex gap-sm wrap" style={{ justifyContent: 'flex-end' }}>
              <input type="datetime-local" style={{ width: 'auto' }} value={when[r.id] ?? (r.preferred_date ? `${r.preferred_date}T15:00` : '')}
                onChange={(e) => setWhen({ ...when, [r.id]: e.target.value })} aria-label={tx('Termin', 'Date')} />
              <button className="btn-gold btn-sm" onClick={async () => {
                const starts_at = when[r.id] ?? (r.preferred_date ? `${r.preferred_date}T15:00` : '');
                if (!starts_at) return alert(tx('Bitte Termin wählen.', 'Please pick a date.'));
                await api.post(`/communities/session-requests/${r.id}/decide`, { approve: true, starts_at }); reload();
              }}>{tx('Terminieren', 'Schedule')}</button>
              <button className="btn-outline btn-sm" onClick={async () => { await api.post(`/communities/session-requests/${r.id}/decide`, { approve: false }); reload(); }}>{tx('Ablehnen', 'Decline')}</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function CommunityDetail() {
  const { id } = useParams();
  const { loc, locale } = useI18n();
  const tx = trx;
  const [d, setD] = useState<DetailResp | null>(null);
  const [post, setPost] = useState('');
  const [showSession, setShowSession] = useState(false);
  const [sf, setSf] = useState({ title: '', description: '', format: 'peer_session', starts_at: '' });

  async function load() {
    setD(await api.get<DetailResp>(`/communities/${id}`));
  }
  useEffect(() => { load(); }, [id]);

  if (!d) return <Spinner />;
  const c = d.community;
  const member = !!c.my_role;
  const nowIso = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const upcoming = d.sessions.filter((s) => s.starts_at >= nowIso).reverse();
  const past = d.sessions.filter((s) => s.starts_at < nowIso);

  return (
    <div>
      <Link className="btn btn-ghost" to="/communities">← Communities</Link>
      <div className="page-head flex items-center mt-sm">
        <div>
          <h1>{loc(c, 'name')}</h1>
          <p>{loc(c, 'description')}</p>
        </div>
        <span className="right">
          {member
            ? <button className="btn-outline" onClick={async () => { await api.post(`/communities/${id}/leave`); load(); }}>{tx('Verlassen', 'Leave')}</button>
            : <button className="btn-gold" onClick={async () => { await api.post(`/communities/${id}/join`); load(); }}>{tx('Beitreten', 'Join')}</button>}
        </span>
      </div>

      <div className="grid grid-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div>
          <div className="card">
            <div className="flex items-center">
              <h3 style={{ margin: 0 }}>{tx('Sessions', 'Sessions')}</h3>
              {d.canModerate && <button className="btn-outline btn-sm right" onClick={() => setShowSession((s) => !s)}>+ Session</button>}
            </div>
            {showSession && (
              <form className="subcard" onSubmit={async (e) => { e.preventDefault(); await api.post(`/communities/${id}/sessions`, sf); setShowSession(false); load(); }}>
                <div className="row">
                  <div className="field"><label>{tx('Titel', 'Title')}</label><input value={sf.title} onChange={(e) => setSf({ ...sf, title: e.target.value })} required /></div>
                  <div className="field"><label>{tx('Format', 'Format')}</label>
                    <select value={sf.format} onChange={(e) => setSf({ ...sf, format: e.target.value })}>
                      {Object.entries(SESSION_FORMAT).map(([k, v]) => <option key={k} value={k}>{lx(v)}</option>)}
                    </select></div>
                  <div className="field"><label>{tx('Zeitpunkt (UTC)', 'Time (UTC)')}</label><input type="datetime-local" value={sf.starts_at} onChange={(e) => setSf({ ...sf, starts_at: e.target.value })} required /></div>
                </div>
                <div className="field"><label>{tx('Beschreibung', 'Description')}</label><input value={sf.description} onChange={(e) => setSf({ ...sf, description: e.target.value })} /></div>
                <button className="btn-gold btn-sm" type="submit">{tx('Ansetzen', 'Schedule')}</button>
              </form>
            )}
            {upcoming.length === 0 && <p className="muted">{tx('Keine geplanten Sessions.', 'No upcoming sessions.')}</p>}
            {upcoming.map((s) => (
              <div key={s.id} className="list-item">
                <div className="date-chip">{fmtDate(s.starts_at, locale)}</div>
                <div className="grow">
                  <b>{s.title}</b> <span className="badge">{lx(SESSION_FORMAT[s.format])}</span>
                  {s.description && <div className="muted">{s.description}</div>}
                  <small>{tx('mit', 'with')} {s.host_name} · {s.attendee_count} {tx('Teilnehmende', 'attendees')}</small>
                </div>
                <button className={s.attending ? 'btn-outline btn-sm' : 'btn-gold btn-sm'}
                  onClick={async () => { await api.post(`/communities/sessions/${s.id}/attend`); load(); }}>
                  {s.attending ? tx('Abmelden', 'Cancel') : tx('Teilnehmen', 'Attend')}
                </button>
              </div>
            ))}
            {past.length > 0 && <small className="muted">{tx('Vergangen', 'Past')}: {past.map((s) => s.title).join(', ')}</small>}
          </div>

          <SlotRequests communityId={id!} d={d} reload={load} />

          <div className="card mt">
            <h3>{tx('Austausch', 'Discussion')}</h3>
            {member ? (
              <form className="flex gap-sm" onSubmit={async (e) => { e.preventDefault(); await api.post(`/communities/${id}/posts`, { body: post }); setPost(''); load(); }}>
                <input value={post} onChange={(e) => setPost(e.target.value)} placeholder={tx('Frage oder Erfahrung teilen …', 'Share a question or experience …')} required />
                <button className="btn-gold" type="submit">{tx('Posten', 'Post')}</button>
              </form>
            ) : <p className="notice">{tx('Tritt der Community bei, um mitzudiskutieren.', 'Join the community to take part.')}</p>}
            {d.posts.length === 0 && <p className="muted mt-sm">{tx('Noch keine Beiträge.', 'No posts yet.')}</p>}
            {d.posts.map((p) => (
              <div key={p.id} className="post comment">
                <Avatar name={p.author_name} seed={p.author_avatar} size="sm" />
                <div className="body">
                  <div className="meta">{p.author_name} <RoleBadge role={p.author_role} /> · {timeAgo(p.created_at, locale)}</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{p.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>{tx('Mitglieder', 'Members')} ({d.members.length})</h3>
          {d.members.map((m) => (
            <div key={m.id} className="flex items-center gap-sm" style={{ margin: '.45rem 0' }}>
              <Avatar name={m.name} seed={m.avatar_seed} size="sm" />
              <div style={{ minWidth: 0 }}>
                <div className="clamp" style={{ fontSize: '.88rem', fontWeight: 600 }}>{m.name}</div>
                <small>{m.role === 'moderator' ? tx('Moderation', 'Moderator') : m.country}</small>
              </div>
              <span className="right"><RoleBadge role={m.user_role} /></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
