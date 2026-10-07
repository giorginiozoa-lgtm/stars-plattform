// KPI-Dashboard fuer stars (Administration sowie Konten mit dem Zusatzrecht
// «KPI-Dashboard», z.B. Projektpartner – nur lesend): Kennzahlen eines Zeitraums,
// Vergleich mit dem Vorzeitraum und Zeitreihen je Monat. Grundlage fuer die
// grafische Auswertung und den Excel-Export im Frontend.
import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../auth.js';

const router = Router();
router.use(authRequired, (req, res, next) => {
  if (req.user.role === 'admin') return next();
  const u = db.prepare('SELECT can_view_analytics FROM users WHERE id = ?').get(req.user.id);
  if (u?.can_view_analytics) return next();
  return res.status(403).json({ error: 'Keine Berechtigung' });
});

const one = (sql, ...p) => db.prepare(sql).get(...p)?.n ?? 0;

// Monatsliste 'YYYY-MM' der letzten n Monate (inkl. aktuellem Monat).
function monthList(n) {
  const out = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(x.toISOString().slice(0, 7));
  }
  return out;
}

function perMonth(sql, months, ...p) {
  const rows = db.prepare(sql).all(...p);
  const map = new Map(rows.map((r) => [r.month, r.n]));
  return months.map((m) => map.get(m) ?? 0);
}

// Kennzahlen eines Zeitfensters [from, to) (Datumsstrings 'YYYY-MM-DD HH:MM:SS').
function periodKpis(from, to) {
  const w = 'created_at >= ? AND created_at < ?';
  const active = one(
    `SELECT COUNT(DISTINCT uid) n FROM (
       SELECT author_id uid FROM threads WHERE ${w}
       UNION SELECT author_id FROM comments WHERE ${w}
       UNION SELECT author_id FROM community_posts WHERE ${w}
       UNION SELECT sender_id FROM messages WHERE ${w}
       UNION SELECT user_id FROM learning_progress WHERE updated_at >= ? AND updated_at < ?
       UNION SELECT user_id FROM feedback WHERE ${w})`,
    from, to, from, to, from, to, from, to, from, to, from, to
  );
  const ttm = db
    .prepare(
      `SELECT AVG(julianday(confirmed_at) - julianday(created_at)) d FROM case_matches
       WHERE status = 'confirmed' AND confirmed_at >= ? AND confirmed_at < ?`
    )
    .get(from, to)?.d;
  const rating = db.prepare(`SELECT AVG(rating) r FROM feedback WHERE rating IS NOT NULL AND ${w}`).get(from, to)?.r;
  return {
    new_users: one(`SELECT COUNT(*) n FROM users WHERE role != 'admin' AND ${w}`, from, to),
    active_users: active,
    posts: one(`SELECT (SELECT COUNT(*) FROM threads WHERE ${w}) + (SELECT COUNT(*) FROM community_posts WHERE ${w}) n`, from, to, from, to),
    comments: one(`SELECT COUNT(*) n FROM comments WHERE ${w}`, from, to),
    messages: one(`SELECT COUNT(*) n FROM messages WHERE ${w}`, from, to),
    matches_confirmed: one(`SELECT COUNT(*) n FROM case_matches WHERE status = 'confirmed' AND confirmed_at >= ? AND confirmed_at < ?`, from, to),
    intros_made: one(`SELECT COUNT(*) n FROM intro_requests WHERE status = 'accepted' AND updated_at >= ? AND updated_at < ?`, from, to),
    goals_achieved: one(`SELECT COUNT(*) n FROM reviews WHERE progress = 'achieved' AND ${w}`, from, to),
    modules_completed: one(`SELECT COUNT(*) n FROM learning_progress WHERE completed = 1 AND updated_at >= ? AND updated_at < ?`, from, to),
    sessions_held: one(`SELECT COUNT(*) n FROM community_sessions WHERE starts_at >= substr(?,1,16) AND starts_at < substr(?,1,16)`, from, to),
    feedback: one(`SELECT COUNT(*) n FROM feedback WHERE ${w}`, from, to),
    avg_days_to_match: ttm == null ? null : Math.round(ttm * 10) / 10,
    avg_rating: rating == null ? null : Math.round(rating * 10) / 10,
  };
}

router.get('/', (req, res) => {
  const months = Math.min(36, Math.max(1, Number(req.query.months) || 12));
  const list = monthList(months);
  const from = `${list[0]}-01 00:00:00`;
  const to = db.prepare(`SELECT datetime('now', '+1 second') t`).get().t;
  const prevFrom = db.prepare(`SELECT datetime(?, ?) t`).get(from, `-${months} months`).t;

  const ym = (col) => `substr(${col},1,7)`;
  const series = {
    registrations_entrepreneurs: perMonth(`SELECT ${ym('created_at')} month, COUNT(*) n FROM users WHERE role = 'entrepreneur' GROUP BY month`, list),
    registrations_mentors: perMonth(`SELECT ${ym('created_at')} month, COUNT(*) n FROM users WHERE role = 'mentor' GROUP BY month`, list),
    posts: perMonth(
      `SELECT month, SUM(n) n FROM (
         SELECT ${ym('created_at')} month, COUNT(*) n FROM threads GROUP BY month
         UNION ALL SELECT ${ym('created_at')}, COUNT(*) FROM community_posts GROUP BY 1)
       GROUP BY month`, list),
    comments: perMonth(`SELECT ${ym('created_at')} month, COUNT(*) n FROM comments GROUP BY month`, list),
    messages: perMonth(`SELECT ${ym('created_at')} month, COUNT(*) n FROM messages GROUP BY month`, list),
  };

  const totals = {
    users: one(`SELECT COUNT(*) n FROM users WHERE role != 'admin' AND status = 'active'`),
    entrepreneurs: one(`SELECT COUNT(*) n FROM users WHERE role = 'entrepreneur' AND status = 'active'`),
    mentors: one(`SELECT COUNT(*) n FROM users WHERE role = 'mentor' AND status = 'active'`),
    peer_experts: one(`SELECT COUNT(*) n FROM users WHERE offers_peer_support = 1 AND status = 'active'`),
    pending_registrations: one(`SELECT COUNT(*) n FROM users WHERE status = 'pending'`),
    countries: one(`SELECT COUNT(DISTINCT country) n FROM users WHERE role != 'admin' AND country IS NOT NULL AND country != ''`),
    communities: one(`SELECT COUNT(*) n FROM communities`),
    cases_active: one(`SELECT COUNT(*) n FROM cases WHERE step != 'closed'`),
  };

  const STEPS = ['intake', 'assessment', 'prioritization', 'support_plan', 'matching', 'agreement', 'implementation', 'reassessment', 'closed'];
  const stepCounts = new Map(db.prepare(`SELECT step, COUNT(*) n FROM cases GROUP BY step`).all().map((r) => [r.step, r.n]));

  res.json({
    months: list,
    period: { from, to, prevFrom },
    kpis: periodKpis(from, to),
    prev: periodKpis(prevFrom, from),
    totals,
    series,
    journey: STEPS.map((s) => ({ step: s, n: stepCounts.get(s) ?? 0 })),
    needs: db.prepare(`SELECT status AS key, COUNT(*) n FROM needs WHERE priority_rank IS NOT NULL GROUP BY status ORDER BY n DESC, key`).all(),
    intros: db.prepare(`SELECT status AS key, COUNT(*) n FROM intro_requests GROUP BY status ORDER BY n DESC, key`).all(),
    feedback: db.prepare(`SELECT category AS key, COUNT(*) n, ROUND(AVG(rating), 1) avg_rating FROM feedback GROUP BY category ORDER BY n DESC, key`).all(),
    countries: db
      .prepare(`SELECT country AS key, COUNT(*) n FROM users WHERE role != 'admin' AND status = 'active' AND country IS NOT NULL AND country != '' GROUP BY country ORDER BY n DESC, country LIMIT 12`)
      .all(),
    communities: db
      .prepare(
        `SELECT c.name_de, c.name_en, (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id) members,
           (SELECT COUNT(*) FROM community_posts p WHERE p.community_id = c.id) posts
         FROM communities c ORDER BY members DESC`
      )
      .all(),
    modules: db
      .prepare(
        `SELECT m.title_de, m.title_en,
           (SELECT COUNT(*) FROM learning_progress p WHERE p.module_id = m.id) started,
           (SELECT COUNT(*) FROM learning_progress p WHERE p.module_id = m.id AND p.completed = 1) completed
         FROM learning_modules m ORDER BY started DESC, m.id`
      )
      .all(),
  });
});

export default router;
