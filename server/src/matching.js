// Matching-Logik: regelbasierte Zuordnung einer Frage zu passenden Expert:innen.
// Umsetzung des in Kap. 2.8 (Matching Theory / Market Design) begruendeten
// Kernmechanismus. Bewusst transparent gehalten: Der Score wird aus drei
// nachvollziehbaren Komponenten gebildet und mit einer Begruendung
// (matched-tags) zurueckgegeben, damit Nutzer:innen verstehen, WARUM eine
// Person vorgeschlagen wird (foerdert Vertrauen und Akzeptanz, vgl. TAM).
import { db, withTx } from './db.js';

// Gewichtung der Score-Komponenten (Summe = 1.0). Zentral definiert, damit die
// Regel in der schriftlichen Arbeit dokumentiert und begruendet werden kann.
export const WEIGHTS = {
  coverage: 0.55,   // Wie viele der gefragten Fachgebiete deckt die Person ab?
  expertise: 0.30,  // Wie hoch ist die Selbsteinschaetzung auf den Treffern (1..5)?
  market: 0.15,     // Teilt die Person den geografischen Markt / die Region?
};

const MARKET_CATEGORIES = new Set(['market']);

/**
 * Reine Funktion: berechnet den Match-Score zwischen einer Frage und einer
 * Mentor:in. Getrennt vom DB-Zugriff, damit sie isoliert testbar ist.
 *
 * @param {Array<{id:number,category:string}>} questionTags
 * @param {Array<{id:number,category:string,weight:number}>} mentorTags
 * @returns {{score:number, coverage:number, expertise:number, market:number, matchedTagIds:number[]}}
 */
export function scoreMentor(questionTags, mentorTags) {
  const mentorById = new Map(mentorTags.map((t) => [t.id, t]));

  // Fachliche Tags (domain/skill/stage) versus Markt-Tags getrennt betrachten.
  const domainQ = questionTags.filter((t) => !MARKET_CATEGORIES.has(t.category));
  const marketQ = questionTags.filter((t) => MARKET_CATEGORIES.has(t.category));

  const matchedDomain = domainQ.filter((t) => mentorById.has(t.id));
  const matchedMarket = marketQ.filter((t) => mentorById.has(t.id));
  const matchedTagIds = [...matchedDomain, ...matchedMarket].map((t) => t.id);

  // 1) Coverage: Anteil der fachlichen Frage-Tags, die abgedeckt sind.
  const coverage = domainQ.length ? matchedDomain.length / domainQ.length : 0;

  // 2) Expertise: durchschnittliche Selbsteinschaetzung (1..5 -> 0..1) auf den
  //    fachlichen Treffern.
  const expertise = matchedDomain.length
    ? matchedDomain.reduce((sum, t) => sum + (mentorById.get(t.id).weight || 3), 0) /
      (matchedDomain.length * 5)
    : 0;

  // 3) Market: 1 bei geteiltem Markt; 0.5 neutral, wenn die Frage keinen
    //    Markt-Bezug angibt; 0 wenn ein Markt gefragt, aber nicht abgedeckt ist.
  let market;
  if (marketQ.length === 0) market = 0.5;
  else market = matchedMarket.length / marketQ.length;

  const raw =
    WEIGHTS.coverage * coverage +
    WEIGHTS.expertise * expertise +
    WEIGHTS.market * market;

  return {
    score: Math.round(raw * 1000) / 10, // 0..100, eine Nachkommastelle
    coverage: Math.round(coverage * 100),
    expertise: Math.round(expertise * 100),
    market: Math.round(market * 100),
    matchedTagIds,
  };
}

/**
 * Berechnet das Ranking der Expert:innen fuer eine Frage OHNE Persistenz.
 * Liefert je Treffer den Score samt nachvollziehbarer Begruendung.
 * @param {number} questionId
 * @param {number} limit
 */
export function rankMentors(questionId, limit = 5) {
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
  if (!question) return [];

  const questionTags = db
    .prepare(
      `SELECT t.id, t.category, t.slug, t.name_de, t.name_en
       FROM question_tags qt JOIN tags t ON t.id = qt.tag_id
       WHERE qt.question_id = ?`
    )
    .all(questionId);

  const mentors = db
    .prepare(`SELECT id, name, country, region, headline, avatar_seed FROM users WHERE role = 'mentor' AND status = 'active'`)
    .all();

  const tagName = new Map(questionTags.map((t) => [t.id, { de: t.name_de, en: t.name_en }]));

  return mentors
    .filter((m) => m.id !== question.asker_id)
    .map((m) => {
      const mentorTags = db
        .prepare(
          `SELECT t.id, t.category, ut.weight
           FROM user_tags ut JOIN tags t ON t.id = ut.tag_id
           WHERE ut.user_id = ?`
        )
        .all(m.id);
      const result = scoreMentor(questionTags, mentorTags);
      return {
        mentor: m,
        ...result,
        matchedTags: result.matchedTagIds.map((id) => tagName.get(id)).filter(Boolean),
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Ermittelt die besten Matches und PERSISTIERT sie (idempotent).
 * @param {number} questionId
 * @param {number} limit
 */
export function computeMatches(questionId, limit = 5) {
  const scored = rankMentors(questionId, limit);
  const question = db.prepare('SELECT status FROM questions WHERE id = ?').get(questionId);

  const upsert = db.prepare(
    `INSERT INTO matches (question_id, mentor_id, score, status)
     VALUES (?, ?, ?, 'suggested')
     ON CONFLICT(question_id, mentor_id)
     DO UPDATE SET score = excluded.score`
  );
  withTx(() => {
    for (const r of scored) upsert.run(questionId, r.mentor.id, r.score);
  });

  if (scored.length && question && question.status === 'open') {
    db.prepare(`UPDATE questions SET status = 'matched' WHERE id = ?`).run(questionId);
  }

  return scored;
}

// =============================================================================
// Iteration 2: rollendifferenziertes Matching auf Basis des Matching Briefs
// (FA-16/FA-17). Bildet die fuenf Auswahlkriterien des BCP 2026 ab, soweit sie
// berechenbar sind: fachliche Passung, Markt-/Kontextkenntnis, Netzwerkzugang,
// Sprache und Kapazitaet. Persoenliche Passung entsteht erst im Kennenlernen und
// wird daher NICHT berechnet – das System schlaegt nur vor, die
// Programmkoordination laedt ein, beide Seiten bestaetigen (Human-in-the-Loop).
// =============================================================================
export const SUPPORT_WEIGHTS = {
  expertise: 0.45, // fachliche Passung (Abdeckung 60 % + Kompetenzgrad 40 %)
  context: 0.15,   // Markt-/Regionskenntnis
  network: 0.15,   // geforderte Netzwerkzugaenge (Kunden, Investoren, …)
  language: 0.1,   // gewuenschte Arbeitssprache
  capacity: 0.15,  // verfuegbare Stunden pro Monat im Verhaeltnis zur Rolle
};

// Richtwerte fuer den monatlichen Zeitbedarf je Rolle (Annahme fuer den Piloten,
// im Pilotbetrieb zu kalibrieren; vgl. Eberle et al., 2026a, Kap. 5.1.5.2).
export const ROLE_HOURS = { lead_mentor: 4, expert: 2, connector: 1 };

const NEUTRAL = 0.5;

/**
 * Reine Funktion: Score einer unterstuetzenden Person fuer einen Bedarf.
 * @param {{tags:Array<{id:number,category:string}>, role:string, language?:string|null}} need
 * @param {{tags:Array<{id:number,category:string,weight:number}>, languages:string[],
 *          capacity_hours:number|null, available:boolean, support_roles:string[]}} supporter
 */
export function scoreSupporter(need, supporter) {
  const byId = new Map(supporter.tags.map((t) => [t.id, t]));
  const domainQ = need.tags.filter((t) => t.category !== 'market' && t.category !== 'network');
  const marketQ = need.tags.filter((t) => t.category === 'market');
  const networkQ = need.tags.filter((t) => t.category === 'network');

  const hitDomain = domainQ.filter((t) => byId.has(t.id));
  const hitMarket = marketQ.filter((t) => byId.has(t.id));
  const hitNetwork = networkQ.filter((t) => byId.has(t.id));

  const coverage = domainQ.length ? hitDomain.length / domainQ.length : NEUTRAL;
  const depth = hitDomain.length
    ? hitDomain.reduce((s, t) => s + (byId.get(t.id).weight || 3), 0) / (hitDomain.length * 5)
    : 0;
  const expertise = domainQ.length ? 0.6 * coverage + 0.4 * depth : NEUTRAL;
  const context = marketQ.length ? hitMarket.length / marketQ.length : NEUTRAL;
  const network = networkQ.length ? hitNetwork.length / networkQ.length : NEUTRAL;
  const language = need.language ? (supporter.languages.includes(need.language) ? 1 : 0) : NEUTRAL;
  const required = ROLE_HOURS[need.role] || 2;
  const capacity = !supporter.available
    ? 0
    : supporter.capacity_hours == null
      ? NEUTRAL
      : Math.min(1, supporter.capacity_hours / required);

  const raw =
    SUPPORT_WEIGHTS.expertise * expertise +
    SUPPORT_WEIGHTS.context * context +
    SUPPORT_WEIGHTS.network * network +
    SUPPORT_WEIGHTS.language * language +
    SUPPORT_WEIGHTS.capacity * capacity;

  // Eignung: Rolle muss passen; ohne jede fachliche Ueberschneidung nur als
  // Connector (wenn der geforderte Netzwerkzugang vorhanden ist).
  const roleOk = !supporter.support_roles.length || supporter.support_roles.includes(need.role);
  const substantive =
    hitDomain.length > 0 || (need.role === 'connector' && hitNetwork.length > 0) ||
    (domainQ.length === 0 && (hitMarket.length > 0 || hitNetwork.length > 0));
  const eligible = roleOk && supporter.available && substantive;

  const pct = (v) => Math.round(v * 100);
  return {
    eligible,
    score: Math.round(raw * 1000) / 10,
    components: {
      expertise: pct(expertise),
      context: pct(context),
      network: pct(network),
      language: pct(language),
      capacity: pct(capacity),
    },
    matchedTagIds: [...hitDomain, ...hitMarket, ...hitNetwork].map((t) => t.id),
  };
}

/**
 * Rangliste moeglicher Unterstuetzer:innen fuer einen Bedarf (ohne Persistenz).
 * Grundlage sind die Bedarfs-Tags und der Matching Brief (Rolle, Sprache).
 */
export function rankSupporters(needId, limit = 6) {
  const need = db
    .prepare(
      `SELECT n.*, c.eem_id FROM needs n JOIN cases c ON c.id = n.case_id WHERE n.id = ?`
    )
    .get(needId);
  if (!need) return [];
  const brief = db.prepare('SELECT * FROM matching_briefs WHERE need_id = ?').get(needId);
  const needTags = db
    .prepare(
      `SELECT t.id, t.category, t.name_de, t.name_en FROM need_tags nt
       JOIN tags t ON t.id = nt.tag_id WHERE nt.need_id = ?`
    )
    .all(needId);
  const role = brief?.main_role || 'expert';
  const tagName = new Map(needTags.map((t) => [t.id, { de: t.name_de, en: t.name_en }]));

  const supporters = db
    .prepare(
      `SELECT id, name, country, region, headline, avatar_seed, languages,
              support_roles, capacity_hours, available
       FROM users WHERE role = 'mentor' AND status = 'active' AND id != ?`
    )
    .all(need.eem_id);
  const tagStmt = db.prepare(
    `SELECT t.id, t.category, ut.weight FROM user_tags ut JOIN tags t ON t.id = ut.tag_id
     WHERE ut.user_id = ?`
  );
  // Aktuelle Auslastung: bestaetigte oder offene Einladungen in nicht
  // abgeschlossenen Faellen (Transparenz fuer die Programmkoordination).
  const loadStmt = db.prepare(
    `SELECT COUNT(*) n FROM case_matches cm JOIN needs n ON n.id = cm.need_id
     JOIN cases c ON c.id = n.case_id
     WHERE cm.supporter_id = ? AND cm.status != 'declined' AND c.step != 'closed'`
  );

  return supporters
    .map((s) => {
      const sup = {
        tags: tagStmt.all(s.id),
        languages: s.languages ? s.languages.split(',') : [],
        capacity_hours: s.capacity_hours,
        available: s.available === null || s.available === undefined ? true : !!s.available,
        support_roles: s.support_roles ? s.support_roles.split(',') : [],
      };
      const r = scoreSupporter({ tags: needTags, role, language: brief?.language || null }, sup);
      return {
        supporter: {
          id: s.id, name: s.name, country: s.country, region: s.region, headline: s.headline,
          avatar_seed: s.avatar_seed, languages: sup.languages, capacity_hours: s.capacity_hours,
          support_roles: sup.support_roles,
        },
        role,
        eligible: r.eligible,
        score: r.score,
        components: r.components,
        matchedTags: r.matchedTagIds.map((id) => tagName.get(id)).filter(Boolean),
        active_load: loadStmt.get(s.id).n,
      };
    })
    .filter((r) => r.eligible)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
