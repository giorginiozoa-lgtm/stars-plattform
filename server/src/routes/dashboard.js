// Kann-Ziel: rollenspezifische Dashboards mit KPIs zu Aktivitaet,
// Mentoring-Fortschritt und Netzwerkentwicklung.
import { Router } from 'express';
import { db } from '../db.js';
import { authRequired } from '../auth.js';
import { STEPS } from '../journey.js';

const router = Router();

const count = (sql, ...args) => db.prepare(sql).get(...args).n;

// Iteration 2 (FA-21): Programm- und Outcome-Kennzahlen statt reiner
// Aktivitaetszahlen – Fallstand, erreichte Ziele, Zeit bis zum Match,
// faellige Reviews (vgl. Eberle et al., 2026a, Kap. 4.3.10 und 6.4).
function programmeStats() {
  const funnel = [...STEPS, 'closed'].map((step) => ({
    step,
    n: count(`SELECT COUNT(*) n FROM cases WHERE step = ?`, step),
  }));
  const reviewMix = Object.fromEntries(
    ['none', 'partial', 'achieved'].map((p) => [p, count(`SELECT COUNT(*) n FROM reviews WHERE progress = ?`, p)])
  );
  const avg = db
    .prepare(
      `SELECT AVG(d) AS d FROM (
         SELECT MIN(julianday(cm.confirmed_at)) - julianday(c.created_at) AS d
         FROM case_matches cm JOIN needs n ON n.id = cm.need_id JOIN cases c ON c.id = n.case_id
         WHERE cm.status = 'confirmed' GROUP BY c.id)`
    )
    .get().d;
  const reviewsDue = db
    .prepare(
      `SELECT a.need_id, a.review_date, n.goal, c.id AS case_id, u.name AS eem_name
       FROM agreements a JOIN needs n ON n.id = a.need_id JOIN cases c ON c.id = n.case_id
       JOIN users u ON u.id = c.eem_id
       WHERE c.step != 'closed' AND a.review_date <= date('now', '+14 days')
         AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.need_id = a.need_id AND r.created_at >= a.updated_at)
       ORDER BY a.review_date`
    )
    .all();
  const outcomes = db
    .prepare(
      `SELECT r.progress, r.outcome, r.created_at, n.goal, c.id AS case_id, u.name AS eem_name
       FROM reviews r JOIN needs n ON n.id = r.need_id JOIN cases c ON c.id = n.case_id
       JOIN users u ON u.id = c.eem_id
       WHERE r.outcome IS NOT NULL ORDER BY r.created_at DESC LIMIT 6`
    )
    .all();
  return {
    kpis: {
      cases_active: count(`SELECT COUNT(*) n FROM cases WHERE step NOT IN ('closed','intake')`),
      intake_pending: count(`SELECT COUNT(*) n FROM cases WHERE step = 'intake' AND intake_decision = 'pending'`),
      needs_prioritized: count(
        `SELECT COUNT(*) n FROM needs n JOIN cases c ON c.id = n.case_id
         WHERE n.priority_rank IS NOT NULL AND n.cycle = c.cycle AND c.step != 'closed'`
      ),
      needs_achieved: count(`SELECT COUNT(*) n FROM needs WHERE status = 'achieved'`),
      matches_confirmed: count(`SELECT COUNT(*) n FROM case_matches WHERE status = 'confirmed'`),
      matches_pending: count(`SELECT COUNT(*) n FROM case_matches WHERE status = 'invited'`),
      avg_days_to_match: avg == null ? 0 : Math.round(avg * 10) / 10,
      communities: count(`SELECT COUNT(*) n FROM communities`),
      community_members: count(`SELECT COUNT(DISTINCT user_id) n FROM community_members`),
      sessions_upcoming: count(
        `SELECT COUNT(*) n FROM community_sessions WHERE starts_at >= strftime('%Y-%m-%d %H:%M','now')`
      ),
    },
    funnel,
    reviewMix,
    reviewsDue,
    outcomes,
  };
}

router.get('/', authRequired, (req, res) => {
  const uid = req.user.id;
  const role = req.user.role;

  if (role === 'admin') {
    // Netzwerkentwicklung: Neuregistrierungen je Monat (fuer Verlaufsdiagramm).
    const growth = db
      .prepare(
        `SELECT substr(created_at,1,7) AS month, COUNT(*) AS n
         FROM users GROUP BY month ORDER BY month`
      )
      .all();
    return res.json({
      role,
      kpis: {
        entrepreneurs: count(`SELECT COUNT(*) n FROM users WHERE role='entrepreneur'`),
        mentors: count(`SELECT COUNT(*) n FROM users WHERE role='mentor'`),
        forums: count(`SELECT COUNT(*) n FROM forums`),
        threads: count(`SELECT COUNT(*) n FROM threads`),
        comments: count(`SELECT COUNT(*) n FROM comments`),
        questions_open: count(`SELECT COUNT(*) n FROM questions WHERE status='open'`),
        questions_matched: count(`SELECT COUNT(*) n FROM questions WHERE status='matched'`),
        questions_resolved: count(`SELECT COUNT(*) n FROM questions WHERE status='resolved'`),
        matches_accepted: count(`SELECT COUNT(*) n FROM matches WHERE status='accepted'`),
        messages: count(`SELECT COUNT(*) n FROM messages`),
        modules: count(`SELECT COUNT(*) n FROM learning_modules`),
        completions: count(`SELECT COUNT(*) n FROM learning_progress WHERE completed=1`),
      },
      growth,
      programme: programmeStats(),
      // Iteration 3: offene Vermittlungs- und Feedback-Aufgaben fuer stars.
      network: {
        intros_open: count(`SELECT COUNT(*) n FROM intro_requests WHERE status = 'requested'`),
        intros_proposed: count(`SELECT COUNT(*) n FROM intro_requests WHERE status = 'proposed'`),
        intros_accepted: count(`SELECT COUNT(*) n FROM intro_requests WHERE status = 'accepted'`),
        scholarship_requests: count(`SELECT COUNT(*) n FROM event_registrations WHERE status = 'requested'`),
        session_requests: count(`SELECT COUNT(*) n FROM session_requests WHERE status = 'pending'`),
        peer_experts: count(`SELECT COUNT(*) n FROM users WHERE offers_peer_support = 1`),
        feedback_new: count(`SELECT COUNT(*) n FROM feedback WHERE status = 'new'`),
      },
    });
  }

  if (role === 'mentor') {
    const topTags = db
      .prepare(
        `SELECT t.name_de, t.name_en, ut.weight FROM user_tags ut
         JOIN tags t ON t.id = ut.tag_id WHERE ut.user_id = ? ORDER BY ut.weight DESC LIMIT 5`
      )
      .all(uid);
    return res.json({
      role,
      kpis: {
        suggested_matches: count(
          `SELECT COUNT(*) n FROM matches WHERE mentor_id = ? AND status='suggested'`, uid
        ),
        active_mentorships: count(
          `SELECT COUNT(*) n FROM matches WHERE mentor_id = ? AND status='accepted'`, uid
        ),
        unread_messages: count(
          `SELECT COUNT(*) n FROM messages m JOIN conversations c ON c.id = m.conversation_id
           WHERE (c.user_low = ? OR c.user_high = ?) AND m.sender_id != ? AND m.read_at IS NULL`,
          uid, uid, uid
        ),
        threads_started: count(`SELECT COUNT(*) n FROM threads WHERE author_id = ?`, uid),
        comments_written: count(`SELECT COUNT(*) n FROM comments WHERE author_id = ?`, uid),
        invitations_open: count(
          `SELECT COUNT(*) n FROM case_matches WHERE supporter_id = ? AND status = 'invited' AND supporter_ok = 0`, uid
        ),
        supports_active: count(
          `SELECT COUNT(*) n FROM case_matches cm JOIN needs n ON n.id = cm.need_id JOIN cases c ON c.id = n.case_id
           WHERE cm.supporter_id = ? AND cm.status = 'confirmed' AND c.step != 'closed'`, uid
        ),
        communities_joined: count(`SELECT COUNT(*) n FROM community_members WHERE user_id = ?`, uid),
      },
      topTags,
    });
  }

  // entrepreneur
  const learning = db
    .prepare(
      `SELECT COUNT(*) AS started,
              SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) AS completed,
              COALESCE(AVG(progress),0) AS avg_progress
       FROM learning_progress WHERE user_id = ?`
    )
    .get(uid);
  const myCase = db
    .prepare(`SELECT * FROM cases WHERE eem_id = ? ORDER BY (step = 'closed'), created_at DESC LIMIT 1`)
    .get(uid);
  const journey = myCase
    ? {
        case_id: myCase.id,
        step: myCase.step,
        needs: db
          .prepare(
            `SELECT n.id, n.goal, n.status, n.priority_rank, a.review_date FROM needs n
             LEFT JOIN agreements a ON a.need_id = n.id
             WHERE n.case_id = ? AND n.cycle = ? AND n.priority_rank IS NOT NULL ORDER BY n.priority_rank`
          )
          .all(myCase.id, myCase.cycle),
      }
    : null;
  return res.json({
    role,
    journey,
    kpis: {
      communities_joined: count(`SELECT COUNT(*) n FROM community_members WHERE user_id = ?`, uid),
      questions_asked: count(`SELECT COUNT(*) n FROM questions WHERE asker_id = ?`, uid),
      questions_resolved: count(
        `SELECT COUNT(*) n FROM questions WHERE asker_id = ? AND status='resolved'`, uid
      ),
      conversations: count(
        `SELECT COUNT(*) n FROM conversations WHERE user_low = ? OR user_high = ?`, uid, uid
      ),
      unread_messages: count(
        `SELECT COUNT(*) n FROM messages m JOIN conversations c ON c.id = m.conversation_id
         WHERE (c.user_low = ? OR c.user_high = ?) AND m.sender_id != ? AND m.read_at IS NULL`,
        uid, uid, uid
      ),
      modules_started: learning.started || 0,
      modules_completed: learning.completed || 0,
      avg_progress: Math.round(learning.avg_progress || 0),
    },
  });
});

export default router;
