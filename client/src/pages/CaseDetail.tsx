// Iteration 2 – Fallansicht der Support Journey. Jeder Schritt endet mit einem
// verbindlichen Output; der naechste Schritt ist erst moeglich, wenn dieser
// vorliegt (Pruefung serverseitig, hier nur angezeigt).
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { useI18n, lx, trx } from '../i18n';
import { Avatar, Spinner, TagPill, timeAgo } from '../components';
import { Stepper, StepBadge } from './Journey';
import {
  STEP_LABEL, STEP_OUTPUT, FORMATS, formatLabel, ROLE_LABEL, ROLE_HINT, CASE_TYPE_LABEL, RATING_LABEL,
  RATING_CRITERIA, PROGRESS_LABEL, NEXT_STEP_LABEL, CLOSE_REASON_LABEL, QUESTIONNAIRES, answerLabel,
} from '../journey';
import type { CaseDetail as Detail, Need, Tag, Candidate, SupportRole, Format, Step } from '../types';

type Tx = (de: string, en: string) => string;
type Act = (method: 'post' | 'patch' | 'put', path: string, body?: unknown) => Promise<void>;

const stepIndex = (s: Step) => ['intake', 'assessment', 'prioritization', 'support_plan', 'matching', 'agreement', 'implementation', 'reassessment', 'closed'].indexOf(s);

function TagPicker({ tags, selected, onChange }: { tags: Tag[]; selected: number[]; onChange: (ids: number[]) => void }) {
  const { loc, locale } = useI18n();
  const cats: { key: Tag['category']; de: string; en: string }[] = [
    { key: 'domain', de: 'Fachgebiet', en: 'Domain' },
    { key: 'market', de: 'Markt', en: 'Market' },
    { key: 'network', de: 'Netzwerkzugang', en: 'Network access' },
  ];
  return (
    <div>
      {cats.map((c) => (
        <div key={c.key} className="flex wrap gap-sm items-center" style={{ margin: '.3rem 0' }}>
          <small style={{ width: 110 }}>{lx(c)}</small>
          {tags.filter((t) => t.category === c.key).map((t) => (
            <button type="button" key={t.id} className={selected.includes(t.id) ? 'btn-sm btn-gold' : 'btn-sm btn-outline'}
              onClick={() => onChange(selected.includes(t.id) ? selected.filter((x) => x !== t.id) : [...selected, t.id])}>
              {loc(t, 'name')}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// --- Bedarf in der Bedarfsformel --------------------------------------------
function NeedForm({ tags, initial, onSubmit, onCancel, tx }: {
  tags: Tag[]; initial?: Need; tx: Tx; onCancel?: () => void;
  onSubmit: (b: Record<string, unknown>) => Promise<void>;
}) {
  const [f, setF] = useState({
    goal: initial?.goal || '', bottleneck: initial?.bottleneck || '',
    support_needed: initial?.support_needed || '', success_criterion: initial?.success_criterion || '',
  });
  const [tagIds, setTagIds] = useState<number[]>(initial?.tags.map((t) => t.id) || []);
  return (
    <form className="subcard" onSubmit={async (e) => { e.preventDefault(); await onSubmit({ ...f, tagIds }); }}>
      <p className="formula">
        {tx('Der EEM möchte', 'The EEM wants to achieve')} <input placeholder={tx('[angestrebtes Ergebnis]', '[desired result]')} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} required />{' '}
        {tx('erreichen. Derzeit wird dies erschwert durch', '. This is currently hindered by')} <input placeholder={tx('[Engpass und Ursache]', '[bottleneck and cause]')} value={f.bottleneck} onChange={(e) => setF({ ...f, bottleneck: e.target.value })} />.{' '}
        {tx('Benötigt wird Unterstützung in Form von', 'Support is needed in the form of')} <input placeholder={tx('[Kompetenz, Erfahrung oder Zugang]', '[competence, experience or access]')} value={f.support_needed} onChange={(e) => setF({ ...f, support_needed: e.target.value })} />.{' '}
        {tx('Ein Fortschritt zeigt sich an', 'Progress shows in')} <input placeholder={tx('[Erfolgskriterium]', '[success criterion]')} value={f.success_criterion} onChange={(e) => setF({ ...f, success_criterion: e.target.value })} />.
      </p>
      <TagPicker tags={tags} selected={tagIds} onChange={setTagIds} />
      <div className="flex gap-sm mt-sm">
        <button className="btn-gold btn-sm" type="submit">{tx('Speichern', 'Save')}</button>
        {onCancel && <button className="btn-outline btn-sm" type="button" onClick={onCancel}>{tx('Abbrechen', 'Cancel')}</button>}
      </div>
    </form>
  );
}

function NeedHeader({ n, canEdit, act, tags, tx }: { n: Need; canEdit: boolean; act: Act; tags: Tag[]; tx: Tx }) {
  const [edit, setEdit] = useState(false);
  if (edit) {
    return <NeedForm tags={tags} initial={n} tx={tx} onCancel={() => setEdit(false)}
      onSubmit={async (b) => { await act('patch', `/journey/needs/${n.id}`, b); setEdit(false); }} />;
  }
  return (
    <div>
      <div className="flex items-center gap-sm wrap">
        {n.priority_rank && <span className="badge badge-gold">#{n.priority_rank}</span>}
        <h4 style={{ margin: 0 }}>{n.goal}</h4>
        {n.status !== 'open' && <span className={`badge ${n.status === 'achieved' ? 'badge-resolved' : ''}`}>{n.status === 'achieved' ? tx('erreicht', 'achieved') : tx('verworfen', 'dropped')}</span>}
        {canEdit && <button className="btn-ghost btn-sm right" onClick={() => setEdit(true)}>✎</button>}
      </div>
      <p className="formula-read">
        {tx('Der EEM möchte', 'The EEM wants to achieve')} <b>{n.goal}</b> {tx('erreichen.', '.')}
        {n.bottleneck && <> {tx('Derzeit wird dies erschwert durch', 'This is currently hindered by')} <b>{n.bottleneck}</b>.</>}
        {n.support_needed && <> {tx('Benötigt wird Unterstützung in Form von', 'Support is needed in the form of')} <b>{n.support_needed}</b>.</>}
        {n.success_criterion
          ? <> {tx('Ein Fortschritt zeigt sich an', 'Progress shows in')} <b>{n.success_criterion}</b>.</>
          : <> <span className="badge badge-open">{tx('Erfolgskriterium fehlt', 'Success criterion missing')}</span></>}
      </p>
      <div className="flex wrap gap-sm">{n.tags.map((t) => <TagPill key={t.id} tag={t} />)}</div>
    </div>
  );
}

function Prioritization({ n, canEdit, act, tx }: { n: Need; canEdit: boolean; act: Act; tx: Tx }) {
  const { locale } = useI18n();
  return (
    <div className="ratings mt-sm">
      {RATING_CRITERIA.map((c) => (
        <div key={c.key}>
          <small>{lx(c.label)}</small>
          {canEdit ? (
            <select value={n[c.key] ?? ''} onChange={(e) => act('patch', `/journey/needs/${n.id}`, { [c.key]: e.target.value || null })}>
              <option value="">–</option>
              {[1, 2, 3].map((v) => <option key={v} value={v}>{lx(RATING_LABEL[v])}</option>)}
            </select>
          ) : <div><b>{n[c.key] ? lx(RATING_LABEL[n[c.key]!]) : '–'}</b></div>}
        </div>
      ))}
      <div>
        <small>{tx('Priorität', 'Priority')}</small>
        {canEdit ? (
          <select value={n.priority_rank ?? ''} onChange={(e) => act('patch', `/journey/needs/${n.id}`, { priority_rank: e.target.value || null })}>
            <option value="">{tx('nicht priorisiert', 'not prioritised')}</option>
            {[1, 2, 3].map((v) => <option key={v} value={v}>#{v}</option>)}
          </select>
        ) : <div><b>{n.priority_rank ? `#${n.priority_rank}` : '–'}</b></div>}
      </div>
    </div>
  );
}

// --- Supportplan (Formate) ---------------------------------------------------
function PlanBlock({ n, isAdmin, act, tx }: { n: Need; isAdmin: boolean; act: Act; tx: Tx }) {
  const { locale } = useI18n();
  const [edit, setEdit] = useState(false);
  const [items, setItems] = useState<{ format: Format; note: string }[]>(n.plan.map((p) => ({ format: p.format, note: p.note || '' })));
  if (edit) {
    const has = (f: Format) => items.some((i) => i.format === f);
    return (
      <div className="subcard">
        <b>{tx('Supportplan: Formate wählen', 'Support plan: choose formats')}</b>
        <div className="format-grid mt-sm">
          {FORMATS.map((f) => (
            <div key={f.key} className={`format ${has(f.key) ? 'on' : ''} mech-${f.mechanism}`}>
              <label className="flex items-center gap-sm" style={{ margin: 0, cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={has(f.key)}
                  onChange={() => setItems(has(f.key) ? items.filter((i) => i.format !== f.key) : [...items, { format: f.key, note: '' }])} />
                {lx(f.label)}
              </label>
              <small>{lx(f.hint)}</small>
              {has(f.key) && (
                <input placeholder={tx('Konkreter Inhalt', 'Concrete content')} value={items.find((i) => i.format === f.key)!.note}
                  onChange={(e) => setItems(items.map((i) => (i.format === f.key ? { ...i, note: e.target.value } : i)))} />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-sm mt-sm">
          <button className="btn-gold btn-sm" onClick={async () => { await act('put', `/journey/needs/${n.id}/plan`, { items }); setEdit(false); }}>{tx('Speichern', 'Save')}</button>
          <button className="btn-outline btn-sm" onClick={() => setEdit(false)}>{tx('Abbrechen', 'Cancel')}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="block">
      <div className="flex items-center"><b>{tx('Supportplan', 'Support plan')}</b>
        {isAdmin && <button className="btn-ghost btn-sm right" onClick={() => setEdit(true)}>✎</button>}</div>
      {n.plan.length === 0 ? <small className="muted">{tx('Noch keine Formate', 'No formats yet')}</small> : (
        <div className="flex wrap gap-sm">
          {n.plan.map((p) => (
            <span key={p.id} className={`badge fmt-${FORMATS.find((f) => f.key === p.format)!.mechanism}`} title={p.note || ''}>
              {lx(formatLabel(p.format))}{p.note ? ` – ${p.note}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Matching Brief ------------------------------------------------------------
function BriefBlock({ n, isAdmin, act, tx, tags }: { n: Need; isAdmin: boolean; act: Act; tx: Tx; tags: Tag[] }) {
  const { locale } = useI18n();
  const b = n.brief;
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({
    main_role: (b?.main_role || 'lead_mentor') as SupportRole, experience: b?.experience || '', context_ref: b?.context_ref || '',
    network_access: b?.network_access || '', language: b?.language || 'en', duration: b?.duration || '', working_mode: b?.working_mode || '',
  });
  const [tagIds, setTagIds] = useState<number[]>(n.tags.map((t) => t.id));
  const fields: { k: keyof typeof f; de: string; en: string }[] = [
    { k: 'experience', de: 'Erfahrung (Branche, Fach, Skalierung)', en: 'Experience (industry, subject, scaling)' },
    { k: 'context_ref', de: 'Kontextbezug (Region, Zielmarkt)', en: 'Context (region, target market)' },
    { k: 'network_access', de: 'Netzwerkzugang', en: 'Network access' },
    { k: 'duration', de: 'Begleitungsdauer', en: 'Duration' },
    { k: 'working_mode', de: 'Arbeitsweise', en: 'Working mode' },
  ];
  if (edit) {
    return (
      <div className="subcard">
        <b>Matching Brief</b>
        <div className="flex wrap gap-sm mt-sm">
          {(Object.keys(ROLE_LABEL) as SupportRole[]).map((r) => (
            <button key={r} type="button" title={lx(ROLE_HINT[r])} className={f.main_role === r ? 'btn-sm btn-gold' : 'btn-sm btn-outline'} onClick={() => setF({ ...f, main_role: r })}>
              {lx(ROLE_LABEL[r])}
            </button>
          ))}
        </div>
        <small className="muted">{lx(ROLE_HINT[f.main_role])}</small>
        <div className="row mt-sm">
          {fields.map((x) => (
            <div className="field" key={x.k}><label>{lx(x)}</label>
              <input value={f[x.k]} onChange={(e) => setF({ ...f, [x.k]: e.target.value })} /></div>
          ))}
          <div className="field"><label>{tx('Sprache', 'Language')}</label>
            <select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}>
              {['en', 'fr', 'es', 'pt', 'ar', 'de'].map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
            </select></div>
        </div>
        <label>{tx('Matching-Merkmale (Grundlage der Vorschläge)', 'Matching attributes (basis of suggestions)')}</label>
        <TagPicker tags={tags} selected={tagIds} onChange={setTagIds} />
        <div className="flex gap-sm mt-sm">
          <button className="btn-gold btn-sm" onClick={async () => { await act('put', `/journey/needs/${n.id}/brief`, { ...f, tagIds }); setEdit(false); }}>{tx('Speichern', 'Save')}</button>
          <button className="btn-outline btn-sm" onClick={() => setEdit(false)}>{tx('Abbrechen', 'Cancel')}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="block">
      <div className="flex items-center"><b>Matching Brief</b>
        {isAdmin && <button className="btn-ghost btn-sm right" onClick={() => setEdit(true)}>✎</button>}</div>
      {!b ? <small className="muted">{tx('Noch kein Matching Brief', 'No matching brief yet')}</small> : (
        <div className="brief">
          <p style={{ margin: '.2rem 0' }}>
            {tx('Gesucht wird', 'We are looking for')} <b>{lx(ROLE_LABEL[b.main_role])}</b>
            {b.experience && <> {tx('mit Erfahrung in', 'with experience in')} <b>{b.experience}</b></>}
            {b.context_ref && <>, {tx('Kenntnis von', 'knowledge of')} <b>{b.context_ref}</b></>}
            {b.network_access && <>, {tx('Zugang zu', 'access to')} <b>{b.network_access}</b></>}.
          </p>
          <small className="muted">{[b.language?.toUpperCase(), b.duration, b.working_mode].filter(Boolean).join(' · ')}</small>
        </div>
      )}
    </div>
  );
}

// --- Moderiertes Matching -------------------------------------------------------
function MatchBlock({ n, d, act, tx, userId, reload }: { n: Need; d: Detail; act: Act; tx: Tx; userId: number; reload: () => Promise<void> }) {
  const { locale } = useI18n();
  const nav = useNavigate();
  const isAdmin = d.access === 'admin';
  const [cands, setCands] = useState<Candidate[] | null>(null);
  const [err, setErr] = useState('');
  async function loadCands() {
    const r = await api.get<{ candidates: Candidate[] }>(`/journey/needs/${n.id}/candidates`);
    setCands(r.candidates);
  }
  async function respond(matchId: number, accept: boolean) {
    setErr('');
    try {
      const r = await api.post<{ status: string; conversationId: number | null }>(`/journey/matches/${matchId}/respond`, { accept });
      await reload();
      if (r.conversationId) nav(`/messages/${r.conversationId}`);
    } catch (e) { setErr(e instanceof ApiError ? e.message : String(e)); }
  }
  const visible = n.matches.filter((m) => m.status !== 'declined' || isAdmin);
  return (
    <div className="block">
      <div className="flex items-center"><b>{tx('Matching', 'Matching')}</b>
        {isAdmin && d.case.step === 'matching' && <button className="btn-outline btn-sm right" onClick={loadCands}>{tx('Vorschläge berechnen', 'Compute suggestions')}</button>}
      </div>
      {visible.length === 0 && <small className="muted">{tx('Noch keine Einladung', 'No invitation yet')}</small>}
      {visible.map((m) => {
        const mine = m.supporter_id === userId;
        const iAmEem = d.case.eem_id === userId;
        return (
          <div key={m.id} className="list-item" style={{ padding: '.5rem 0' }}>
            <Avatar name={m.supporter_name} seed={m.supporter_avatar} size="sm" />
            <div className="grow">
              <b>{m.supporter_name}</b> <span className="badge badge-gold">{lx(ROLE_LABEL[m.role])}</span>
              <div><small>{m.supporter_headline}{m.score != null ? ` · Score ${Math.round(m.score)}` : ''}</small></div>
              <div className="flex wrap gap-sm">
                <span className={`badge ${m.supporter_ok ? 'badge-resolved' : ''}`}>{m.supporter_ok ? '✓' : '…'} {tx('Unterstützer:in', 'Supporter')}</span>
                <span className={`badge ${m.eem_ok ? 'badge-resolved' : ''}`}>{m.eem_ok ? '✓' : '…'} EEM</span>
                {m.status === 'confirmed' && <span className="badge badge-resolved">{tx('Match bestätigt', 'Match confirmed')}</span>}
                {m.status === 'declined' && <span className="badge">{tx('abgelehnt', 'declined')}</span>}
              </div>
            </div>
            {m.status === 'invited' && mine && !m.supporter_ok && (
              <div className="flex gap-sm">
                <button className="btn-gold btn-sm" onClick={() => respond(m.id, true)}>{tx('Zusagen', 'Accept')}</button>
                <button className="btn-outline btn-sm" onClick={() => respond(m.id, false)}>{tx('Absagen', 'Decline')}</button>
              </div>
            )}
            {m.status === 'invited' && iAmEem && !!m.supporter_ok && !m.eem_ok && (
              <div className="flex gap-sm">
                <button className="btn-gold btn-sm" onClick={() => respond(m.id, true)}>{tx('Match bestätigen', 'Confirm match')}</button>
                <button className="btn-outline btn-sm" onClick={() => respond(m.id, false)}>{tx('Ablehnen', 'Decline')}</button>
              </div>
            )}
          </div>
        );
      })}
      {err && <div className="error">{err}</div>}
      {cands && (
        <div className="subcard">
          <small className="muted">{tx(
            'Vorschläge des Systems. Persönliche Passung ist nicht berechenbar – bitte vor der Einladung prüfen. Erst wenn beide Seiten zusagen, gilt der Match.',
            'System suggestions. Personal fit cannot be computed – please check before inviting. The match only counts once both sides accept.'
          )}</small>
          {cands.length === 0 && <p className="muted">{tx('Keine passende Person mit dieser Rolle verfügbar – alternatives Format oder externen Partner prüfen.', 'No suitable person with this role available – consider an alternative format or external partner.')}</p>}
          {cands.map((c) => (
            <div key={c.supporter.id} className="match mt-sm">
              <div className="flex items-center gap">
                <Avatar name={c.supporter.name} seed={c.supporter.avatar_seed} />
                <div className="grow">
                  <b>{c.supporter.name}</b>
                  <div className="muted">{c.supporter.headline}</div>
                  <small>{c.supporter.country} · {c.supporter.capacity_hours ?? '?'} h/{tx('Monat', 'month')} · {tx('aktive Fälle', 'active cases')}: {c.active_load}</small>
                </div>
                <div className="score-ring" style={{ ['--p' as any]: c.score }}><span>{Math.round(c.score)}</span></div>
              </div>
              <div className="flex wrap gap-sm mt-sm">{c.matchedTags.map((t, i) => <span key={i} className="badge badge-domain">{lx(t)}</span>)}</div>
              <div className="grid grid-5 mt-sm">
                {([
                  ['expertise', tx('Fachlich', 'Expertise')], ['context', tx('Kontext', 'Context')], ['network', tx('Netzwerk', 'Network')],
                  ['language', tx('Sprache', 'Language')], ['capacity', tx('Kapazität', 'Capacity')],
                ] as const).map(([k, l]) => (
                  <div key={k}><div className="flex"><small>{l}</small><small className="right">{c.components[k]}%</small></div>
                    <div className="meter"><i style={{ width: `${c.components[k]}%` }} /></div></div>
                ))}
              </div>
              <div className="mt-sm">
                {c.status ? (
                  <span className={`badge ${c.status === 'confirmed' ? 'badge-resolved' : ''}`}>
                    {c.status === 'invited' ? tx('eingeladen', 'invited') : c.status === 'confirmed' ? tx('bestätigt', 'confirmed') : tx('abgelehnt', 'declined')}
                  </span>
                ) : (
                  <button className="btn-gold btn-sm" onClick={async () => { await act('post', `/journey/needs/${n.id}/invite`, { supporterId: c.supporter.id, role: c.role }); await loadCands(); }}>
                    {tx('Als', 'Invite as')} {lx(ROLE_LABEL[c.role])} {tx('einladen', '')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Vereinbarung --------------------------------------------------------------
function AgreementBlock({ n, canEdit, act, tx }: { n: Need; canEdit: boolean; act: Act; tx: Tx }) {
  const a = n.agreement;
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ goal: a?.goal || n.goal, roles: a?.roles || '', next_steps: a?.next_steps || '', review_date: a?.review_date || '' });
  if (edit) {
    return (
      <form className="subcard" onSubmit={async (e) => { e.preventDefault(); await act('put', `/journey/needs/${n.id}/agreement`, f); setEdit(false); }}>
        <b>{tx('Vereinbarung', 'Agreement')}</b>
        <div className="row mt-sm">
          <div className="field"><label>{tx('Unterstützungsziel', 'Support goal')}</label><input value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} required /></div>
          <div className="field"><label>{tx('Review-Termin', 'Review date')}</label><input type="date" value={f.review_date} onChange={(e) => setF({ ...f, review_date: e.target.value })} required /></div>
        </div>
        <div className="field"><label>{tx('Rollen und Verantwortlichkeiten', 'Roles and responsibilities')}</label><input value={f.roles} onChange={(e) => setF({ ...f, roles: e.target.value })} /></div>
        <div className="field"><label>{tx('Nächste Schritte', 'Next steps')}</label><input value={f.next_steps} onChange={(e) => setF({ ...f, next_steps: e.target.value })} /></div>
        <div className="flex gap-sm">
          <button className="btn-gold btn-sm" type="submit">{tx('Festhalten', 'Record')}</button>
          <button className="btn-outline btn-sm" type="button" onClick={() => setEdit(false)}>{tx('Abbrechen', 'Cancel')}</button>
        </div>
      </form>
    );
  }
  return (
    <div className="block">
      <div className="flex items-center"><b>{tx('Vereinbarung', 'Agreement')}</b>
        {canEdit && <button className="btn-ghost btn-sm right" onClick={() => setEdit(true)}>✎</button>}</div>
      {!a ? <small className="muted">{tx('Noch keine Vereinbarung', 'No agreement yet')}</small> : (
        <div>
          <div>{a.goal} <span className="badge badge-stage">Review {a.review_date}</span></div>
          {a.roles && <small className="muted" style={{ display: 'block' }}>{tx('Rollen', 'Roles')}: {a.roles}</small>}
          {a.next_steps && <small className="muted" style={{ display: 'block' }}>{tx('Nächste Schritte', 'Next steps')}: {a.next_steps}</small>}
        </div>
      )}
    </div>
  );
}

// --- Re-Assessment / Outcome ------------------------------------------------------
function ReviewBlock({ n, canEdit, act, tx }: { n: Need; canEdit: boolean; act: Act; tx: Tx }) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ progress: 'partial', outcome: '', next_step: 'continue' });
  return (
    <div className="block">
      <div className="flex items-center"><b>{tx('Re-Assessment & Outcome', 'Re-assessment & outcome')}</b>
        {canEdit && !open && <button className="btn-outline btn-sm right" onClick={() => setOpen(true)}>{tx('Review erfassen', 'Record review')}</button>}</div>
      {n.reviews.length === 0 && !open && <small className="muted">{tx('Noch kein Review', 'No review yet')}</small>}
      {n.reviews.map((r) => (
        <div key={r.id} style={{ margin: '.3rem 0' }}>
          <span className={`badge ${r.progress === 'achieved' ? 'badge-resolved' : r.progress === 'partial' ? 'badge-matched' : 'badge-open'}`}>{lx(PROGRESS_LABEL[r.progress])}</span>{' '}
          {r.outcome} <small className="muted">· {lx(NEXT_STEP_LABEL[r.next_step])} · {timeAgo(r.created_at, locale)}</small>
        </div>
      ))}
      {open && (
        <form className="subcard" onSubmit={async (e) => { e.preventDefault(); await act('post', `/journey/needs/${n.id}/reviews`, f); setOpen(false); }}>
          <small className="muted">{tx('Abgleich mit dem vereinbarten Ziel und Erfolgskriterium', 'Compare with the agreed goal and success criterion')}: <b>{n.success_criterion || n.goal}</b></small>
          <div className="row mt-sm">
            <div className="field"><label>{tx('Zielerreichung', 'Goal attainment')}</label>
              <select value={f.progress} onChange={(e) => setF({ ...f, progress: e.target.value })}>
                {Object.entries(PROGRESS_LABEL).map(([k, v]) => <option key={k} value={k}>{lx(v)}</option>)}
              </select></div>
            <div className="field"><label>{tx('Nächster Schritt', 'Next step')}</label>
              <select value={f.next_step} onChange={(e) => setF({ ...f, next_step: e.target.value })}>
                {Object.entries(NEXT_STEP_LABEL).map(([k, v]) => <option key={k} value={k}>{lx(v)}</option>)}
              </select></div>
          </div>
          <div className="field"><label>{tx('Beobachtetes Ergebnis (Outcome, z.B. Partnerschaft vereinbart, Umsatz, Jobs)', 'Observed result (outcome, e.g. partnership agreed, revenue, jobs)')}</label>
            <input value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })} /></div>
          <div className="flex gap-sm">
            <button className="btn-gold btn-sm" type="submit">{tx('Speichern', 'Save')}</button>
            <button className="btn-outline btn-sm" type="button" onClick={() => setOpen(false)}>{tx('Abbrechen', 'Cancel')}</button>
          </div>
        </form>
      )}
    </div>
  );
}

// --- Abschluss -----------------------------------------------------------------
function CloseForm({ act, caseId, tx, onCancel }: { act: Act; caseId: number; tx: Tx; onCancel: () => void }) {
  const { locale } = useI18n();
  const [reason, setReason] = useState('goal_achieved');
  const [note, setNote] = useState('');
  return (
    <form className="subcard" onSubmit={async (e) => { e.preventDefault(); await act('post', `/journey/cases/${caseId}/close`, { reason, note }); }}>
      <div className="field"><label>{tx('Abschlussgrund', 'Reason')}</label>
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {['goal_achieved', 'eem_request', 'no_further_need'].map((r) => <option key={r} value={r}>{lx(CLOSE_REASON_LABEL[r])}</option>)}
        </select></div>
      <div className="field"><label>{tx('Abschlussdokumentation (erreichte Ziele, Ergebnisse, Empfehlung)', 'Closing documentation (goals achieved, results, recommendation)')}</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} required /></div>
      <div className="flex gap-sm">
        <button className="btn-gold btn-sm" type="submit">{tx('Fall abschliessen', 'Close case')}</button>
        <button className="btn-outline btn-sm" type="button" onClick={onCancel}>{tx('Abbrechen', 'Cancel')}</button>
      </div>
    </form>
  );
}

export default function CaseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { locale } = useI18n();
  const tx: Tx = trx;
  const [d, setD] = useState<Detail | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState<{ msg: string; missing?: { de: string; en: string }[] } | null>(null);
  const [showNeedForm, setShowNeedForm] = useState(false);
  const [expectations, setExpectations] = useState('');
  const [note, setNote] = useState('');
  const [closing, setClosing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function reload() {
    setD(await api.get<Detail>(`/journey/cases/${id}`));
  }
  useEffect(() => {
    reload().catch((e) => setError({ msg: e.message }));
    api.get<{ tags: Tag[] }>('/tags').then((r) => setTags(r.tags));
  }, [id]);

  const act: Act = async (method, path, body) => {
    setError(null);
    try {
      const r = await api[method]<Detail>(path, body);
      if (r && (r as Detail).case) setD(r as Detail);
      else await reload();
    } catch (e) {
      if (e instanceof ApiError) {
        // Fehlende Uebergabe-Outputs vom Server anzeigen.
        setError({ msg: e.message, missing: e.data?.missing });
        await reload();
      } else setError({ msg: String(e) });
      throw e;
    }
  };
  const safe = (p: Promise<void>) => p.catch(() => undefined);

  if (error && !d) return <div className="card"><p className="error">{error.msg}</p><Link to="/journey">← Support Journey</Link></div>;
  if (!d) return <Spinner />;

  const c = d.case;
  const isAdmin = d.access === 'admin';
  const isEem = d.access === 'eem';
  const closed = c.step === 'closed';
  const si = stepIndex(c.step);
  const current = d.needs.filter((n) => n.cycle === c.cycle);
  const history = d.needs.filter((n) => n.cycle !== c.cycle);
  const prioritized = current.filter((n) => n.priority_rank).sort((a, b) => a.priority_rank! - b.priority_rank!);
  const others = current.filter((n) => !n.priority_rank);
  const canEditNeeds = (isAdmin || isEem) && !closed && si <= stepIndex('prioritization');
  const canAgree = (isAdmin || isEem || d.access === 'supporter') && !closed;

  return (
    <div>
      <Link className="btn btn-ghost" to="/journey">← Support Journey</Link>

      <div className="card mt-sm">
        <div className="flex items-center gap wrap">
          <Avatar name={d.eem.name} seed={d.eem.avatar_seed} size="lg" />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{d.eem.name}</h1>
            <small>{d.eem.headline} · {d.eem.country}
              {d.profile?.case_type ? ` · ${lx(CASE_TYPE_LABEL[d.profile.case_type])}` : ''}
              {c.cycle > 1 ? ` · ${tx('Zyklus', 'Cycle')} ${c.cycle}` : ''}</small>
            {d.coordinator && <div><small>{tx('Koordination', 'Coordination')}: {d.coordinator.name}</small></div>}
          </div>
          <span className="right"><StepBadge step={c.step} /></span>
        </div>
        <Stepper step={c.step} />

        {!closed && d.access !== 'invited' && (
          <div className={`handover ${d.handover.canAdvance ? 'ok' : ''}`}>
            <div className="flex items-center wrap gap-sm">
              <b>{tx('Übergabe', 'Handover')}: {lx(STEP_LABEL[c.step])}{d.handover.next ? ` → ${lx(STEP_LABEL[d.handover.next])}` : ''}</b>
              <small className="muted">· {tx('Output', 'Output')}: {lx(STEP_OUTPUT[c.step])}</small>
            </div>
            {d.handover.missing.length > 0 ? (
              <ul className="missing">{d.handover.missing.map((m) => <li key={m.code}>{lx(m)}</li>)}</ul>
            ) : <small>✓ {tx('Alle Outputs liegen vor.', 'All outputs are available.')}</small>}
            {isAdmin && (
              <div className="flex wrap gap-sm mt-sm">
                {d.handover.next && (
                  <button className="btn-gold btn-sm" disabled={!d.handover.canAdvance} onClick={() => safe(act('post', `/journey/cases/${c.id}/advance`))}>
                    {tx('Weiter zu', 'Proceed to')} {lx(STEP_LABEL[d.handover.next])} →
                  </button>
                )}
                {c.step === 'reassessment' && (
                  <button className="btn-gold btn-sm" disabled={d.handover.missing.length > 0} onClick={() => safe(act('post', `/journey/cases/${c.id}/new-cycle`))}>
                    ↺ {tx('Neuer Zyklus (zurück zur Priorisierung)', 'New cycle (back to prioritisation)')}
                  </button>
                )}
                {c.step !== 'intake' && <button className="btn-outline btn-sm" onClick={() => setClosing(true)}>{tx('Abschliessen', 'Close')}</button>}
              </div>
            )}
            {closing && <CloseForm act={(m, p, b) => act(m, p, b).then(() => setClosing(false))} caseId={c.id} tx={tx} onCancel={() => setClosing(false)} />}
          </div>
        )}
        {closed && (
          <div className="handover ok">
            <b>{c.closed_reason ? lx(CLOSE_REASON_LABEL[c.closed_reason]) : tx('Abgeschlossen', 'Closed')}</b>
            {c.closing_note && <p style={{ margin: '.3rem 0 0' }}>{c.closing_note}</p>}
          </div>
        )}
        {error && (
          <div className="error">
            {error.msg}
            {error.missing && <ul className="missing">{error.missing.map((m, i) => <li key={i}>{lx(m)}</li>)}</ul>}
          </div>
        )}
      </div>

      {d.access === 'invited' && (
        <div className="notice mt">{tx(
          'Du wurdest von stars für einen Bedarf angefragt. Du siehst den Matching Brief; das vollständige Profil wird erst nach beidseitiger Bestätigung sichtbar.',
          'stars has asked you to support a need. You see the matching brief; the full profile becomes visible only after both sides confirm.'
        )}</div>
      )}

      {/* 1 Aufnahme */}
      {d.access !== 'invited' && (
        <div className="card mt">
          <h3>1 · {lx(STEP_LABEL.intake)}</h3>
          <p style={{ margin: 0 }}><small className="muted">{tx('Anliegen', 'Concern')}:</small> {c.motivation}</p>
          {c.expectations && <p style={{ margin: '.3rem 0 0' }}><small className="muted">{tx('Geklärte Erwartungen', 'Clarified expectations')}:</small> {c.expectations}</p>}
          {isAdmin && c.step === 'intake' && (
            <div className="subcard">
              <div className="field"><label>{tx('Erwartungen klären (Umfang, Dauer, Mitwirkung)', 'Clarify expectations (scope, duration, participation)')}</label>
                <textarea value={expectations} onChange={(e) => setExpectations(e.target.value)} /></div>
              <div className="flex gap-sm">
                <button className="btn-gold btn-sm" onClick={() => safe(act('post', `/journey/cases/${c.id}/intake`, { decision: 'accepted', expectations }))}>{tx('Aufnehmen', 'Accept')}</button>
                <button className="btn-outline btn-sm" onClick={() => safe(act('post', `/journey/cases/${c.id}/intake`, { decision: 'declined', expectations }))}>{tx('Ablehnen', 'Decline')}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2 Assessment */}
      {d.access !== 'invited' && si >= 1 && (
        <div className="card mt">
          <div className="flex items-center gap-sm">
            <h3 style={{ margin: 0 }}>2 · {lx(STEP_LABEL.assessment)} – {tx('EEM-Profil', 'EEM profile')}</h3>
            <span className="right">
              {d.profile?.validated_at ? <span className="badge badge-resolved">✓ {tx('validiert', 'validated')}</span> : <span className="badge badge-open">{tx('nicht validiert', 'not validated')}</span>}
            </span>
          </div>
          {!d.profile ? <p className="muted">{tx('Noch nicht ausgefüllt.', 'Not filled in yet.')}</p> : (
            <div className="grid grid-2 mt-sm">
              {QUESTIONNAIRES.map((qq) => (
                <div key={qq.area} className="subcard" style={{ margin: 0 }}>
                  <b>{lx(qq.title).split(' – ')[0]}</b>
                  {qq.questions.map((q) => (
                    <div key={q.key}><small className="muted">{lx(q.label)}:</small> <small>{answerLabel(q, d.profile![qq.area][q.key], locale)}</small></div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-sm mt-sm">
            {isEem && !closed && <Link className="btn btn-outline btn-sm" to="/journey/profile">{tx('Profil bearbeiten', 'Edit profile')}</Link>}
            {isAdmin && <Link className="btn btn-outline btn-sm" to={`/journey/profile/${c.eem_id}`}>{tx('Profil prüfen & validieren', 'Review & validate profile')}</Link>}
          </div>
        </div>
      )}

      {/* 3 Priorisierung und folgende Schritte je Bedarf */}
      {si >= 2 && (
        <div className="card mt">
          <div className="flex items-center">
            <h3 style={{ margin: 0 }}>3 · {tx('Bedarfe und Priorisierung', 'Needs and prioritisation')}</h3>
            {canEditNeeds && !showNeedForm && <button className="btn-outline btn-sm right" onClick={() => setShowNeedForm(true)}>+ {tx('Bedarf', 'Need')}</button>}
          </div>
          <small className="muted">{tx(
            'Gemeinsam ein bis drei Bedarfe priorisieren (Relevanz, Dringlichkeit, Wirkung, Beitrag von stars, Umsetzbarkeit).',
            'Jointly prioritise one to three needs (relevance, urgency, impact, stars contribution, feasibility).'
          )}</small>
          {showNeedForm && (
            <NeedForm tags={tags} tx={tx} onCancel={() => setShowNeedForm(false)}
              onSubmit={async (b) => { await act('post', `/journey/cases/${c.id}/needs`, b); setShowNeedForm(false); }} />
          )}

          {prioritized.map((n) => (
            <div key={n.id} className="need prioritized">
              <NeedHeader n={n} canEdit={canEditNeeds} act={act} tags={tags} tx={tx} />
              {si <= stepIndex('prioritization') && <Prioritization n={n} canEdit={canEditNeeds} act={act} tx={tx} />}
              {si >= stepIndex('support_plan') && (
                <div className="need-blocks">
                  <PlanBlock n={n} isAdmin={isAdmin && si <= stepIndex('matching') && !closed} act={act} tx={tx} />
                  <BriefBlock n={n} isAdmin={isAdmin && si <= stepIndex('matching') && !closed} act={act} tx={tx} tags={tags} />
                  {si >= stepIndex('matching') && <MatchBlock n={n} d={d} act={act} tx={tx} userId={user!.id} reload={reload} />}
                  {si >= stepIndex('agreement') && <AgreementBlock n={n} canEdit={canAgree} act={act} tx={tx} />}
                  {si >= stepIndex('implementation') && <ReviewBlock n={n} canEdit={canAgree} act={act} tx={tx} />}
                </div>
              )}
            </div>
          ))}
          {others.map((n) => (
            <div key={n.id} className="need">
              <NeedHeader n={n} canEdit={canEditNeeds} act={act} tags={tags} tx={tx} />
              {si <= stepIndex('prioritization') && <Prioritization n={n} canEdit={canEditNeeds} act={act} tx={tx} />}
            </div>
          ))}
          {current.length === 0 && !showNeedForm && <p className="muted">{tx('Noch keine Bedarfe erfasst.', 'No needs recorded yet.')}</p>}

          {isEem && c.step === 'support_plan' && (
            <div className="handover mt">
              {c.plan_consent_at
                ? <small>✓ {tx('Du hast dem Supportplan zugestimmt.', 'You have agreed to the support plan.')}</small>
                : <button className="btn-gold btn-sm" onClick={() => safe(act('post', `/journey/cases/${c.id}/plan-consent`))}>{tx('Supportplan zustimmen', 'Agree to support plan')}</button>}
            </div>
          )}
          {history.length > 0 && (
            <div className="mt">
              <button className="btn-ghost btn-sm" onClick={() => setShowHistory((s) => !s)}>{showHistory ? '▲' : '▼'} {tx('Frühere Zyklen', 'Earlier cycles')} ({history.length})</button>
              {showHistory && history.map((n) => (
                <div key={n.id} className="need">
                  <NeedHeader n={n} canEdit={false} act={act} tags={tags} tx={tx} />
                  {n.reviews.length > 0 && <ReviewBlock n={n} canEdit={false} act={act} tx={tx} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Verlauf / Fortschritt */}
      {d.access !== 'invited' && (
        <div className="card mt">
          <h3>{tx('Verlauf und Fortschritt', 'History and progress')}</h3>
          {!closed ? (
            <form className="flex gap-sm" onSubmit={async (e) => { e.preventDefault(); await safe(act('post', `/journey/cases/${c.id}/events`, { body: note, type: c.step === 'implementation' ? 'progress' : 'note' })); setNote(''); }}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={c.step === 'implementation' ? tx('Fortschritt dokumentieren …', 'Document progress …') : tx('Notiz …', 'Note …')} required />
              <button className="btn-gold" type="submit">{tx('Erfassen', 'Add')}</button>
            </form>
          ) : null}
          <ul className="timeline">
            {d.events.map((e) => (
              <li key={e.id} className={`ev-${e.type}`}>
                <small className="muted">{timeAgo(e.created_at, locale)} · {e.user_name || 'stars'}</small>
                <div>
                  {e.type === 'step' && e.step && <b>{lx(STEP_LABEL[e.step])}{e.body ? ': ' : ''}</b>}
                  {e.type === 'progress' && <span className="badge badge-resolved">{tx('Fortschritt', 'Progress')}</span>}{' '}
                  {e.body}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
