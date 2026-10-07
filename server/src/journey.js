// Domaenenlogik der Support Journey (Iteration 2, Programmlogik nach
// Eberle et al., 2026a, Kap. 5.1.4 und 5.1.5.3). Getrennt von den Routen,
// damit die Uebergaberegeln an einer Stelle dokumentiert und testbar sind.
import { db } from './db.js';

// Reihenfolge der acht Prozessschritte; 'closed' ist der Ausstiegspunkt.
export const STEPS = [
  'intake',
  'assessment',
  'prioritization',
  'support_plan',
  'matching',
  'agreement',
  'implementation',
  'reassessment',
];

export const FORMATS = [
  'mentoring', 'skills', 'education', 'knowledge_sharing',
  'introductions', 'partnerships', 'projects', 'stage',
];

// Formate, fuer die keine einzelne Unterstuetzungsperson gematcht werden muss
// (sie laufen ueber Bibliothek bzw. Community).
const SELF_SERVE_FORMATS = new Set(['education', 'knowledge_sharing']);

export const ROLES = ['lead_mentor', 'expert', 'connector'];

export function parseJson(s) {
  try {
    const v = JSON.parse(s || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

const filled = (obj) =>
  Object.values(obj).some((v) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && String(v).trim() !== ''));

export function profileOf(userId) {
  const p = db.prepare('SELECT * FROM eem_profiles WHERE user_id = ?').get(userId);
  if (!p) return null;
  return {
    case_type: p.case_type,
    context: parseJson(p.context),
    ecosystem: parseJson(p.ecosystem),
    venture: parseJson(p.venture),
    entrepreneur: parseJson(p.entrepreneur),
    validated_at: p.validated_at,
    updated_at: p.updated_at,
  };
}

export function prioritizedNeeds(caseId, cycle) {
  return db
    .prepare(
      `SELECT * FROM needs WHERE case_id = ? AND cycle = ? AND priority_rank IS NOT NULL
       AND status != 'dropped' ORDER BY priority_rank`
    )
    .all(caseId, cycle);
}

const msg = (code, de, en) => ({ code, de, en });

/**
 * Prueft, ob der Output des aktuellen Schritts vorliegt (verbindliche Uebergabe).
 * Liefert den Folgeschritt und die Liste fehlender Elemente.
 */
export function handoverCheck(c) {
  const missing = [];
  const idx = STEPS.indexOf(c.step);
  const next = idx >= 0 && idx < STEPS.length - 1 ? STEPS[idx + 1] : null;
  const needs = prioritizedNeeds(c.id, c.cycle);

  switch (c.step) {
    case 'intake':
      if (c.intake_decision !== 'accepted')
        missing.push(msg('intake_decision', 'Aufnahmeentscheid durch stars', 'Intake decision by stars'));
      break;
    case 'assessment': {
      const p = profileOf(c.eem_id);
      for (const area of ['context', 'ecosystem', 'venture', 'entrepreneur']) {
        if (!p || !filled(p[area]))
          missing.push(msg(`profile_${area}`, `Profilbereich «${area}» ausgefüllt`, `Profile area “${area}” completed`));
      }
      if (p && !p.validated_at)
        missing.push(msg('profile_validated', 'Profil im Vertiefungsinterview validiert', 'Profile validated in in-depth interview'));
      break;
    }
    case 'prioritization':
      if (needs.length < 1 || needs.length > 3)
        missing.push(msg('needs_1_3', 'Ein bis drei priorisierte Bedarfe', 'One to three prioritised needs'));
      for (const n of needs) {
        if (!n.success_criterion)
          missing.push(msg(`need_${n.id}_criterion`, `Erfolgskriterium für «${n.goal}»`, `Success criterion for “${n.goal}”`));
      }
      break;
    case 'support_plan':
      for (const n of needs) {
        const items = db.prepare('SELECT format FROM plan_items WHERE need_id = ?').all(n.id);
        if (!items.length) missing.push(msg(`need_${n.id}_plan`, `Formate für «${n.goal}»`, `Formats for “${n.goal}”`));
        const needsPerson = items.some((i) => !SELF_SERVE_FORMATS.has(i.format));
        const brief = db.prepare('SELECT 1 FROM matching_briefs WHERE need_id = ?').get(n.id);
        if (needsPerson && !brief)
          missing.push(msg(`need_${n.id}_brief`, `Matching Brief für «${n.goal}»`, `Matching brief for “${n.goal}”`));
      }
      if (!c.plan_consent_at)
        missing.push(msg('plan_consent', 'Zustimmung des EEM zum Supportplan', 'EEM consent to support plan'));
      break;
    case 'matching':
      for (const n of needs) {
        const items = db.prepare('SELECT format FROM plan_items WHERE need_id = ?').all(n.id);
        const needsPerson = items.some((i) => !SELF_SERVE_FORMATS.has(i.format));
        const confirmed = db
          .prepare(`SELECT 1 FROM case_matches WHERE need_id = ? AND status = 'confirmed'`)
          .get(n.id);
        if (needsPerson && !confirmed)
          missing.push(msg(`need_${n.id}_match`, `Bestätigter Match für «${n.goal}»`, `Confirmed match for “${n.goal}”`));
      }
      break;
    case 'agreement':
      for (const n of needs) {
        const a = db.prepare('SELECT review_date FROM agreements WHERE need_id = ?').get(n.id);
        if (!a) missing.push(msg(`need_${n.id}_agreement`, `Vereinbarung mit Review-Termin für «${n.goal}»`, `Agreement with review date for “${n.goal}”`));
      }
      break;
    case 'implementation': {
      // Fortschritt muss im aktuellen Umsetzungszyklus dokumentiert sein.
      const since =
        db
          .prepare(
            `SELECT MAX(created_at) AS t FROM case_events
             WHERE case_id = ? AND type = 'step' AND step = 'implementation'`
          )
          .get(c.id)?.t || c.created_at;
      const progress = db
        .prepare(`SELECT 1 FROM case_events WHERE case_id = ? AND type = 'progress' AND created_at >= ?`)
        .get(c.id, since);
      if (!progress)
        missing.push(msg('progress', 'Mindestens ein dokumentierter Fortschritt', 'At least one documented progress note'));
      break;
    }
    case 'reassessment':
      for (const n of needs) {
        const r = db.prepare('SELECT 1 FROM reviews WHERE need_id = ?').get(n.id);
        if (!r) missing.push(msg(`need_${n.id}_review`, `Re-Assessment für «${n.goal}»`, `Re-assessment for “${n.goal}”`));
      }
      break;
    default:
      break;
  }
  return { next, missing, canAdvance: !!next && missing.length === 0 };
}

export function logEvent(caseId, userId, type, step, body = null) {
  db.prepare('INSERT INTO case_events (case_id, user_id, type, step, body) VALUES (?, ?, ?, ?, ?)').run(
    caseId, userId, type, step, body
  );
}

export function setStep(caseId, step, userId, note = null) {
  db.prepare(`UPDATE cases SET step = ?, updated_at = datetime('now') WHERE id = ?`).run(step, caseId);
  logEvent(caseId, userId, 'step', step, note);
}
