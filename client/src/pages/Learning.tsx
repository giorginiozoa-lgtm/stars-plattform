import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';
import { Spinner, TagPill } from '../components';
import type { LearningModule } from '../types';

export default function Learning() {
  const { t, loc } = useI18n();
  const [modules, setModules] = useState<LearningModule[] | null>(null);
  const [active, setActive] = useState<LearningModule | null>(null);

  async function load() {
    const r = await api.get<{ modules: LearningModule[] }>('/learning');
    setModules(r.modules);
  }
  useEffect(() => { load(); }, []);

  async function setProgress(mod: LearningModule, progress: number) {
    await api.post(`/learning/${mod.id}/progress`, { progress });
    await load();
    setActive((a) => (a ? { ...a, progress, completed: progress >= 100 } : a));
  }

  if (!modules) return <Spinner />;

  return (
    <div>
      <div className="page-head">
        <h1>{t('learning.title')}</h1>
        <p>{t('learning.subtitle')}</p>
      </div>

      <div className="grid grid-4">
        {modules.map((m) => (
          <div key={m.id} className="card card-hover" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onClick={() => setActive(m)}>
            <div style={{ background: 'linear-gradient(135deg,var(--navy-500),var(--navy))', borderRadius: 'var(--radius-sm)', height: 90, display: 'grid', placeItems: 'center', color: '#fff', fontSize: '2rem' }}>▶</div>
            <div className="flex items-center gap-sm mt-sm">
              <span className={`badge badge-stage`}>{t('learning.level.' + m.level)}</span>
              <small className="muted right">{m.duration_min} {t('learning.min')}</small>
            </div>
            <h4 className="mt-sm">{loc(m, 'title')}</h4>
            <p className="muted" style={{ fontSize: '.85rem', flex: 1 }}>{loc(m, 'description')}</p>
            {m.completed ? (
              <span className="badge badge-resolved">✓ {t('learning.completed')}</span>
            ) : m.progress > 0 ? (
              <div className="progress"><i style={{ width: `${m.progress}%` }} /></div>
            ) : null}
          </div>
        ))}
      </div>

      {active && (
        <>
          <div className="backdrop" onClick={() => setActive(null)} />
          <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', zIndex: 50, padding: '1rem' }}>
            <div className="card" style={{ maxWidth: 640, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
              <div className="flex items-center">
                <h2 style={{ margin: 0 }}>{loc(active, 'title')}</h2>
                <button className="btn-ghost right" onClick={() => setActive(null)}>✕</button>
              </div>
              <div style={{ background: '#000', borderRadius: 'var(--radius-sm)', aspectRatio: '16/9', display: 'grid', placeItems: 'center', color: '#fff', margin: '.6rem 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem' }}>▶</div>
                  <small style={{ color: '#aaa' }}>{t('learning.videoNote')}</small>
                </div>
              </div>
              <div className="flex wrap gap-sm">
                <span className={`badge badge-stage`}>{t('learning.level.' + active.level)}</span>
                <span className="badge">{active.duration_min} {t('learning.min')}</span>
                {active.tags.map((tg) => <TagPill key={tg.id} tag={tg} />)}
              </div>
              <p className="mt-sm">{loc(active, 'description')}</p>

              <div className="progress mt"><i style={{ width: `${active.progress}%` }} /></div>
              <div className="flex gap-sm mt">
                {active.progress === 0 && <button className="btn-gold btn-sm" onClick={() => setProgress(active, 50)}>{t('learning.start')}</button>}
                {active.progress > 0 && !active.completed && <button className="btn-outline btn-sm" onClick={() => setProgress(active, Math.min(100, active.progress + 25))}>{t('learning.continue')}</button>}
                {!active.completed && <button className="btn-gold btn-sm" onClick={() => setProgress(active, 100)}>{t('learning.markComplete')}</button>}
                {active.completed && <span className="badge badge-resolved">✓ {t('learning.completed')}</span>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
