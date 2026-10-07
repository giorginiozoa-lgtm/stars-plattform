// Iteration 2 – Support Journey (FA-14 bis FA-19, FA-21, FA-22).
// Bildet die Programmlogik des BCP 2026 ab: Aufnahme -> Assessment ->
// Priorisierung -> Supportplan -> Matching -> Vereinbarung -> Umsetzung ->
// Re-Assessment -> neuer Zyklus oder Abschluss. stars (Rolle admin) fuehrt den
// Prozess; der EEM entscheidet ueber Ziele, Supportplan und Match mit.
import { Router } from 'express';
import { db, orderPair, withTx } from '../db.js';
import { authRequired, requireRole } from '../auth.js';
import { notify, publicUser } from '../helpers.js';
import { rankSupporters } from '../matching.js';
import {
  STEPS, FORMATS, ROLES, profileOf, prioritizedNeeds, handoverCheck, logEvent, setStep,
} from '../journey.js';

const router = Router();
router.use(authRequired);

const isAdmin = (req) => req.user.role === 'admin';

function loadCase(id) {
  return db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
}

// Zugriffsrolle der anfragenden Person auf einen Fall.
function accessOf(req, c) {
  if (!c) return null;
  if (isAdmin(req)) return 'admin';
  if (c.eem_id === req.user.id) return 'eem';
  const m = db
    .prepare(
      `SELECT cm.status FROM case_matches cm JOIN needs n ON n.id = cm.need_id
       WHERE n.case_id = ? AND cm.supporter_id = ? AND cm.status != 'declined'`
    )
    .all(c.id, req.user.id);
  if (m.length) return m.some((x) => x.status === 'confirmed') ? 'supporter' : 'invited';
  return null;
}

function caseFor(req, res, { roles = ['admin', 'eem', 'supporter', 'invited'] } = {}) {
  const c = loadCase(req.params.id);
  if (!c) {
    res.status(404).json({ error: 'Fall nicht gefunden' });
    return null;
  }
  const access = accessOf(req, c);
  if (!access || !roles.includes(access)) {
    res.status(403).json({ error: 'Keine Berechtigung für diesen Fall' });
    return null;
  }
  return { c, access };
}

function needFor(req, res, roles) {
  const n = db.prepare('SELECT * FROM needs WHERE id = ?').get(req.params.needId);
  if (!n) {
    res.status(404).json({ error: 'Bedarf nicht gefunden' });
    return null;
  }
  const c = loadCase(n.case_id);
  const access = accessOf(req, c);
  if (!access || !roles.includes(access)) {
    res.status(403).json({ error: 'Keine Berechtigung' });
    return null;
  }
  return { n, c, access };
}

function needTags(needId) {
  return db
    .prepare(
      `SELECT t.id, t.slug, t.name_de, t.name_en, t.category FROM need_tags nt
       JOIN tags t ON t.id = nt.tag_id WHERE nt.need_id = ?`
    )
    .all(needId);
}

function setNeedTags(needId, tagIds) {
  if (!Array.isArray(tagIds)) return;
  const ins = db.prepare('INSERT INTO need_tags (need_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING');
  withTx(() => {
    db.prepare('DELETE FROM need_tags WHERE need_id = ?').run(needId);
    for (const id of tagIds) ins.run(needId, Number(id));
  });
}

function admins() {
  return db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all().map((a) => a.id);
}

// Vollstaendige Fallansicht. Eingeladene Unterstuetzer:innen sehen nur den
// Matching Brief ihres Bedarfs, nicht das ganze EEM-Profil (Datensparsamkeit).
function caseDetail(c, access, viewerId) {
  const eem = publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(c.eem_id));
  const coordinator = c.coordinator_id
    ? publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(c.coordinator_id))
    : null;
  let needs = db.prepare('SELECT * FROM needs WHERE case_id = ? ORDER BY cycle DESC, COALESCE(priority_rank, 9), id').all(c.id);

  const matchStmt = db.prepare(
    `SELECT cm.*, u.name AS supporter_name, u.headline AS supporter_headline,
            u.avatar_seed AS supporter_avatar, u.country AS supporter_country
     FROM case_matches cm JOIN users u ON u.id = cm.supporter_id WHERE cm.need_id = ? ORDER BY cm.created_at`
  );
  needs = needs.map((n) => ({
    ...n,
    tags: needTags(n.id),
    plan: db.prepare('SELECT * FROM plan_items WHERE need_id = ? ORDER BY sort_order, id').all(n.id),
    brief: db.prepare('SELECT * FROM matching_briefs WHERE need_id = ?').get(n.id) || null,
    matches: matchStmt.all(n.id),
    agreement: db.prepare('SELECT * FROM agreements WHERE need_id = ?').get(n.id) || null,
    reviews: db.prepare('SELECT * FROM reviews WHERE need_id = ? ORDER BY created_at DESC').all(n.id),
  }));

  if (access === 'invited') {
    needs = needs.filter((n) => n.matches.some((m) => m.supporter_id === viewerId));
  }

  const events = access === 'invited'
    ? []
    : db
        .prepare(
          `SELECT e.*, u.name AS user_name FROM case_events e LEFT JOIN users u ON u.id = e.user_id
           WHERE e.case_id = ? ORDER BY e.created_at DESC, e.id DESC`
        )
        .all(c.id);

  return {
    case: c,
    access,
    eem,
    coordinator,
    profile: access === 'invited' ? null : profileOf(c.eem_id),
    needs,
    events,
    handover: handoverCheck(c),
    steps: STEPS,
  };
}

// ---------------------------------------------------------------------------
// EEM-Profil (FA-14): vier Online-Frageboegen Context/Ecosystem/Venture/Entrepreneur
// ---------------------------------------------------------------------------
router.get('/profile/:userId?', (req, res) => {
  const uid = req.params.userId ? Number(req.params.userId) : req.user.id;
  if (uid !== req.user.id && !isAdmin(req)) return res.status(403).json({ error: 'Keine Berechtigung' });
  res.json({ profile: profileOf(uid) });
});

router.put('/profile/:userId?', (req, res) => {
  const uid = req.params.userId ? Number(req.params.userId) : req.user.id;
  if (uid !== req.user.id && !isAdmin(req)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const { case_type, context, ecosystem, venture, entrepreneur, validated } = req.body || {};
  const obj = (v) => JSON.stringify(v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const current = profileOf(uid);
  db.prepare(
    `INSERT INTO eem_profiles (user_id, case_type, context, ecosystem, venture, entrepreneur, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       case_type = excluded.case_type, context = excluded.context, ecosystem = excluded.ecosystem,
       venture = excluded.venture, entrepreneur = excluded.entrepreneur, updated_at = excluded.updated_at`
  ).run(
    uid,
    ['venture_scaler', 'ecosystem_builder'].includes(case_type) ? case_type : current?.case_type ?? null,
    obj(context ?? current?.context),
    obj(ecosystem ?? current?.ecosystem),
    obj(venture ?? current?.venture),
    obj(entrepreneur ?? current?.entrepreneur)
  );
  // Validierung im Vertiefungsinterview ist Aufgabe der Programmkoordination.
  if (isAdmin(req) && validated !== undefined) {
    db.prepare(`UPDATE eem_profiles SET validated_at = ${validated ? "datetime('now')" : 'NULL'} WHERE user_id = ?`).run(uid);
  }
  res.json({ profile: profileOf(uid) });
});

// ---------------------------------------------------------------------------
// Faelle
// ---------------------------------------------------------------------------
router.get('/cases', (req, res) => {
  let rows;
  if (isAdmin(req)) {
    rows = db.prepare('SELECT * FROM cases ORDER BY updated_at DESC').all();
  } else if (req.user.role === 'mentor') {
    rows = db
      .prepare(
        `SELECT DISTINCT c.* FROM cases c JOIN needs n ON n.case_id = c.id
         JOIN case_matches cm ON cm.need_id = n.id
         WHERE cm.supporter_id = ? AND cm.status != 'declined' ORDER BY c.updated_at DESC`
      )
      .all(req.user.id);
  } else {
    rows = db.prepare('SELECT * FROM cases WHERE eem_id = ? ORDER BY created_at DESC').all(req.user.id);
  }
  const userStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const cases = rows.map((c) => {
    const needs = prioritizedNeeds(c.id, c.cycle);
    const nextReview = db
      .prepare(
        `SELECT MIN(a.review_date) d FROM agreements a JOIN needs n ON n.id = a.need_id
         WHERE n.case_id = ? AND n.cycle = ?`
      )
      .get(c.id, c.cycle).d;
    return {
      ...c,
      eem: publicUser(userStmt.get(c.eem_id)),
      case_type: profileOf(c.eem_id)?.case_type ?? null,
      prioritized: needs.map((n) => ({ id: n.id, goal: n.goal, status: n.status })),
      next_review: nextReview,
      handover: handoverCheck(c),
      my_invitations: req.user.role === 'mentor'
        ? db
            .prepare(
              `SELECT cm.id, cm.status, cm.supporter_ok, cm.role, n.goal FROM case_matches cm
               JOIN needs n ON n.id = cm.need_id WHERE n.case_id = ? AND cm.supporter_id = ?`
            )
            .all(c.id, req.user.id)
        : undefined,
    };
  });
  res.json({ cases });
});

// Aufnahme beantragen (EEM). Ein offener Fall je EEM.
router.post('/cases', requireRole('entrepreneur'), (req, res) => {
  const open = db.prepare(`SELECT id FROM cases WHERE eem_id = ? AND step != 'closed'`).get(req.user.id);
  if (open) return res.status(409).json({ error: 'Es existiert bereits ein offener Fall', caseId: open.id });
  const { motivation } = req.body || {};
  if (!motivation) return res.status(400).json({ error: 'motivation erforderlich' });
  const info = db.prepare('INSERT INTO cases (eem_id, motivation) VALUES (?, ?)').run(req.user.id, motivation);
  const id = Number(info.lastInsertRowid);
  logEvent(id, req.user.id, 'step', 'intake', motivation);
  for (const a of admins()) {
    notify(a, {
      type: 'system',
      title: 'Neuer Aufnahmeantrag',
      body: `${req.user.name} möchte in die Support Journey aufgenommen werden.`,
      link: `/journey/${id}`,
    });
  }
  res.status(201).json({ case: loadCase(id) });
});

router.get('/cases/:id', (req, res) => {
  const r = caseFor(req, res);
  if (!r) return;
  res.json(caseDetail(r.c, r.access, req.user.id));
});

// Aufnahmeentscheid (stars). Verbindlicher Output: Entscheid + geklaerte Erwartungen.
router.post('/cases/:id/intake', requireRole('admin'), (req, res) => {
  const r = caseFor(req, res, { roles: ['admin'] });
  if (!r) return;
  const { decision, expectations } = req.body || {};
  if (!['accepted', 'declined'].includes(decision)) return res.status(400).json({ error: 'decision ungültig' });
  if (decision === 'accepted' && !expectations)
    return res.status(400).json({ error: 'Erwartungen (Umfang, Dauer, Mitwirkung) müssen festgehalten werden' });
  db.prepare(
    `UPDATE cases SET intake_decision = ?, expectations = ?, coordinator_id = ? WHERE id = ?`
  ).run(decision, expectations || null, req.user.id, r.c.id);
  if (decision === 'accepted') {
    setStep(r.c.id, 'assessment', req.user.id, expectations);
  } else {
    db.prepare(`UPDATE cases SET closed_reason = 'declined', closing_note = ? WHERE id = ?`).run(expectations || null, r.c.id);
    setStep(r.c.id, 'closed', req.user.id, 'Aufnahme abgelehnt');
  }
  notify(r.c.eem_id, {
    type: 'system',
    title: decision === 'accepted' ? 'Du wurdest in die Support Journey aufgenommen' : 'Aufnahmeentscheid',
    body: decision === 'accepted' ? 'Nächster Schritt: Profil in vier kurzen Fragebögen ausfüllen.' : 'Dein Antrag wurde aktuell nicht angenommen.',
    link: decision === 'accepted' ? '/journey/profile' : `/journey/${r.c.id}`,
  });
  res.json(caseDetail(loadCase(r.c.id), 'admin', req.user.id));
});

// Naechster Schritt – nur wenn die verbindliche Uebergabe vollstaendig ist.
router.post('/cases/:id/advance', requireRole('admin'), (req, res) => {
  const r = caseFor(req, res, { roles: ['admin'] });
  if (!r) return;
  const check = handoverCheck(r.c);
  if (!check.canAdvance) return res.status(409).json({ error: 'Übergabe unvollständig', missing: check.missing });
  setStep(r.c.id, check.next, req.user.id, req.body?.note || null);
  notify(r.c.eem_id, {
    type: 'system',
    title: 'Deine Support Journey geht weiter',
    body: `Neuer Schritt: ${check.next}`,
    link: `/journey/${r.c.id}`,
  });
  res.json(caseDetail(loadCase(r.c.id), 'admin', req.user.id));
});

// Nach dem Re-Assessment: neuer Zyklus (zurueck zur Priorisierung) ...
router.post('/cases/:id/new-cycle', requireRole('admin'), (req, res) => {
  const r = caseFor(req, res, { roles: ['admin'] });
  if (!r) return;
  if (r.c.step !== 'reassessment') return res.status(409).json({ error: 'Nur nach dem Re-Assessment möglich' });
  const check = handoverCheck(r.c);
  if (check.missing.length) return res.status(409).json({ error: 'Re-Assessment unvollständig', missing: check.missing });
  db.prepare(`UPDATE cases SET cycle = cycle + 1, plan_consent_at = NULL WHERE id = ?`).run(r.c.id);
  // Nicht erreichte, nicht verworfene Bedarfe werden in den neuen Zyklus uebernommen
  // (ohne Priorisierung – diese wird gemeinsam neu vorgenommen).
  db.prepare(
    `UPDATE needs SET cycle = ?, priority_rank = NULL WHERE case_id = ? AND status = 'open' AND cycle = ?`
  ).run(r.c.cycle + 1, r.c.id, r.c.cycle);
  setStep(r.c.id, 'prioritization', req.user.id, req.body?.note || 'Neuer Unterstützungszyklus');
  res.json(caseDetail(loadCase(r.c.id), 'admin', req.user.id));
});

// ... oder Abschluss (Ziel erreicht, Wunsch des EEM, kein weiterer Bedarf).
router.post('/cases/:id/close', requireRole('admin'), (req, res) => {
  const r = caseFor(req, res, { roles: ['admin'] });
  if (!r) return;
  const { reason, note } = req.body || {};
  if (!['goal_achieved', 'eem_request', 'no_further_need'].includes(reason))
    return res.status(400).json({ error: 'reason ungültig' });
  if (!note) return res.status(400).json({ error: 'Abschlussdokumentation erforderlich' });
  db.prepare('UPDATE cases SET closed_reason = ?, closing_note = ? WHERE id = ?').run(reason, note, r.c.id);
  setStep(r.c.id, 'closed', req.user.id, note);
  notify(r.c.eem_id, { type: 'system', title: 'Deine Support Journey wurde abgeschlossen', body: note, link: `/journey/${r.c.id}` });
  res.json(caseDetail(loadCase(r.c.id), 'admin', req.user.id));
});

// Zustimmung des EEM zum Supportplan.
router.post('/cases/:id/plan-consent', (req, res) => {
  const r = caseFor(req, res, { roles: ['eem'] });
  if (!r) return;
  if (r.c.step !== 'support_plan') return res.status(409).json({ error: 'Supportplan ist noch nicht zur Zustimmung bereit' });
  db.prepare(`UPDATE cases SET plan_consent_at = datetime('now') WHERE id = ?`).run(r.c.id);
  logEvent(r.c.id, req.user.id, 'note', r.c.step, 'Supportplan durch EEM bestätigt');
  if (r.c.coordinator_id) notify(r.c.coordinator_id, { type: 'system', title: 'Supportplan bestätigt', body: req.user.name, link: `/journey/${r.c.id}` });
  res.json(caseDetail(loadCase(r.c.id), r.access, req.user.id));
});

// Fortschrittsnotiz / Notiz (EEM, Unterstuetzer:innen, stars).
router.post('/cases/:id/events', (req, res) => {
  const r = caseFor(req, res, { roles: ['admin', 'eem', 'supporter'] });
  if (!r) return;
  const { body, type } = req.body || {};
  if (!body) return res.status(400).json({ error: 'body erforderlich' });
  logEvent(r.c.id, req.user.id, type === 'progress' ? 'progress' : 'note', r.c.step, body);
  res.status(201).json(caseDetail(loadCase(r.c.id), r.access, req.user.id));
});

// ---------------------------------------------------------------------------
// Bedarfe (FA-15): Bedarfsformel und gemeinsame Priorisierung
// ---------------------------------------------------------------------------
const RATINGS = ['relevance', 'urgency', 'impact', 'stars_contribution', 'feasibility'];
const clampRating = (v) => (v === null || v === undefined || v === '' ? null : Math.min(3, Math.max(1, Number(v))));

router.post('/cases/:id/needs', (req, res) => {
  const r = caseFor(req, res, { roles: ['admin', 'eem'] });
  if (!r) return;
  if (r.c.step === 'closed') return res.status(409).json({ error: 'Fall ist abgeschlossen' });
  const { goal, bottleneck, support_needed, success_criterion, tagIds } = req.body || {};
  if (!goal) return res.status(400).json({ error: 'goal erforderlich' });
  const info = db
    .prepare(
      `INSERT INTO needs (case_id, goal, bottleneck, support_needed, success_criterion, cycle, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(r.c.id, goal, bottleneck || null, support_needed || null, success_criterion || null, r.c.cycle, req.user.id);
  setNeedTags(Number(info.lastInsertRowid), tagIds);
  res.status(201).json(caseDetail(loadCase(r.c.id), r.access, req.user.id));
});

router.patch('/needs/:needId', (req, res) => {
  const r = needFor(req, res, ['admin', 'eem']);
  if (!r) return;
  const b = req.body || {};
  const fields = {};
  for (const f of ['goal', 'bottleneck', 'support_needed', 'success_criterion']) if (b[f] !== undefined) fields[f] = b[f] || null;
  for (const f of RATINGS) if (b[f] !== undefined) fields[f] = clampRating(b[f]);
  if (b.status !== undefined && ['open', 'achieved', 'dropped'].includes(b.status)) fields.status = b.status;

  if (b.priority_rank !== undefined) {
    const rank = b.priority_rank === null || b.priority_rank === '' ? null : Number(b.priority_rank);
    if (rank !== null) {
      if (![1, 2, 3].includes(rank)) return res.status(400).json({ error: 'priority_rank muss 1–3 sein' });
      // Rang ist je Zyklus eindeutig: ein bereits vergebener Rang wird freigegeben.
      db.prepare('UPDATE needs SET priority_rank = NULL WHERE case_id = ? AND cycle = ? AND priority_rank = ? AND id != ?')
        .run(r.n.case_id, r.n.cycle, rank, r.n.id);
    }
    fields.priority_rank = rank;
  }
  const keys = Object.keys(fields);
  if (keys.length) {
    db.prepare(`UPDATE needs SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(
      ...keys.map((k) => fields[k]),
      r.n.id
    );
  }
  if (b.tagIds !== undefined) setNeedTags(r.n.id, b.tagIds);
  res.json(caseDetail(loadCase(r.c.id), r.access, req.user.id));
});

// ---------------------------------------------------------------------------
// Supportplan (FA-18) und Matching Brief (FA-16) – Aufgabe von stars
// ---------------------------------------------------------------------------
router.put('/needs/:needId/plan', requireRole('admin'), (req, res) => {
  const r = needFor(req, res, ['admin']);
  if (!r) return;
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items) return res.status(400).json({ error: 'items-Array erwartet' });
  if (items.some((i) => !FORMATS.includes(i.format))) return res.status(400).json({ error: 'Unbekanntes Format' });
  const ins = db.prepare('INSERT INTO plan_items (need_id, format, note, sort_order) VALUES (?, ?, ?, ?)');
  withTx(() => {
    db.prepare('DELETE FROM plan_items WHERE need_id = ?').run(r.n.id);
    items.forEach((i, idx) => ins.run(r.n.id, i.format, i.note || null, idx));
  });
  // Eine Planaenderung erfordert eine erneute Zustimmung des EEM.
  db.prepare('UPDATE cases SET plan_consent_at = NULL WHERE id = ?').run(r.c.id);
  res.json(caseDetail(loadCase(r.c.id), 'admin', req.user.id));
});

router.put('/needs/:needId/brief', requireRole('admin'), (req, res) => {
  const r = needFor(req, res, ['admin']);
  if (!r) return;
  const b = req.body || {};
  if (!ROLES.includes(b.main_role)) return res.status(400).json({ error: 'main_role ungültig' });
  db.prepare(
    `INSERT INTO matching_briefs (need_id, main_role, experience, context_ref, network_access, language, duration, working_mode, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(need_id) DO UPDATE SET main_role = excluded.main_role, experience = excluded.experience,
       context_ref = excluded.context_ref, network_access = excluded.network_access, language = excluded.language,
       duration = excluded.duration, working_mode = excluded.working_mode, updated_at = excluded.updated_at`
  ).run(
    r.n.id, b.main_role, b.experience || null, b.context_ref || null, b.network_access || null,
    b.language || null, b.duration || null, b.working_mode || null
  );
  if (b.tagIds !== undefined) setNeedTags(r.n.id, b.tagIds);
  res.json(caseDetail(loadCase(r.c.id), 'admin', req.user.id));
});

// ---------------------------------------------------------------------------
// Moderiertes Matching (FA-17, FA-22)
// ---------------------------------------------------------------------------
router.get('/needs/:needId/candidates', requireRole('admin'), (req, res) => {
  const r = needFor(req, res, ['admin']);
  if (!r) return;
  const existing = new Map(
    db.prepare('SELECT supporter_id, status FROM case_matches WHERE need_id = ?').all(r.n.id).map((m) => [m.supporter_id, m.status])
  );
  const candidates = rankSupporters(r.n.id, 6).map((c) => ({ ...c, status: existing.get(c.supporter.id) || null }));
  res.json({ candidates });
});

// stars laedt eine vorgeschlagene Person ein (Freigabe durch die Programmkoordination).
router.post('/needs/:needId/invite', requireRole('admin'), (req, res) => {
  const r = needFor(req, res, ['admin']);
  if (!r) return;
  const supporterId = Number(req.body?.supporterId);
  const role = req.body?.role;
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'role ungültig' });
  const sup = db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'mentor'`).get(supporterId);
  if (!sup) return res.status(404).json({ error: 'Unterstützer:in nicht gefunden' });
  const ranked = rankSupporters(r.n.id, 50).find((x) => x.supporter.id === supporterId);
  db.prepare(
    `INSERT INTO case_matches (need_id, supporter_id, role, score, invited_by) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(need_id, supporter_id) DO UPDATE SET status = 'invited', role = excluded.role,
       supporter_ok = 0, eem_ok = 0, score = excluded.score, invited_by = excluded.invited_by`
  ).run(r.n.id, supporterId, role, ranked?.score ?? null, req.user.id);
  logEvent(r.c.id, req.user.id, 'match', r.c.step, `Einladung an Unterstützer:in #${supporterId} (${role})`);
  notify(supporterId, {
    type: 'match',
    title: 'Anfrage von stars: Unterstützung gesucht',
    body: `Bedarf: «${r.n.goal}». Bitte Matching Brief prüfen und zu- oder absagen.`,
    link: `/journey/${r.c.id}`,
  });
  res.json(caseDetail(loadCase(r.c.id), 'admin', req.user.id));
});

// Antwort der eingeladenen Person bzw. Bestaetigung des EEM.
router.post('/matches/:matchId/respond', (req, res) => {
  const m = db.prepare('SELECT * FROM case_matches WHERE id = ?').get(req.params.matchId);
  if (!m) return res.status(404).json({ error: 'Match nicht gefunden' });
  const n = db.prepare('SELECT * FROM needs WHERE id = ?').get(m.need_id);
  const c = loadCase(n.case_id);
  const accept = !!req.body?.accept;
  let side;
  if (m.supporter_id === req.user.id) side = 'supporter';
  else if (c.eem_id === req.user.id) side = 'eem';
  else return res.status(403).json({ error: 'Keine Berechtigung' });
  if (m.status !== 'invited') return res.status(409).json({ error: 'Match ist nicht mehr offen' });
  if (side === 'eem' && !m.supporter_ok)
    return res.status(409).json({ error: 'Zuerst muss die Unterstützer:in zusagen' });

  if (!accept) {
    db.prepare(`UPDATE case_matches SET status = 'declined' WHERE id = ?`).run(m.id);
    logEvent(c.id, req.user.id, 'match', c.step, `Match abgelehnt (${side}): ${req.body?.note || ''}`.trim());
    for (const a of c.coordinator_id ? [c.coordinator_id] : admins()) {
      notify(a, { type: 'match', title: 'Match abgelehnt – alternative Lösung suchen', body: n.goal, link: `/journey/${c.id}` });
    }
    return res.json({ status: 'declined' });
  }

  db.prepare(`UPDATE case_matches SET ${side === 'supporter' ? 'supporter_ok' : 'eem_ok'} = 1 WHERE id = ?`).run(m.id);
  const updated = db.prepare('SELECT * FROM case_matches WHERE id = ?').get(m.id);
  let conversationId = null;
  if (updated.supporter_ok && updated.eem_ok) {
    db.prepare(`UPDATE case_matches SET status = 'confirmed', confirmed_at = datetime('now') WHERE id = ?`).run(m.id);
    const [low, high] = orderPair(c.eem_id, m.supporter_id);
    db.prepare('INSERT INTO conversations (user_low, user_high) VALUES (?, ?) ON CONFLICT DO NOTHING').run(low, high);
    conversationId = db.prepare('SELECT id FROM conversations WHERE user_low = ? AND user_high = ?').get(low, high).id;
    logEvent(c.id, req.user.id, 'match', c.step, `Match bestätigt: Unterstützer:in #${m.supporter_id} für «${n.goal}»`);
    for (const uid of [m.supporter_id, c.eem_id, ...(c.coordinator_id ? [c.coordinator_id] : [])]) {
      notify(uid, { type: 'match', title: 'Match bestätigt', body: `«${n.goal}» – nächster Schritt: Vereinbarung`, link: `/journey/${c.id}` });
    }
  } else if (side === 'supporter') {
    notify(c.eem_id, {
      type: 'match',
      title: 'Eine Unterstützer:in hat zugesagt',
      body: `Bitte bestätige den Match für «${n.goal}».`,
      link: `/journey/${c.id}`,
    });
  }
  res.json({ status: updated.supporter_ok && updated.eem_ok ? 'confirmed' : 'invited', conversationId });
});

// ---------------------------------------------------------------------------
// Vereinbarung und Re-Assessment (FA-19, FA-21)
// ---------------------------------------------------------------------------
router.put('/needs/:needId/agreement', (req, res) => {
  const r = needFor(req, res, ['admin', 'eem', 'supporter']);
  if (!r) return;
  const { goal, roles, next_steps, review_date } = req.body || {};
  if (!goal || !review_date || !/^\d{4}-\d{2}-\d{2}$/.test(review_date))
    return res.status(400).json({ error: 'goal und review_date (YYYY-MM-DD) erforderlich' });
  db.prepare(
    `INSERT INTO agreements (need_id, goal, roles, next_steps, review_date, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(need_id) DO UPDATE SET goal = excluded.goal, roles = excluded.roles,
       next_steps = excluded.next_steps, review_date = excluded.review_date, updated_at = excluded.updated_at`
  ).run(r.n.id, goal, roles || null, next_steps || null, review_date);
  logEvent(r.c.id, req.user.id, 'note', r.c.step, `Vereinbarung für «${r.n.goal}» festgehalten (Review: ${review_date})`);
  res.json(caseDetail(loadCase(r.c.id), r.access, req.user.id));
});

router.post('/needs/:needId/reviews', (req, res) => {
  const r = needFor(req, res, ['admin', 'eem', 'supporter']);
  if (!r) return;
  const { progress, outcome, next_step } = req.body || {};
  if (!['none', 'partial', 'achieved'].includes(progress)) return res.status(400).json({ error: 'progress ungültig' });
  if (!['continue', 'new_goal', 'rematch', 'close'].includes(next_step)) return res.status(400).json({ error: 'next_step ungültig' });
  db.prepare('INSERT INTO reviews (need_id, progress, outcome, next_step, created_by) VALUES (?, ?, ?, ?, ?)').run(
    r.n.id, progress, outcome || null, next_step, req.user.id
  );
  if (progress === 'achieved') db.prepare(`UPDATE needs SET status = 'achieved' WHERE id = ?`).run(r.n.id);
  logEvent(r.c.id, req.user.id, 'note', r.c.step, `Re-Assessment «${r.n.goal}»: ${progress}${outcome ? ` – ${outcome}` : ''}`);
  res.status(201).json(caseDetail(loadCase(r.c.id), r.access, req.user.id));
});

export default router;
