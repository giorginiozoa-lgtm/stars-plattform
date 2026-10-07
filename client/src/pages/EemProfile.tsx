// Iteration 2 – Situations- und Bedarfsanalyse, Schritt 1 (FA-14): vier kurze
// Online-Frageboegen Context, Ecosystem, Venture und Entrepreneur. Die
// Programmkoordination validiert das Profil im Vertiefungsinterview.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n, lx, trx } from '../i18n';
import { Spinner } from '../components';
import { QUESTIONNAIRES, CASE_TYPE_LABEL, type Question } from '../journey';
import type { Answers, CaseType, EemProfile as Profile } from '../types';

type Area = 'context' | 'ecosystem' | 'venture' | 'entrepreneur';
const EMPTY: Record<Area, Answers> = { context: {}, ecosystem: {}, venture: {}, entrepreneur: {} };

function Field({ q, value, onChange }: { q: Question; value: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  const { locale } = useI18n();
  if (q.type === 'text') return <input value={(value as string) || ''} onChange={(e) => onChange(e.target.value)} />;
  if (q.type === 'textarea') return <textarea value={(value as string) || ''} onChange={(e) => onChange(e.target.value)} />;
  if (q.type === 'select')
    return (
      <div className="flex wrap gap-sm">
        {q.options.map((op) => (
          <button type="button" key={op.value} className={value === op.value ? 'btn-sm btn-gold' : 'btn-sm btn-outline'}
            onClick={() => onChange(value === op.value ? '' : op.value)}>{lx(op.label)}</button>
        ))}
      </div>
    );
  if (q.type !== 'multi') return null;
  const arr = Array.isArray(value) ? value : [];
  return (
    <div className="flex wrap gap-sm">
      {q.options.map((op) => (
        <button type="button" key={op.value} className={arr.includes(op.value) ? 'btn-sm btn-gold' : 'btn-sm btn-outline'}
          onClick={() => onChange(arr.includes(op.value) ? arr.filter((x) => x !== op.value) : [...arr, op.value])}>{lx(op.label)}</button>
      ))}
    </div>
  );
}

export default function EemProfile() {
  const { userId } = useParams();
  const { user } = useAuth();
  const { locale } = useI18n();
  const nav = useNavigate();
  const tx = trx;
  const isAdmin = user!.role === 'admin';
  const path = userId ? `/journey/profile/${userId}` : '/journey/profile';

  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [answers, setAnswers] = useState<Record<Area, Answers>>(EMPTY);
  const [caseType, setCaseType] = useState<CaseType | ''>('');
  const [tab, setTab] = useState(0);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    api.get<{ profile: Profile | null }>(path).then((r) => {
      setProfile(r.profile);
      if (r.profile) {
        setAnswers({ context: r.profile.context, ecosystem: r.profile.ecosystem, venture: r.profile.venture, entrepreneur: r.profile.entrepreneur });
        setCaseType(r.profile.case_type || '');
      }
    });
  }, [path]);

  async function save(validated?: boolean) {
    const r = await api.put<{ profile: Profile }>(path, { ...answers, case_type: caseType || undefined, validated });
    setProfile(r.profile);
    setSaved(tx('Gespeichert.', 'Saved.'));
    setTimeout(() => setSaved(''), 2000);
  }

  if (profile === undefined) return <Spinner />;
  const q = QUESTIONNAIRES[tab];
  const filledCount = (a: Area) => Object.values(answers[a]).filter((v) => (Array.isArray(v) ? v.length : v)).length;

  return (
    <div>
      <button className="btn-ghost" onClick={() => nav(-1)}>← {tx('Zurück', 'Back')}</button>
      <div className="page-head">
        <h1>{tx('EEM-Profil', 'EEM profile')}</h1>
        <p>{tx(
          'Vier kurze Fragebögen (je ca. 10–15 Minuten). Die Antworten bilden dein Ausgangsprofil und bereiten das Vertiefungsinterview mit stars vor.',
          'Four short questionnaires (approx. 10–15 minutes each). Your answers form your initial profile and prepare the in-depth interview with stars.'
        )}</p>
      </div>

      <div className="card">
        <div className="flex wrap items-center gap-sm">
          <b>{tx('Falltyp', 'Case type')}:</b>
          {(Object.keys(CASE_TYPE_LABEL) as CaseType[]).map((ct) => (
            <button key={ct} type="button" className={caseType === ct ? 'btn-sm btn-gold' : 'btn-sm btn-outline'} onClick={() => setCaseType(ct)}>
              {lx(CASE_TYPE_LABEL[ct])}
            </button>
          ))}
          <span className="right">
            {profile?.validated_at
              ? <span className="badge badge-resolved">✓ {tx('validiert', 'validated')}</span>
              : <span className="badge badge-open">{tx('noch nicht validiert', 'not yet validated')}</span>}
          </span>
        </div>
        <small className="muted">{tx(
          'Venture Scaler: validiertes Venture im Skalierungsübergang. Ecosystem Builder: unterstützt selbst weitere Entrepreneurs.',
          'Venture Scaler: validated venture in the scaling transition. Ecosystem Builder: supports other entrepreneurs.'
        )}</small>
      </div>

      <div className="tabs mt">
        {QUESTIONNAIRES.map((qq, i) => (
          <button key={qq.area} className={i === tab ? 'active' : ''} onClick={() => setTab(i)}>
            {lx(qq.title).split(' – ')[0]} <small>({filledCount(qq.area)}/{qq.questions.length})</small>
          </button>
        ))}
      </div>

      <div className="card">
        <h3>{lx(q.title)}</h3>
        <p className="muted">{lx(q.intro)}</p>
        {q.questions.map((qq) => (
          <div className="field" key={qq.key}>
            <label>{lx(qq.label)}</label>
            <Field q={qq} value={answers[q.area][qq.key]} onChange={(v) => setAnswers({ ...answers, [q.area]: { ...answers[q.area], [qq.key]: v } })} />
          </div>
        ))}
        <div className="flex wrap gap-sm">
          <button className="btn-gold" onClick={() => save()}>{tx('Speichern', 'Save')}</button>
          {tab < QUESTIONNAIRES.length - 1 && (
            <button className="btn-outline" onClick={() => { save(); setTab(tab + 1); }}>{tx('Speichern & weiter', 'Save & next')} →</button>
          )}
          {isAdmin && (
            <button className="btn-outline right" onClick={() => save(!profile?.validated_at)}>
              {profile?.validated_at ? tx('Validierung zurücknehmen', 'Revoke validation') : tx('Im Vertiefungsinterview validiert', 'Validated in in-depth interview')}
            </button>
          )}
          {saved && <span className="badge badge-resolved">{saved}</span>}
        </div>
      </div>
    </div>
  );
}
