// Iteration 3 – Warm Introductions mit stars-Empfehlung (FA-23).
// EEM fragen eine Vorstellung an; stars waehlt eine Person aus dem Netzwerk und
// buergt mit einer Empfehlungsnotiz; die angefragte Person nimmt an oder lehnt ab.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n, lx, trx } from '../i18n';
import { Avatar, Spinner, TagPill, timeAgo, useFocusTarget } from '../components';
import type { IntroRequest, IntroSuggestion, IntroStatus, Tag } from '../types';

const STATUS: Record<IntroStatus, { de: string; en: string; cls: string }> = {
  requested: { de: 'angefragt', en: 'requested', cls: 'badge-gold' },
  proposed: { de: 'Person angefragt', en: 'person asked', cls: 'badge-stage' },
  accepted: { de: 'vorgestellt', en: 'introduced', cls: 'badge-resolved' },
  declined: { de: 'abgelehnt – stars sucht weiter', en: 'declined – stars keeps looking', cls: 'badge-open' },
  closed: { de: 'abgeschlossen', en: 'closed', cls: '' },
};

function IntroForm({ tags, onDone }: { tags: Tag[]; onDone: () => void }) {
  const { locale, loc } = useI18n();
  const tx = trx;
  const [f, setF] = useState({ target_profile: '', purpose: '' });
  const [sel, setSel] = useState<number[]>([]);
  const groups: [string, string, string][] = [
    ['network', 'Netzwerkzugang', 'Network access'],
    ['domain', 'Erfahrung', 'Experience'],
    ['market', 'Markt', 'Market'],
  ];
  return (
    <form className="card" onSubmit={async (e) => { e.preventDefault(); await api.post('/intros', { ...f, tag_ids: sel }); setF({ target_profile: '', purpose: '' }); setSel([]); onDone(); }}>
      <h3>{tx('Neue Intro-Anfrage', 'New intro request')}</h3>
      <div className="field"><label>{tx('Wen möchtest du kennenlernen?', 'Who would you like to meet?')}</label>
        <input value={f.target_profile} onChange={(e) => setF({ ...f, target_profile: e.target.value })} required
          placeholder={tx('z. B. Alumni, die in Stiftungen oder CSR-Programmen mit Bildungsfokus arbeiten', 'e.g. alumni working in foundations or CSR programmes focused on education')} /></div>
      <div className="field"><label>{tx('Wofür? (Zweck des Gesprächs)', 'What for? (purpose of the conversation)')}</label>
        <textarea value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} required
          placeholder={tx('z. B. Innovation vorstellen und verstehen, wie Stiftungen neue Projekte auswählen', 'e.g. present the innovation and understand how foundations select new projects')} /></div>
      {groups.map(([cat, de, en]) => (
        <div key={cat} className="field">
          <label>{tx(de, en)}</label>
          <div className="flex wrap gap-sm">
            {tags.filter((t) => t.category === cat).map((t) => (
              <button type="button" key={t.id} className={sel.includes(t.id) ? 'btn-gold btn-sm' : 'btn-outline btn-sm'}
                onClick={() => setSel((s) => (s.includes(t.id) ? s.filter((x) => x !== t.id) : [...s, t.id]))}>{loc(t, 'name')}</button>
            ))}
          </div>
        </div>
      ))}
      <button className="btn-gold" type="submit">{tx('An stars senden', 'Send to stars')}</button>
    </form>
  );
}

function AdminPanel({ intro, reload }: { intro: IntroRequest; reload: () => void }) {
  const { locale } = useI18n();
  const tx = trx;
  const [sugg, setSugg] = useState<IntroSuggestion[] | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [note, setNote] = useState('');
  if (!['requested', 'declined'].includes(intro.status)) return null;
  return (
    <div className="subcard">
      {!sugg ? (
        <div className="flex gap-sm wrap">
          <button className="btn-gold btn-sm" onClick={async () => setSugg((await api.get<{ suggestions: IntroSuggestion[] }>(`/intros/${intro.id}/suggestions`)).suggestions)}>
            {tx('Passende Personen vorschlagen', 'Suggest matching people')}</button>
          <button className="btn-outline btn-sm" onClick={async () => {
            const n = prompt(tx('Kurze Begründung für die anfragende Person:', 'Short note for the requester:')) ?? undefined;
            await api.post(`/intros/${intro.id}/close`, { note: n }); reload();
          }}>{tx('Ohne Vorstellung abschliessen', 'Close without intro')}</button>
        </div>
      ) : (
        <>
          <b>{tx('Vorschläge aus dem Netzwerk', 'Suggestions from the network')}</b>
          <p className="muted" style={{ margin: '.2rem 0 .5rem' }}>{tx('Bewertet nach Netzwerkzugang, Erfahrung und Markt. Du entscheidest, wen stars anfragt.', 'Ranked by network access, experience and market. You decide whom stars asks.')}</p>
          {sugg.length === 0 && <p className="muted">{tx('Keine Person mit passenden Merkmalen gefunden.', 'Nobody with matching attributes found.')}</p>}
          {sugg.map((s) => (
            <label key={s.user.id} className="list-item" style={{ cursor: 'pointer' }}>
              <input type="radio" name={`pick-${intro.id}`} checked={pick === s.user.id} onChange={() => setPick(s.user.id)} style={{ width: 'auto' }} />
              <Avatar name={s.user.name} seed={s.user.avatar_seed || undefined} size="sm" />
              <div className="grow">
                <b>{s.user.name}</b> {s.peer && <span className="badge badge-stage">Peer</span>}
                <div className="muted">{s.user.headline}</div>
                <div className="flex wrap gap-sm">{s.matchedTags.map((t, i) => <span key={i} className="badge badge-domain">{lx(t)}</span>)}</div>
              </div>
              <span className="badge badge-gold">{Math.round(s.score)}</span>
            </label>
          ))}
          <div className="field mt-sm"><label>{tx('Empfehlung von stars (wird der Person gezeigt und in die Einleitungsnachricht übernommen)', 'Recommendation by stars (shown to the person and included in the intro message)')}</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={tx('Woher kennt stars die Person? Warum lohnt sich das Gespräch?', 'How does stars know the person? Why is the conversation worthwhile?')} /></div>
          <button className="btn-gold btn-sm" disabled={!pick || !note.trim()} onClick={async () => {
            await api.post(`/intros/${intro.id}/propose`, { supporter_id: pick, vouch_note: note }); reload();
          }}>{tx('Person anfragen', 'Ask person')}</button>
        </>
      )}
    </div>
  );
}

function IntroCard({ intro, reload }: { intro: IntroRequest; reload: () => void }) {
  const { user } = useAuth();
  const { locale } = useI18n();
  const tx = trx;
  const [reply, setReply] = useState('');
  const st = STATUS[intro.status];
  const iAmSupporter = intro.supporter_id === user!.id;
  return (
    <div className="card" data-focus={intro.id}>
      <div className="flex items-center gap-sm">
        <Avatar name={intro.requester_name} seed={intro.requester_avatar || undefined} size="sm" />
        <div style={{ minWidth: 0 }}>
          <b>{intro.requester_name}</b> <small className="muted">{intro.requester_country} · {timeAgo(intro.created_at, locale)}</small>
          <div className="muted clamp">{intro.requester_headline}</div>
        </div>
        <span className={`badge ${st.cls} right`}>{lx(st)}</span>
      </div>
      <p style={{ margin: '.6rem 0 .2rem' }}><b>{tx('Gesucht', 'Looking for')}:</b> {intro.target_profile}</p>
      <p className="muted" style={{ margin: 0 }}><b>{tx('Zweck', 'Purpose')}:</b> {intro.purpose}</p>
      {intro.tags.length > 0 && <div className="flex wrap gap-sm mt-sm">{intro.tags.map((t) => <TagPill key={t.id} tag={t} />)}</div>}
      {intro.supporter_name && (
        <div className="notice mt-sm">
          <b>{tx('Vorgestellt wird', 'Introduction to')}: {intro.supporter_name}</b>{intro.supporter_headline ? ` – ${intro.supporter_headline}` : ''}
          {intro.vouch_note && <div style={{ marginTop: '.3rem' }}>⭐ <i>{tx('Empfehlung von stars', 'Recommended by stars')}:</i> {intro.vouch_note}</div>}
          {intro.response_note && <div style={{ marginTop: '.3rem' }}>💬 {intro.response_note}</div>}
        </div>
      )}
      {intro.status === 'accepted' && intro.conversation_id && (intro.requester_id === user!.id || iAmSupporter) && (
        <Link className="btn btn-gold btn-sm mt-sm" to={`/messages/${intro.conversation_id}`}>{tx('Zur Konversation', 'Open conversation')}</Link>
      )}
      {iAmSupporter && intro.status === 'proposed' && (
        <div className="subcard">
          <b>{tx('stars möchte dich vorstellen. Bist du offen für ein Gespräch?', 'stars would like to introduce you. Are you open to a conversation?')}</b>
          <div className="field mt-sm"><input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={tx('Kurze Nachricht (optional)', 'Short message (optional)')} /></div>
          <div className="flex gap-sm">
            <button className="btn-gold btn-sm" onClick={async () => { await api.post(`/intros/${intro.id}/respond`, { accept: true, note: reply }); reload(); }}>{tx('Annehmen', 'Accept')}</button>
            <button className="btn-outline btn-sm" onClick={async () => { await api.post(`/intros/${intro.id}/respond`, { accept: false, note: reply }); reload(); }}>{tx('Ablehnen', 'Decline')}</button>
          </div>
        </div>
      )}
      {user!.role === 'admin' && <AdminPanel intro={intro} reload={reload} />}
    </div>
  );
}

export default function Network() {
  const { user } = useAuth();
  const { locale } = useI18n();
  const tx = trx;
  const [intros, setIntros] = useState<IntroRequest[] | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [show, setShow] = useState(false);

  async function load() {
    setIntros((await api.get<{ intros: IntroRequest[] }>('/intros')).intros);
  }
  useEffect(() => {
    load();
    api.get<{ tags: Tag[] }>('/tags').then((r) => setTags(r.tags));
  }, []);
  useFocusTarget(intros);

  if (!intros) return <Spinner />;
  const isAdmin = user!.role === 'admin';
  const toMe = intros.filter((i) => i.supporter_id === user!.id);
  const mine = intros.filter((i) => i.requester_id === user!.id);
  const open = intros.filter((i) => ['requested', 'declined'].includes(i.status));
  const rest = intros.filter((i) => !['requested', 'declined'].includes(i.status));

  return (
    <div>
      <div className="page-head flex items-center">
        <div>
          <h1>{tx('Netzwerk & Intros', 'Network & intros')}</h1>
          <p>{tx(
            'Warm Introductions über stars: Du beschreibst, wen du suchst – stars kennt das Netzwerk, wählt eine passende Person aus und empfiehlt dich persönlich.',
            'Warm introductions via stars: describe whom you are looking for – stars knows the network, picks a suitable person and personally recommends you.'
          )}</p>
        </div>
        {!isAdmin && <button className="btn-gold right" onClick={() => setShow((s) => !s)}>{show ? tx('Schliessen', 'Close') : tx('+ Intro anfragen', '+ Request intro')}</button>}
      </div>
      {show && <IntroForm tags={tags} onDone={() => { setShow(false); load(); }} />}

      {isAdmin ? (
        <>
          <h3 className="mt">{tx('Zu bearbeiten', 'To do')} ({open.length})</h3>
          {open.length === 0 && <p className="muted">{tx('Keine offenen Anfragen.', 'No open requests.')}</p>}
          <div className="grid grid-2">{open.map((i) => <IntroCard key={i.id} intro={i} reload={load} />)}</div>
          <h3 className="mt">{tx('Laufend und abgeschlossen', 'In progress and closed')}</h3>
          <div className="grid grid-2">{rest.map((i) => <IntroCard key={i.id} intro={i} reload={load} />)}</div>
        </>
      ) : (
        <>
          {toMe.length > 0 && (
            <>
              <h3 className="mt">{tx('Vorstellungen an dich', 'Introductions to you')}</h3>
              <div className="grid grid-2">{toMe.map((i) => <IntroCard key={i.id} intro={i} reload={load} />)}</div>
            </>
          )}
          <h3 className="mt">{tx('Meine Anfragen', 'My requests')}</h3>
          {mine.length === 0 && <p className="muted">{tx('Noch keine Anfragen. Tipp: Je konkreter Profil und Zweck, desto besser kann stars vermitteln.', 'No requests yet. Tip: the more specific the profile and purpose, the better stars can broker.')}</p>}
          <div className="grid grid-2">{mine.map((i) => <IntroCard key={i.id} intro={i} reload={load} />)}</div>
          {!user!.offers_peer_support && user!.role === 'entrepreneur' && (
            <div className="notice mt">
              {tx('Du möchtest deine eigene Erfahrung weitergeben? Aktiviere im ', 'Want to share your own experience? Enable ')}
              <Link to="/profile">{tx('Profil', 'Profile')}</Link>
              {tx(' die Option «Ich teile meine Erfahrung» – dann kann stars auch dich anderen vorstellen.', ' the option “I share my experience” – then stars can introduce you to others, too.')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
