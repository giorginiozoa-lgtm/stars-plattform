// Onboarding: kurzer Einstieg nach der ersten Anmeldung in drei Schritten
// (Profil, Community, erster Schritt). Jeder Schritt ist freiwillig; das
// Onboarding laesst sich ueberspringen und im Profil erneut aufrufen.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n, trx } from '../i18n';
import { Spinner } from '../components';
import type { Community, Tag, User } from '../types';

const MAX_TAGS = 5;

export default function Onboarding() {
  const { user, refresh } = useAuth();
  const { loc } = useI18n();
  const nav = useNavigate();
  const tx = trx;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ country: user!.country || '', headline: user!.headline || '' });
  const [catalog, setCatalog] = useState<Tag[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [communities, setCommunities] = useState<Community[]>([]);

  useEffect(() => {
    api.get<{ user: User; tags: Tag[] }>('/auth/me').then((r) => setPicked(new Set(r.tags.map((t) => t.id))));
    api.get<{ tags: Tag[] }>('/tags').then((r) => setCatalog(r.tags.filter((t) => t.category === 'domain' || t.category === 'market')));
    api.get<{ communities: Community[] }>('/communities').then((r) => setCommunities(r.communities));
  }, []);

  function toggle(id: number) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else if (next.size < MAX_TAGS) next.add(id);
    setPicked(next);
  }

  async function saveProfile() {
    await api.patch('/auth/me', form);
    await api.put('/auth/me/tags', { tags: Array.from(picked).map((tag_id) => ({ tag_id, weight: 4 })) });
    setStep(1);
  }

  async function join(c: Community) {
    await api.post(`/communities/${c.id}/${c.my_role ? 'leave' : 'join'}`);
    const r = await api.get<{ communities: Community[] }>('/communities');
    setCommunities(r.communities);
  }

  async function finish(to: string) {
    await api.post('/auth/me/onboarded');
    await refresh();
    nav(to);
  }

  if (!catalog) return <Spinner />;
  const isMentor = user!.role === 'mentor';
  // Passende Communities zuerst (Thema der Community unter den gewaehlten Tags).
  const pickedSlugs = new Set(catalog.filter((t) => picked.has(t.id)).map((t) => t.slug));
  const sorted = [...communities].sort((a, b) => Number(pickedSlugs.has(b.tag_slug || '')) - Number(pickedSlugs.has(a.tag_slug || '')));
  const steps = [tx('Über dich', 'About you'), tx('Community', 'Community'), tx('Erster Schritt', 'First step')];

  return (
    <div className="onboarding">
      <div className="page-head">
        <h1>★ {tx('Willkommen bei stars!', 'Welcome to stars!')}</h1>
        <p>{tx('Drei kurze Schritte, dann kann es losgehen. Alles lässt sich später im Profil ändern.',
          'Three short steps and you are ready. You can change everything later in your profile.')}</p>
      </div>

      <div className="flex gap-sm wrap">
        {steps.map((s, i) => (
          <span key={s} className={`badge ${i === step ? 'badge-gold' : i < step ? 'badge-resolved' : ''}`}>
            {i < step ? '✓' : i + 1}. {s}
          </span>
        ))}
      </div>

      {step === 0 && (
        <div className="card mt">
          <h3>{tx('Über dich', 'About you')}</h3>
          <div className="row">
            <div className="field">
              <label>{tx('Land', 'Country')}</label>
              <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
            <div className="field">
              <label>{isMentor ? tx('Funktion / Erfahrung in einem Satz', 'Role / experience in one sentence') : tx('Dein Unternehmen in einem Satz', 'Your venture in one sentence')}</label>
              <input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>{isMentor
              ? tx('Wobei kannst du helfen? (bis zu 5)', 'Where can you help? (up to 5)')
              : tx('Wobei brauchst du Unterstützung? (bis zu 5)', 'Where do you need support? (up to 5)')}</label>
            <div className="flex wrap gap-sm">
              {catalog.map((t) => (
                <button type="button" key={t.id} className={picked.has(t.id) ? 'btn-sm btn-gold' : 'btn-sm btn-outline'} onClick={() => toggle(t.id)}>
                  {loc(t, 'name')}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-sm">
            <button className="btn-gold" onClick={saveProfile}>{tx('Weiter', 'Next')} →</button>
            <button className="btn-ghost right" onClick={() => finish('/dashboard')}>{tx('Überspringen', 'Skip')}</button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="card mt">
          <h3>{tx('Tritt einer Community bei', 'Join a community')}</h3>
          <p className="muted">{tx('In den Communities tauschst du dich mit anderen Entrepreneurs und Alumni aus. Passende stehen oben.',
            'Communities are where you exchange with other entrepreneurs and alumni. The best matches are at the top.')}</p>
          {sorted.map((c) => (
            <div key={c.id} className="flex items-center gap-sm" style={{ padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <b>{loc(c, 'name')}</b>
                {pickedSlugs.has(c.tag_slug || '') && <span className="badge badge-gold" style={{ marginLeft: '.4rem' }}>{tx('passt zu dir', 'good match')}</span>}
                <div className="muted clamp" style={{ fontSize: '.85rem' }}>{loc(c, 'description')}</div>
              </div>
              <button className={`btn-sm right ${c.my_role ? 'btn-outline' : 'btn-gold'}`} onClick={() => join(c)}>
                {c.my_role ? `✓ ${tx('Mitglied', 'Member')}` : tx('Beitreten', 'Join')}
              </button>
            </div>
          ))}
          <div className="flex gap-sm mt">
            <button className="btn-outline" onClick={() => setStep(0)}>← {tx('Zurück', 'Back')}</button>
            <button className="btn-gold" onClick={() => setStep(2)}>{tx('Weiter', 'Next')} →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card mt">
          <h3>{tx('Dein erster Schritt', 'Your first step')}</h3>
          <p className="muted">{tx('Wähle, womit du beginnen möchtest.', 'Choose where you would like to start.')}</p>
          <div className="grid grid-3">
            {(isMentor
              ? [
                  ['/profile', '🎯', tx('Unterstützung anbieten', 'Offer support'), tx('Rollen und verfügbare Zeit festlegen, damit stars dich passend anfragen kann.', 'Set your roles and available time so stars can approach you for the right cases.')],
                  ['/mentoring', '💬', tx('Fragen beantworten', 'Answer questions'), tx('Offene Fragen von Entrepreneurs ansehen.', 'Browse open questions from entrepreneurs.')],
                  ['/dashboard', '▦', tx('Zur Übersicht', 'Go to overview'), tx('Alles auf einen Blick.', 'Everything at a glance.')],
                ]
              : [
                  ['/journey/profile', '➜', tx('Bedarf erfassen', 'Describe your needs'), tx('Kurze Fragebögen; stars sucht danach passende Unterstützung.', 'Short questionnaires; stars then looks for the right support.')],
                  ['/network', '🤝', tx('Kontakt anfragen', 'Request an intro'), tx('stars stellt dich passenden Alumni, Partnern oder Investor:innen vor.', 'stars introduces you to suitable alumni, partners or investors.')],
                  ['/dashboard', '▦', tx('Zur Übersicht', 'Go to overview'), tx('Alles auf einen Blick.', 'Everything at a glance.')],
                ]
            ).map(([to, ico, title, text]) => (
              <div key={to} className="format" style={{ cursor: 'pointer' }} onClick={() => finish(to)}>
                <b>{ico} {title}</b>
                <small>{text}</small>
              </div>
            ))}
          </div>
          <div className="mt">
            <button className="btn-outline" onClick={() => setStep(1)}>← {tx('Zurück', 'Back')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
