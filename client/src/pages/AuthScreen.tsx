import { useState } from 'react';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { isDemo } from '../config';

export default function AuthScreen() {
  const { t } = useI18n();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const [form, setForm] = useState({
    email: '', password: '', name: '', role: 'entrepreneur', country: '', headline: '', signup_note: '',
  });

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else {
        const r = await register(form);
        if (r.pending) {
          setInfo(t('auth.pendingInfo'));
          setMode('login');
          setForm({ ...form, password: '' });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Fehler');
    } finally {
      setBusy(false);
    }
  }

  function demo(email: string) {
    setForm({ ...form, email, password: 'stars1234' });
    setMode('login');
  }

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <span className="star">★</span>
        <h1>stars</h1>
        <p style={{ color: '#cdd9e6', fontSize: '1.1rem' }}>
          {mode === 'login' ? t('app.tagline') : t('app.tagline')}
        </p>
        <ul>
          <li>Community-Foren für Entrepreneurs & Expert:innen</li>
          <li>Intelligentes Frage-Experten-Matching</li>
          <li>1:1-Mentoring per Direktnachricht</li>
          <li>Microlearning-Bibliothek</li>
        </ul>
      </div>

      <div className="auth-form">
        <form className="card" onSubmit={submit}>
          <h2>{mode === 'login' ? t('auth.welcome') : t('auth.createAccount')}</h2>

          {mode === 'register' && (
            <>
              <div className="field">
                <label>{t('auth.name')}</label>
                <input value={form.name} onChange={set('name')} required />
              </div>
              <div className="field">
                <label>{t('auth.role')}</label>
                <select value={form.role} onChange={set('role')}>
                  <option value="entrepreneur">{t('auth.role.entrepreneur')}</option>
                  <option value="mentor">{t('auth.role.mentor')}</option>
                </select>
              </div>
              <div className="row">
                <div className="field">
                  <label>{t('auth.country')} <small>({t('common.optional')})</small></label>
                  <input value={form.country} onChange={set('country')} />
                </div>
                <div className="field">
                  <label>{t('auth.headline')} <small>({t('common.optional')})</small></label>
                  <input value={form.headline} onChange={set('headline')} />
                </div>
              </div>
              <div className="field">
                <label>{t('auth.signupNote')}</label>
                <textarea rows={2} value={form.signup_note} onChange={set('signup_note')} required placeholder={t('auth.signupNoteHint')} />
              </div>
            </>
          )}

          <div className="field">
            <label>{t('auth.email')}</label>
            <input type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div className="field">
            <label>{t('auth.password')}</label>
            <input type="password" value={form.password} onChange={set('password')} required />
          </div>

          {info && <div className="notice">{info}</div>}
          {error && <div className="error">{error}</div>}

          <button className="btn-gold btn-block" disabled={busy} type="submit">
            {mode === 'login' ? t('auth.login') : t('auth.register')}
          </button>

          <p className="mt-sm" style={{ textAlign: 'center', margin: '.8rem 0 0' }}>
            <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); setError(''); setInfo(''); }}>
              {mode === 'login' ? t('auth.noAccount') + ' ' + t('auth.register') : t('auth.hasAccount') + ' ' + t('auth.login')}
            </a>
          </p>

          {mode === 'login' && (
            <div className="notice mt">
              <b>{t('auth.demoHint')}</b>
              <div className="mt-sm flex wrap gap-sm">
                {(import.meta.env.DEV || isDemo()) && (
                  <button type="button" className="btn-sm btn-outline" onClick={() => demo('admin@the-stars.ch')}>Admin</button>
                )}
                <button type="button" className="btn-sm btn-outline" onClick={() => demo('anna.keller@example.com')}>Mentor:in</button>
                <button type="button" className="btn-sm btn-outline" onClick={() => demo('amara.okafor@example.com')}>Entrepreneur:in</button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
