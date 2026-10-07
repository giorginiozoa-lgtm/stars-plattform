// ---------------------------------------------------------------------------
// DEMO-BACKEND IM BROWSER
//
// Nur fuer die verschickbare Einzeldatei-Demo (stars-Prototyp-Demo.html).
// Diese Datei ist KEIN Bestandteil des eigentlichen Prototyps – sie bildet die
// Express/SQLite-API (server/src/**) funktionsgleich im Browser nach, damit der
// Prototyp ohne Node.js-Server und ohne Internetverbindung vorgefuehrt werden
// kann. Datenmodell, Endpunkte, Seed-Daten und die Matching-Logik entsprechen
// eins zu eins dem Server; anstelle von SQLite dient ein In-Memory-Store, der
// im localStorage des Browsers persistiert wird.
//
// Stand Iteration 2: enthaelt zusaetzlich die Programmlogik des BCP 2026
// (server/src/journey.js, routes/journey.js, routes/communities.js):
// EEM-Profil, Support Journey mit verbindlichen Uebergaben, Bedarfe,
// Supportplan, Matching Brief, rollendifferenziertes Matching (scoreSupporter),
// moderiertes Matching, Vereinbarung, Re-Assessment, Communities of Practice
// sowie die erweiterten Dashboard-Kennzahlen.
//
// Stand Iteration 3: zusaetzlich Warm Introductions mit stars-Empfehlung
// (routes/intros.js), Veranstaltungen und Foerderplaetze (routes/events.js),
// Feedback-Kanal (routes/feedback.js), Pitch-&-Learn-Slot-Antraege in
// Communities, Peer-Expert:innen (offers_peer_support) sowie die
// Netzwerk-Kennzahlen im Admin-Dashboard.
//
// Bewusste Vereinfachungen der Demo (nur hier, nicht im Prototyp):
//   – Passwoerter im Klartext statt scrypt-Hash (kein node:crypto im Browser)
//   – Token als Base64-Payload statt signiertem JWT
// ---------------------------------------------------------------------------

const STORE_KEY = 'stars_demo_db_v3';

type Row = Record<string, any>;

// --- Zeit-Helfer (Format wie SQLite datetime('now') -> 'YYYY-MM-DD HH:MM:SS', UTC)
function fmt(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
function now(): string {
  return fmt(new Date());
}
/** Verschiebt 'jetzt' um Angaben wie '-8 months', '-15 days' oder '+6 days' (UTC wie SQLite). */
function shift(spec: string): Date {
  const d = new Date();
  const m = /^([+-]?\d+)\s*(month|day)s?$/.exec(spec.trim());
  if (m) {
    const n = Number(m[1]);
    if (m[2] === 'month') d.setUTCMonth(d.getUTCMonth() + n);
    else d.setUTCDate(d.getUTCDate() + n);
  }
  return d;
}
/** Entspricht datetime('now', spec). */
function ago(spec: string): string {
  return fmt(shift(spec));
}
/** Entspricht date('now', spec) -> 'YYYY-MM-DD'. */
function dateAt(spec: string): string {
  return shift(spec).toISOString().slice(0, 10);
}
/** Entspricht strftime('%Y-%m-%d %H:%M', 'now') (Vergleichswert fuer Session-Termine). */
function nowMinute(): string {
  return now().slice(0, 16);
}
/** Julianisches Tagesdatum wie SQLite julianday() fuer 'YYYY-MM-DD HH:MM:SS' (UTC). */
function julian(s: string): number {
  return Date.parse(String(s).replace(' ', 'T') + 'Z') / 86400000 + 2440587.5;
}
/** Vergleich wie SQLite ORDER BY (NULL zuerst); Array.sort ist stabil -> bei Gleichstand Einfuegereihenfolge. */
function cmp(a: any, b: any): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Store (entspricht dem Schema aus server/src/db.js)
// ---------------------------------------------------------------------------
interface Store {
  users: Row[];
  tags: Row[];
  user_tags: Row[];
  forums: Row[];
  threads: Row[];
  comments: Row[];
  questions: Row[];
  question_tags: Row[];
  matches: Row[];
  conversations: Row[];
  messages: Row[];
  learning_modules: Row[];
  module_tags: Row[];
  learning_progress: Row[];
  notifications: Row[];
  // Iteration 2
  eem_profiles: Row[];
  cases: Row[];
  needs: Row[];
  need_tags: Row[];
  plan_items: Row[];
  matching_briefs: Row[];
  case_matches: Row[];
  agreements: Row[];
  reviews: Row[];
  case_events: Row[];
  communities: Row[];
  community_members: Row[];
  community_posts: Row[];
  community_sessions: Row[];
  session_attendees: Row[];
  // Iteration 3
  intro_requests: Row[];
  intro_request_tags: Row[];
  session_requests: Row[];
  events: Row[];
  event_registrations: Row[];
  feedback: Row[];
  seq: Record<string, number>;
}

let S: Store;

function nextId(table: string): number {
  S.seq[table] = (S.seq[table] || 0) + 1;
  return S.seq[table];
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
  } catch {
    /* Speicher voll oder blockiert – Demo laeuft dann nur im Arbeitsspeicher */
  }
}

// ---------------------------------------------------------------------------
// Seed-Daten (Portierung von server/src/seed.js)
// WICHTIG: fiktive Demonstrationsinhalte, KEINE empirischen Erhebungsdaten.
// ---------------------------------------------------------------------------
const PW = 'stars1234';

function seed() {
  S = {
    users: [], tags: [], user_tags: [], forums: [], threads: [], comments: [],
    questions: [], question_tags: [], matches: [], conversations: [], messages: [],
    learning_modules: [], module_tags: [], learning_progress: [], notifications: [],
    eem_profiles: [], cases: [], needs: [], need_tags: [], plan_items: [], matching_briefs: [],
    case_matches: [], agreements: [], reviews: [], case_events: [],
    communities: [], community_members: [], community_posts: [], community_sessions: [],
    session_attendees: [],
    intro_requests: [], intro_request_tags: [], session_requests: [], events: [],
    event_registrations: [], feedback: [],
    seq: {},
  };

  // 1) Tags -------------------------------------------------------------
  const tagData: [string, string, string, string][] = [
    ['financing', 'Finanzierung & Fundraising', 'Financing & Fundraising', 'domain'],
    ['marketing', 'Marketing & Markenaufbau', 'Marketing & Branding', 'domain'],
    ['sales', 'Vertrieb & Kundengewinnung', 'Sales & Customer Acquisition', 'domain'],
    ['scaling', 'Skalierung & Wachstum', 'Scaling & Growth', 'domain'],
    ['product', 'Produktentwicklung', 'Product Development', 'domain'],
    ['tech', 'Technologie & IT', 'Technology & IT', 'domain'],
    ['legal', 'Recht & Regulierung', 'Legal & Regulation', 'domain'],
    ['operations', 'Operations & Supply Chain', 'Operations & Supply Chain', 'domain'],
    ['leadership', 'Leadership & Team', 'Leadership & Team', 'domain'],
    ['hr', 'HR & Talent', 'HR & Talent', 'domain'],
    ['sustainability', 'Nachhaltigkeit & Impact', 'Sustainability & Impact', 'domain'],
    ['strategy', 'Strategie & Geschäftsmodell', 'Strategy & Business Model', 'domain'],
    // Iteration 3: Mentor:innen-Profil aus dem EEM-Feedback («EEM-Feedback, Oktober 2026»)
    ['institutional-sales', 'Institutioneller Vertrieb (B2G/B2B)', 'Institutional Sales (B2G/B2B)', 'domain'],
    ['intl-expansion', 'Internationale Expansion physischer Produkte', 'International Expansion of Physical Products', 'domain'],
    ['ip-manufacturing', 'IP & Fertigungsskalierung', 'IP & Scaling Manufacturing', 'domain'],
    ['stage-idea', 'Phase: Idee', 'Stage: Idea', 'stage'],
    ['stage-early', 'Phase: Gründung', 'Stage: Early-Stage', 'stage'],
    ['stage-growth', 'Phase: Wachstum', 'Stage: Growth', 'stage'],
    ['market-ssa', 'Markt: Subsahara-Afrika', 'Market: Sub-Saharan Africa', 'market'],
    ['market-sea', 'Markt: Südostasien', 'Market: Southeast Asia', 'market'],
    ['market-latam', 'Markt: Lateinamerika', 'Market: Latin America', 'market'],
    ['market-sa', 'Markt: Südasien', 'Market: South Asia', 'market'],
    ['market-mena', 'Markt: MENA', 'Market: MENA', 'market'],
    // network – Netzwerkzugaenge (Iteration 2: Connector-Rolle, «Access before Advice»)
    ['net-investors', 'Zugang: Investor:innen', 'Access: Investors', 'network'],
    ['net-corporates', 'Zugang: Corporates & Abnehmer', 'Access: Corporates & Buyers', 'network'],
    ['net-distribution', 'Zugang: Distribution & Handel', 'Access: Distribution & Retail', 'network'],
    ['net-government', 'Zugang: Behörden & Policy', 'Access: Government & Policy', 'network'],
    ['net-academia', 'Zugang: Hochschulen & Forschung', 'Access: Academia & Research', 'network'],
    ['net-ngo', 'Zugang: NGOs & Entwicklungsorganisationen', 'Access: NGOs & Development Orgs', 'network'],
    ['net-foundations', 'Zugang: Stiftungen & CSR', 'Access: Foundations & CSR', 'network'],
  ];
  const tagId: Record<string, number> = {};
  for (const [slug, de, en, cat] of tagData) {
    const id = nextId('tags');
    S.tags.push({ id, slug, name_de: de, name_en: en, category: cat });
    tagId[slug] = id;
  }

  // 2) Nutzer:innen ------------------------------------------------------
  function addUser(u: Row): number {
    const id = nextId('users');
    S.users.push({
      id,
      email: u.email,
      password_hash: PW,
      name: u.name,
      role: u.role,
      country: u.country ?? null,
      region: u.region ?? null,
      headline: u.headline ?? null,
      bio: u.bio ?? null,
      languages: u.languages ?? 'en',
      avatar_seed: u.avatar ?? u.name,
      support_roles: null,
      capacity_hours: null,
      available: 1,
      offers_peer_support: 0,
      created_at: ago(u.ago || '0 days'),
    });
    return id;
  }
  function addUserTags(userId: number, tags: [string, number][]) {
    for (const [slug, w] of tags) S.user_tags.push({ user_id: userId, tag_id: tagId[slug], weight: w });
  }

  const admin = addUser({
    email: 'admin@the-stars.ch', name: 'stars Administration', role: 'admin',
    country: 'Schweiz', region: 'Europe', headline: 'Programm-Management stars',
    bio: 'Koordiniert das Mentoring-Programm und die Community.', languages: 'de,en',
    avatar: 'stars-admin', ago: '-8 months',
  });

  const mentors = [
    { email: 'anna.keller@example.com', name: 'Dr. Anna Keller', country: 'Schweiz', region: 'Europe',
      headline: 'Ex-CFO, Venture Partner', bio: 'Begleitet Start-ups bei Finanzierung und Skalierung.',
      tags: [['financing', 5], ['strategy', 4], ['scaling', 4], ['market-ssa', 3]], ago: '-7 months' },
    { email: 'marco.rossi@example.com', name: 'Marco Rossi', country: 'Italien', region: 'Europe',
      headline: 'Serial Entrepreneur, SaaS', bio: 'Produkt- und Tech-Aufbau, zwei Exits.',
      tags: [['product', 5], ['tech', 5], ['scaling', 4], ['market-sea', 3]], ago: '-7 months' },
    { email: 'sara.lindqvist@example.com', name: 'Sara Lindqvist', country: 'Schweden', region: 'Europe',
      headline: 'CMO, Consumer Brands', bio: 'Markenaufbau und Wachstumsmarketing in neuen Märkten.',
      tags: [['marketing', 5], ['sales', 4], ['strategy', 3], ['market-latam', 3]], ago: '-6 months' },
    { email: 'david.chen@example.com', name: 'David Chen', country: 'Singapur', region: 'Asia',
      headline: 'Supply-Chain-Berater', bio: 'Operations und Logistik für wachsende KMU.',
      tags: [['operations', 5], ['scaling', 3], ['market-sea', 4], ['market-sa', 3]], ago: '-6 months' },
    { email: 'fatima.zahra@example.com', name: 'Fatima Zahra', country: 'VAE', region: 'MENA',
      headline: 'Impact-Investorin', bio: 'Nachhaltige Geschäftsmodelle und Impact-Finanzierung.',
      tags: [['sustainability', 5], ['financing', 4], ['strategy', 3], ['market-mena', 4]], ago: '-5 months' },
    { email: 'thomas.mueller@example.com', name: 'Thomas Müller', country: 'Deutschland', region: 'Europe',
      headline: 'Rechtsanwalt, Handelsrecht', bio: 'Verträge, Gesellschaftsrecht, Markteintritt.',
      tags: [['legal', 5], ['strategy', 3], ['market-ssa', 2]], ago: '-4 months' },
    { email: 'grace.otieno@example.com', name: 'Grace Otieno', country: 'Kenia', region: 'Sub-Saharan Africa',
      headline: 'HR-Leiterin, Tech-Scale-up', bio: 'Teamaufbau und Leadership in schnell wachsenden Firmen.',
      tags: [['hr', 5], ['leadership', 5], ['scaling', 3], ['market-ssa', 5]], ago: '-3 months' },
    { email: 'james.wong@example.com', name: 'James Wong', country: 'Grossbritannien', region: 'Europe',
      headline: 'Growth-Investor, Fintech', bio: 'Fundraising-Strategie und Investor Relations.',
      tags: [['financing', 5], ['sales', 3], ['tech', 3], ['market-sa', 3]], ago: '-2 months' },
  ];
  const mentorIds: Record<string, number> = {};
  for (const m of mentors) {
    const id = addUser({ ...m, role: 'mentor', languages: 'en,de', avatar: m.name });
    mentorIds[m.email] = id;
    addUserTags(id, m.tags as [string, number][]);
  }

  const entrepreneurs = [
    { email: 'amara.okafor@example.com', name: 'Amara Okafor', country: 'Nigeria', region: 'Sub-Saharan Africa',
      headline: 'Gründerin, AgriTech', bio: 'Plattform für Kleinbauern, sucht Skalierung.',
      tags: [['financing', 4], ['scaling', 5], ['market-ssa', 5], ['stage-growth', 3]], ago: '-4 months' },
    { email: 'ravi.patel@example.com', name: 'Ravi Patel', country: 'Indien', region: 'South Asia',
      headline: 'Gründer, HealthTech', bio: 'Digitale Gesundheitsdienste für ländliche Regionen.',
      tags: [['product', 5], ['tech', 4], ['market-sa', 5], ['stage-early', 4]], ago: '-3 months' },
    { email: 'lucia.mendez@example.com', name: 'Lucía Méndez', country: 'Kolumbien', region: 'Latin America',
      headline: 'Gründerin, E-Commerce', bio: 'Kunsthandwerk-Marktplatz, will international wachsen.',
      tags: [['marketing', 5], ['sales', 4], ['market-latam', 5], ['stage-growth', 3]], ago: '-2 months' },
    { email: 'linh.tran@example.com', name: 'Linh Tran', country: 'Vietnam', region: 'Southeast Asia',
      headline: 'Gründerin, D2C Food', bio: 'Nachhaltige Lebensmittelmarke, sucht Operations-Know-how.',
      tags: [['operations', 5], ['sustainability', 4], ['market-sea', 5], ['stage-early', 3]], ago: '-1 months' },
    { email: 'omar.haddad@example.com', name: 'Omar Haddad', country: 'Jordanien', region: 'MENA',
      headline: 'Gründer, EdTech', bio: 'Lernplattform, benötigt Fundraising- und Rechtsberatung.',
      tags: [['financing', 4], ['legal', 3], ['market-mena', 5], ['stage-early', 4]], ago: '-1 months' },
    { email: 'kwame.mensah@example.com', name: 'Kwame Mensah', country: 'Ghana', region: 'Sub-Saharan Africa',
      headline: 'Gründer, Clean Energy', bio: 'Solarlösungen für Haushalte, sucht Impact-Investoren.',
      tags: [['sustainability', 5], ['financing', 4], ['market-ssa', 5], ['stage-growth', 4]], ago: '-15 days' },
  ];
  const entIds: Record<string, number> = {};
  for (const e of entrepreneurs) {
    const id = addUser({ ...e, role: 'entrepreneur', languages: 'en', avatar: e.name });
    entIds[e.email] = id;
    addUserTags(id, e.tags as [string, number][]);
  }

  // 3) Foren + Threads + Kommentare -------------------------------------
  const forumData: [string, string, string, string, string][] = [
    ['scaling', 'Skalierung & Wachstum', 'Scaling & Growth',
      'Von der Traktion zum Wachstum: Prozesse, Teams, Märkte.', 'From traction to growth.'],
    ['financing', 'Finanzierung & Fundraising', 'Financing & Fundraising',
      'Kapital, Investor:innen, Förderungen und Bewertung.', 'Capital, investors and funding.'],
    ['market-entry', 'Markteintritt & Internationalisierung', 'Market Entry & Internationalisation',
      'Neue Märkte erschliessen und lokale Besonderheiten meistern.', 'Enter new markets.'],
    ['product-tech', 'Produkt & Technologie', 'Product & Technology',
      'Produktentwicklung, MVP, Tech-Stack und Skalierbarkeit.', 'Product and tech.'],
    ['impact', 'Nachhaltigkeit & Impact', 'Sustainability & Impact',
      'Wirkungsorientiertes Unternehmertum und nachhaltige Modelle.', 'Impact-driven ventures.'],
  ];
  const forumId: Record<string, number> = {};
  forumData.forEach(([slug, tde, ten, dde, den], i) => {
    const id = nextId('forums');
    S.forums.push({ id, slug, title_de: tde, title_en: ten, description_de: dde, description_en: den, sort_order: i });
    forumId[slug] = id;
  });

  function addThread(forum: string, author: number, title: string, body: string, agoSpec: string,
                     comments: [number, string, string][] = []) {
    const id = nextId('threads');
    S.threads.push({ id, forum_id: forumId[forum], author_id: author, title, body, created_at: ago(agoSpec) });
    for (const [cAuthor, cBody, cAgo] of comments) {
      S.comments.push({ id: nextId('comments'), thread_id: id, author_id: cAuthor, body: cBody, created_at: ago(cAgo) });
    }
  }

  addThread('scaling', entIds['amara.okafor@example.com'],
    'Wie skaliere ich mein Team von 5 auf 20 Personen?',
    'Wir wachsen schnell, aber die Prozesse halten nicht mit. Wie habt ihr die erste grosse Einstellungswelle organisiert?',
    '-20 days',
    [
      [mentorIds['grace.otieno@example.com'], 'Definiere zuerst klare Rollen und ein einfaches Onboarding. In dieser Phase ist Kommunikation wichtiger als Tools.', '-19 days'],
      [mentorIds['anna.keller@example.com'], 'Achte auf die Liquidität: schnelles Wachstum bindet Kapital. Plane Einstellungen entlang des Cashflows.', '-18 days'],
    ]);
  addThread('financing', entIds['kwame.mensah@example.com'],
    'Impact-Investoren für Clean Energy in Westafrika?',
    'Wir suchen die erste institutionelle Runde. Welche Kennzahlen erwarten Impact-Fonds konkret?',
    '-12 days',
    [
      [mentorIds['fatima.zahra@example.com'], 'Impact-Fonds wollen neben Finanzkennzahlen klare Wirkungsindikatoren sehen. Bereite eine Theory of Change vor.', '-11 days'],
    ]);
  addThread('market-entry', entIds['lucia.mendez@example.com'],
    'Von Kolumbien in die USA – worauf achten?',
    'Wir wollen unseren Marktplatz in den US-Markt bringen. Logistik und Zoll sind unklar.',
    '-9 days',
    [
      [mentorIds['david.chen@example.com'], 'Kalkuliere die Fulfillment-Kosten realistisch und teste zuerst mit einem kleinen Sortiment.', '-8 days'],
      [mentorIds['sara.lindqvist@example.com'], 'Positionierung neu denken: Was in Kolumbien zieht, muss in den USA nicht funktionieren. Erst Zielgruppe validieren.', '-7 days'],
    ]);
  addThread('product-tech', entIds['ravi.patel@example.com'],
    'MVP für ländliche Regionen mit schlechter Verbindung',
    'Unsere Nutzer:innen haben oft nur 2G. Wie baue ich eine App, die trotzdem funktioniert?',
    '-6 days',
    [
      [mentorIds['marco.rossi@example.com'], 'Offline-First-Architektur: lokale Speicherung, Synchronisierung im Hintergrund, minimale Payloads. Genau wie diese Plattform es vormacht.', '-5 days'],
    ]);
  addThread('impact', entIds['linh.tran@example.com'],
    'Nachhaltige Verpackung ohne Margenverlust',
    'Kund:innen erwarten nachhaltige Verpackung, aber die Kosten sind hoch. Erfahrungen?',
    '-3 days',
    [
      [mentorIds['fatima.zahra@example.com'], 'Kommuniziere den Mehrwert transparent – viele Kund:innen zahlen einen Aufpreis, wenn die Wirkung sichtbar ist.', '-2 days'],
    ]);

  // 4) Fragen + Matching -------------------------------------------------
  function addQuestion(asker: number, title: string, body: string, tags: string[], agoSpec: string) {
    const id = nextId('questions');
    S.questions.push({ id, asker_id: asker, title, body, status: 'open', created_at: ago(agoSpec) });
    for (const slug of tags) S.question_tags.push({ question_id: id, tag_id: tagId[slug] });
    computeMatches(id, 5);
  }

  addQuestion(entIds['amara.okafor@example.com'],
    'Wie strukturiere ich eine Seed-Runde in Subsahara-Afrika?',
    'Ich suche jemanden mit Erfahrung in Fundraising und Skalierung im afrikanischen Kontext.',
    ['financing', 'scaling', 'market-ssa'], '-10 days');
  addQuestion(entIds['ravi.patel@example.com'],
    'Tech-Architektur für Offline-Nutzung',
    'Beratung zu Produkt- und Technologieentscheidungen für den südasiatischen Markt.',
    ['product', 'tech', 'market-sa'], '-8 days');
  addQuestion(entIds['omar.haddad@example.com'],
    'Rechtsform und Finanzierung für EdTech in MENA',
    'Ich brauche Unterstützung bei rechtlichen Fragen und der ersten Finanzierungsrunde.',
    ['legal', 'financing', 'market-mena'], '-4 days');
  addQuestion(entIds['lucia.mendez@example.com'],
    'Markenaufbau für internationalen E-Commerce',
    'Wie positioniere ich meine Marke für lateinamerikanische und internationale Kund:innen?',
    ['marketing', 'sales', 'market-latam'], '-2 days');

  // 5) Microlearning -----------------------------------------------------
  const moduleData: [string, string, string, string, string, number, string, string[]][] = [
    ['pitch-basics', 'Der perfekte Elevator Pitch', 'The Perfect Elevator Pitch',
      'In 90 Sekunden überzeugen: Aufbau und typische Fehler.', 'Convince in 90 seconds.',
      6, 'beginner', ['financing', 'sales']],
    ['unit-economics', 'Unit Economics verstehen', 'Understanding Unit Economics',
      'Deckungsbeitrag, CAC und LTV einfach erklärt.', 'Contribution margin, CAC and LTV.',
      9, 'intermediate', ['financing', 'strategy']],
    ['lean-mvp', 'Vom Problem zum MVP', 'From Problem to MVP',
      'Wie man mit minimalem Aufwand maximales Lernen erzielt.', 'Maximise learning, minimise effort.',
      8, 'beginner', ['product', 'strategy']],
    ['hiring-first', 'Die ersten zehn Mitarbeitenden', 'Your First Ten Hires',
      'Rollen priorisieren und Kultur von Beginn an gestalten.', 'Prioritise roles, shape culture.',
      7, 'intermediate', ['hr', 'leadership']],
    ['market-entry', 'Neue Märkte systematisch erschliessen', 'Systematic Market Entry',
      'Ein Rahmen zur Bewertung und Priorisierung von Märkten.', 'A framework to evaluate markets.',
      10, 'advanced', ['strategy', 'scaling']],
    ['storytelling', 'Storytelling für Investor:innen', 'Storytelling for Investors',
      'Die Narrative, die Kapital überzeugen.', 'Narratives that win capital.',
      6, 'intermediate', ['financing', 'marketing']],
    ['supply-basics', 'Grundlagen des Supply-Chain-Managements', 'Supply Chain Fundamentals',
      'Lieferketten planen, Kosten senken, Risiken managen.', 'Plan supply chains, cut costs.',
      11, 'intermediate', ['operations']],
    ['impact-measure', 'Wirkung messen und berichten', 'Measuring and Reporting Impact',
      'Theory of Change und KPIs für Impact-Unternehmen.', 'Theory of Change and impact KPIs.',
      9, 'advanced', ['sustainability', 'strategy']],
  ];
  for (const [slug, tde, ten, dde, den, dur, lvl, tags] of moduleData) {
    const id = nextId('learning_modules');
    S.learning_modules.push({
      id, slug, title_de: tde, title_en: ten, description_de: dde, description_en: den,
      video_url: null, duration_min: dur, level: lvl, created_at: now(),
    });
    for (const t of tags) S.module_tags.push({ module_id: id, tag_id: tagId[t] });
  }
  const progAt = ago('-1 days');
  S.learning_progress.push(
    { user_id: entIds['amara.okafor@example.com'], module_id: 1, progress: 100, completed: 1, updated_at: progAt },
    { user_id: entIds['amara.okafor@example.com'], module_id: 2, progress: 60, completed: 0, updated_at: progAt },
    { user_id: entIds['ravi.patel@example.com'], module_id: 3, progress: 100, completed: 1, updated_at: progAt },
    { user_id: entIds['lucia.mendez@example.com'], module_id: 6, progress: 40, completed: 0, updated_at: progAt },
  );

  // 6) Beispiel-Konversation --------------------------------------------
  const [low, high] = orderPair(entIds['amara.okafor@example.com'], mentorIds['anna.keller@example.com']);
  const convId = nextId('conversations');
  S.conversations.push({ id: convId, user_low: low, user_high: high, created_at: ago('-9 days') });
  S.messages.push(
    { id: nextId('messages'), conversation_id: convId, sender_id: entIds['amara.okafor@example.com'],
      body: 'Hallo Anna, danke fürs Annehmen! Ich würde gerne über unsere Seed-Runde sprechen.',
      read_at: ago('-9 days'), created_at: ago('-9 days') },
    { id: nextId('messages'), conversation_id: convId, sender_id: mentorIds['anna.keller@example.com'],
      body: 'Sehr gerne, Amara. Schick mir am besten dein aktuelles Financial Model, dann schauen wir es gemeinsam an.',
      read_at: ago('-8 days'), created_at: ago('-8 days') },
    { id: nextId('messages'), conversation_id: convId, sender_id: entIds['amara.okafor@example.com'],
      body: 'Perfekt, ich bereite es bis morgen vor.', read_at: null, created_at: ago('-8 days') },
  );

  // 6b) Iteration 2: Unterstuetzer-Merkmale, Communities of Practice und
  //     Beispielfaelle entlang der Support Journey (fiktive Demo-Daten!)
  const supporterData: Record<string, [string, number, string[]]> = {
    'anna.keller@example.com': ['lead_mentor,expert', 6, ['net-investors']],
    'marco.rossi@example.com': ['expert', 3, ['net-academia']],
    'sara.lindqvist@example.com': ['lead_mentor,expert,connector', 4, ['net-distribution', 'net-corporates']],
    'david.chen@example.com': ['expert,connector', 2, ['net-distribution', 'net-corporates']],
    'fatima.zahra@example.com': ['connector,expert', 3, ['net-investors', 'net-ngo']],
    'thomas.mueller@example.com': ['expert', 2, ['net-government']],
    'grace.otieno@example.com': ['lead_mentor,connector', 5, ['net-corporates', 'net-government']],
    'james.wong@example.com': ['expert,connector', 1, ['net-investors']],
  };
  for (const [email, [roles, hours, nets]] of Object.entries(supporterData)) {
    const u = findUser(mentorIds[email])!;
    u.support_roles = roles;
    u.capacity_hours = hours;
    u.available = 1;
    for (const n of nets) {
      if (!S.user_tags.some((ut) => ut.user_id === u.id && ut.tag_id === tagId[n])) {
        S.user_tags.push({ user_id: u.id, tag_id: tagId[n], weight: 4 });
      }
    }
  }

  // --- Communities of Practice ------------------------------------------
  const M = (e: string) => mentorIds[e];
  const E = (e: string) => entIds[e];
  function addMember(cid: number, uid: number, role: string) {
    if (S.community_members.some((m) => m.community_id === cid && m.user_id === uid)) return;
    S.community_members.push({ community_id: cid, user_id: uid, role, joined_at: now() });
  }

  const communityData: {
    slug: string; tag: string; de: string; en: string; dde: string; den: string;
    mods: number[]; members: number[]; posts: [number, string, string][];
    sessions: [number, string, string, string, string, number[]][];
  }[] = [
    {
      slug: 'access-to-finance', tag: 'financing',
      de: 'Access to Finance', en: 'Access to Finance',
      dde: 'Finanzierungsreife, Working Capital und Investor Relations – Erfahrungen aus Emerging Markets teilen.',
      den: 'Investment readiness, working capital and investor relations – sharing experience from emerging markets.',
      mods: [M('anna.keller@example.com')],
      members: [M('james.wong@example.com'), M('fatima.zahra@example.com'), E('amara.okafor@example.com'),
        E('omar.haddad@example.com'), E('kwame.mensah@example.com')],
      posts: [
        [E('kwame.mensah@example.com'), 'Hat jemand Erfahrung mit Blended-Finance-Fonds für Solar in Westafrika? Welche Unterlagen wurden in der Due Diligence verlangt?', '-6 days'],
        [M('anna.keller@example.com'), 'Kwame, typischerweise: 3-Jahres-Finanzplan, Impact-KPIs und ein klarer Use of Funds. Ich teile in der nächsten Session eine Checkliste.', '-5 days'],
        [E('amara.okafor@example.com'), 'Lange Zahlungsfristen bei Grosskunden sind bei uns der eigentliche Engpass – nicht das Eigenkapital. Wie löst ihr Working-Capital-Lücken?', '-2 days'],
      ],
      sessions: [
        [M('anna.keller@example.com'), 'Investment Readiness Clinic', 'Gemeinsame Durchsicht von Pitch Decks und Finanzplänen (Peer-Feedback).', 'roundtable', '+6 days',
          [E('kwame.mensah@example.com'), E('omar.haddad@example.com')]],
        [M('james.wong@example.com'), 'Working Capital in Emerging Markets', 'Erfahrungsaustausch zu Factoring, Lieferantenkrediten und Zahlungsfristen.', 'peer_session', '-12 days',
          [E('amara.okafor@example.com')]],
      ],
    },
    {
      slug: 'scale-up-leadership', tag: 'leadership',
      de: 'Scale-up Leadership Circle', en: 'Scale-up Leadership Circle',
      dde: 'Führung eines wachsenden Teams, Delegation und Governance – für Gründer:innen im Skalierungsübergang.',
      den: 'Leading a growing team, delegation and governance – for founders in the scaling transition.',
      mods: [M('grace.otieno@example.com')],
      members: [M('sara.lindqvist@example.com'), E('amara.okafor@example.com'), E('lucia.mendez@example.com'), E('linh.tran@example.com')],
      posts: [
        [E('linh.tran@example.com'), 'Ich bin noch in jede operative Entscheidung involviert. Wie habt ihr den ersten Schritt zur Delegation gemacht?', '-4 days'],
        [M('grace.otieno@example.com'), 'Bewährt hat sich eine einfache Entscheidungsmatrix: Was entscheide ich, was das Team, was gemeinsam? Gerne Thema für die nächste Session.', '-3 days'],
      ],
      sessions: [
        [M('grace.otieno@example.com'), 'Delegation statt Micromanagement', 'Peer Session mit Fallbeispielen aus den Teilnehmenden.', 'peer_session', '+10 days',
          [E('linh.tran@example.com'), E('amara.okafor@example.com')]],
      ],
    },
    {
      slug: 'africa-market-access', tag: 'market-ssa',
      de: 'Africa Market Access', en: 'Africa Market Access',
      dde: 'Markteintritt, Distribution und Partnerschaften in Subsahara-Afrika – South-South-Learning.',
      den: 'Market entry, distribution and partnerships in Sub-Saharan Africa – south-south learning.',
      mods: [M('grace.otieno@example.com')],
      members: [M('thomas.mueller@example.com'), E('amara.okafor@example.com'), E('kwame.mensah@example.com')],
      posts: [
        [E('amara.okafor@example.com'), 'Wir prüfen den Markteintritt in Ghana. Wer kennt lokale Agrar-Distributoren oder Kooperativen?', '-8 days'],
        [E('kwame.mensah@example.com'), 'In Accra arbeiten wir mit zwei Händlernetzwerken zusammen – ich stelle gerne einen Kontakt her.', '-7 days'],
      ],
      sessions: [],
    },
    {
      slug: 'circular-economy-impact', tag: 'sustainability',
      de: 'Circular Economy & Impact', en: 'Circular Economy & Impact',
      dde: 'Recycling, erneuerbare Energie und Impact-Messung – technische Expertise und Abnehmer finden.',
      den: 'Recycling, renewable energy and impact measurement – finding technical expertise and buyers.',
      mods: [M('fatima.zahra@example.com')],
      members: [E('kwame.mensah@example.com'), E('linh.tran@example.com')],
      posts: [
        [M('fatima.zahra@example.com'), 'Willkommen! Diese Community verbindet Ventures mit Umwelt- und Sozialwirkung. Stellt euch gerne kurz vor.', '-20 days'],
      ],
      sessions: [
        [M('fatima.zahra@example.com'), 'Impact-KPIs, die Investoren überzeugen', 'Masterclass mit anschliessender Fragerunde.', 'masterclass', '+15 days', [E('kwame.mensah@example.com')]],
      ],
    },
    {
      slug: 'ecosystem-builders', tag: 'strategy',
      de: 'Ecosystem Builders Network', en: 'Ecosystem Builders Network',
      dde: 'Für Intermediäre, die selbst weitere Entrepreneurs unterstützen: Programme, Corporate Access, Portfoliowirkung.',
      den: 'For intermediaries who support other entrepreneurs themselves: programmes, corporate access, portfolio impact.',
      mods: [admin],
      members: [M('sara.lindqvist@example.com'), E('ravi.patel@example.com')],
      posts: [],
      sessions: [],
    },
  ];
  for (const c of communityData) {
    const cid = nextId('communities');
    S.communities.push({
      id: cid, slug: c.slug, name_de: c.de, name_en: c.en, description_de: c.dde, description_en: c.den,
      tag_id: tagId[c.tag], created_at: ago('-3 months'),
    });
    for (const m of c.mods) addMember(cid, m, 'moderator');
    for (const m of c.members) addMember(cid, m, 'member');
    for (const [author, body, a] of c.posts) {
      S.community_posts.push({ id: nextId('community_posts'), community_id: cid, author_id: author, body, created_at: ago(a) });
    }
    for (const [host, title, desc, format, when, attendees] of c.sessions) {
      const sid = nextId('community_sessions');
      S.community_sessions.push({
        id: sid, community_id: cid, host_id: host, title, description: desc, format,
        starts_at: dateAt(when) + ' 15:00', created_at: ago('-10 days'),
      });
      for (const a of attendees) {
        if (!S.session_attendees.some((x) => x.session_id === sid && x.user_id === a)) {
          S.session_attendees.push({ session_id: sid, user_id: a });
        }
      }
    }
  }

  // --- Support Journey: Beispielfaelle in unterschiedlichen Schritten -----
  const J = (o: unknown) => JSON.stringify(o);
  function addProfile(userId: number, caseType: string, ctx: Row, eco: Row, ven: Row, ent: Row, validatedAgo: string) {
    S.eem_profiles.push({
      user_id: userId, case_type: caseType, context: J(ctx), ecosystem: J(eco), venture: J(ven),
      entrepreneur: J(ent), validated_at: ago(validatedAgo), updated_at: ago('-20 days'),
    });
  }
  function addCase(o: Row): number {
    const id = nextId('cases');
    S.cases.push({
      id, eem_id: o.eem, coordinator_id: o.coord, step: o.step, intake_decision: o.decision,
      motivation: o.motivation, expectations: o.expectations, plan_consent_at: o.consent ? ago(o.consent) : null,
      cycle: 1, closed_reason: o.reason, closing_note: o.note,
      created_at: ago(o.created), updated_at: ago(o.updated),
    });
    return id;
  }
  function addNeed(caseId: number, n: Row): number {
    const id = nextId('needs');
    S.needs.push({
      id, case_id: caseId, goal: n.goal, bottleneck: n.bottleneck ?? null, support_needed: n.support ?? null,
      success_criterion: n.criterion ?? null, relevance: n.r ?? null, urgency: n.u ?? null, impact: n.i ?? null,
      stars_contribution: n.s ?? null, feasibility: n.f ?? null, priority_rank: n.rank ?? null,
      status: n.status ?? 'open', cycle: 1, created_by: n.by ?? admin, created_at: ago(n.ago ?? '-15 days'),
    });
    for (const t of n.tags || []) S.need_tags.push({ need_id: id, tag_id: tagId[t] });
    (n.plan || []).forEach(([format, note]: [string, string], i: number) => {
      S.plan_items.push({ id: nextId('plan_items'), need_id: id, format, note, sort_order: i });
    });
    if (n.brief) {
      const [main_role, experience, context_ref, network_access, language, duration, working_mode] = n.brief;
      S.matching_briefs.push({
        need_id: id, main_role, experience, context_ref, network_access, language, duration, working_mode,
        updated_at: now(),
      });
    }
    return id;
  }
  function addCMatch(needId: number, supporterId: number, role: string, score: number, status: string,
                     sOk: number, eOk: number, by: number, createdAgo: string, confirmedAgo: string | null) {
    S.case_matches.push({
      id: nextId('case_matches'), need_id: needId, supporter_id: supporterId, role, score, status,
      supporter_ok: sOk, eem_ok: eOk, invited_by: by, created_at: ago(createdAgo),
      confirmed_at: confirmedAgo ? ago(confirmedAgo) : null,
    });
  }
  function addAgreement(needId: number, goal: string, roles: string, nextSteps: string, reviewSpec: string) {
    S.agreements.push({
      need_id: needId, goal, roles, next_steps: nextSteps, review_date: dateAt(reviewSpec), updated_at: now(),
    });
  }
  function addReview(needId: number, progress: string, outcome: string, nextStep: string, by: number, a: string) {
    S.reviews.push({
      id: nextId('reviews'), need_id: needId, progress, outcome, next_step: nextStep, created_by: by, created_at: ago(a),
    });
  }
  function addEvent(caseId: number, userId: number, type: string, step: string, body: string, a: string) {
    S.case_events.push({ id: nextId('case_events'), case_id: caseId, user_id: userId, type, step, body, created_at: ago(a) });
  }
  function steps(caseId: number, userId: number, list: [string, string, string][]) {
    for (const [step, body, a] of list) addEvent(caseId, userId, 'step', step, body, a);
  }

  // Fall 1 – Amara Okafor (Venture Scaler): in der Umsetzung, zwei bestaetigte Matches.
  const amara = E('amara.okafor@example.com');
  addProfile(amara, 'venture_scaler',
    { target_markets: 'Nigeria, Ghana', setting: 'mixed', conditions: ['infrastructure', 'capital_access', 'payment_terms'], conditions_note: 'Lange Zahlungsfristen bei Grosskunden, Stromausfälle in Lagerhäusern.' },
    { existing_support: ['accelerator', 'informal_network'], access_quality: '2', gaps: 'Kaum Zugang zu Distributoren ausserhalb Nigerias.' },
    { sector: 'AgriTech', business_model: 'B2B-Plattform für Kleinbauern und Abnehmer', stage: 'growth', employees: '11-50', revenue: '100k-1m' },
    { experience: '5-10', prior_programs: 'yes', hours_per_month: '4-8', languages: ['en'], mode: 'online', strengths: 'Netzwerk zu Kooperativen, Produktentwicklung' },
    '-18 days');
  const c1 = addCase({
    eem: amara, coord: admin, step: 'implementation', decision: 'accepted',
    motivation: 'Wir wollen nach Ghana expandieren und brauchen Zugang zu Distributoren und eine Finanzierung für Working Capital.',
    expectations: 'Begleitung über 6 Monate; monatliche Termine; Amara bringt Zahlen und Kontaktliste ein.',
    consent: '-12 days', reason: null, note: null, created: '-30 days', updated: '-6 days',
  });
  const n11 = addNeed(c1, {
    goal: 'Markteintritt in Ghana mit zwei Distributionspartnern', bottleneck: 'Fehlende Kontakte zu lokalen Agrar-Distributoren; unklare regulatorische Anforderungen',
    support: 'Zugang zu Distributoren und Erfahrung mit Markteintritt in Westafrika', criterion: 'Zwei qualifizierte Gespräche mit Distributoren, ein Pilotvertrag',
    r: 3, u: 3, i: 3, s: 3, f: 2, rank: 1, ago: '-22 days', by: amara,
    tags: ['scaling', 'market-ssa', 'net-distribution'],
    plan: [['mentoring', 'Lead Mentorin begleitet den Markteintritt'], ['introductions', 'Warm Intros zu Distributoren in Accra']],
    brief: ['lead_mentor', 'Skalierung in Subsahara-Afrika, Aufbau von Vertriebsstrukturen', 'Westafrika, idealerweise Ghana', 'Distributoren, Behörden', 'en', '6 Monate', 'online, monatlich'],
  });
  const n12 = addNeed(c1, {
    goal: 'Working-Capital-Finanzierung für die Expansion sichern', bottleneck: 'Zahlungsfristen von 90 Tagen binden Liquidität',
    support: 'Fachexpertise Finanzierung, Kontakte zu Investoren', criterion: 'Finanzierungsplan liegt vor, zwei Investorengespräche geführt',
    r: 3, u: 2, i: 3, s: 3, f: 2, rank: 2, ago: '-22 days', by: amara,
    tags: ['financing', 'market-ssa', 'net-investors'],
    plan: [['skills', 'Clinic Finanzierungsplan'], ['introductions', 'Kontakte zu Impact-Investoren']],
    brief: ['expert', 'Wachstumsfinanzierung, Working Capital', 'Emerging Markets', 'Investor:innen', 'en', '3 Monate', 'online, punktuell'],
  });
  addNeed(c1, { goal: 'Datenplattform für Kooperativen ausbauen', bottleneck: 'Kleines Tech-Team', support: 'Produkt-/Tech-Sparring', ago: '-22 days', by: amara, tags: ['tech'] });
  addCMatch(n11, M('grace.otieno@example.com'), 'lead_mentor', 88.5, 'confirmed', 1, 1, admin, '-11 days', '-9 days');
  addCMatch(n12, M('anna.keller@example.com'), 'expert', 90.2, 'confirmed', 1, 1, admin, '-11 days', '-10 days');
  addAgreement(n11, 'Zwei Distributionspartner in Ghana gewinnen', 'Grace: Lead Mentorin, öffnet Kontakte; Amara: Gespräche führen', 'Kontaktliste bis Ende Monat, erstes Gespräch in Accra', '+25 days');
  addAgreement(n12, 'Finanzierungsplan und zwei Investorengespräche', 'Anna: Fachexpertin Finanzierung; Amara: Zahlen liefern', 'Financial Model überarbeiten', '+6 days');
  steps(c1, admin, [
    ['intake', 'Aufnahmeantrag', '-30 days'], ['assessment', 'Aufnahme bestätigt', '-28 days'],
    ['prioritization', 'Profil validiert', '-22 days'], ['support_plan', 'Zwei Bedarfe priorisiert', '-16 days'],
    ['matching', 'Supportplan bestätigt', '-12 days'], ['agreement', 'Matches bestätigt', '-8 days'],
    ['implementation', 'Vereinbarungen festgehalten', '-6 days'],
  ]);
  addEvent(c1, M('grace.otieno@example.com'), 'progress', 'implementation', 'Erstes Gespräch mit einem Distributor in Accra geführt; zweites ist terminiert.', '-2 days');

  // Fall 2 – Kwame Mensah: im Matching, Einladung an Connector offen.
  const kwame = E('kwame.mensah@example.com');
  addProfile(kwame, 'venture_scaler',
    { target_markets: 'Ghana, Togo', setting: 'rural', conditions: ['energy', 'capital_access'] },
    { existing_support: ['ngo_program'], access_quality: '2', gaps: 'Keine Kontakte zu Impact-Investoren' },
    { sector: 'Clean Energy', business_model: 'Solar-Home-Systeme mit Pay-as-you-go', stage: 'growth', employees: '11-50', revenue: '100k-1m' },
    { experience: '3-5', prior_programs: 'no', hours_per_month: '4-8', languages: ['en'], mode: 'online' },
    '-9 days');
  const c2 = addCase({
    eem: kwame, coord: admin, step: 'matching', decision: 'accepted',
    motivation: 'Wir suchen Impact-Investoren für die nächste Wachstumsphase.',
    expectations: 'Begleitung über 3 Monate, Fokus auf Investorenzugang.',
    consent: '-3 days', reason: null, note: null, created: '-14 days', updated: '-2 days',
  });
  const n21 = addNeed(c2, {
    goal: 'Zugang zu drei Impact-Investoren für eine Seed-Extension', bottleneck: 'Kein Netzwerk zu Impact-Fonds; Pitch nicht auf Impact-KPIs ausgerichtet',
    support: 'Connector mit Investorenzugang', criterion: 'Drei Erstgespräche mit Impact-Investoren',
    r: 3, u: 3, i: 3, s: 3, f: 3, rank: 1, ago: '-8 days', by: kwame,
    tags: ['sustainability', 'financing', 'net-investors'],
    plan: [['introductions', 'Warm Intros zu Impact-Fonds'], ['knowledge_sharing', 'Community «Access to Finance»']],
    brief: ['connector', 'Impact-Finanzierung, Erneuerbare Energie', 'Westafrika oder vergleichbare Märkte', 'Impact-Investor:innen, DFIs', 'en', '3 Monate', 'online'],
  });
  addCMatch(n21, M('fatima.zahra@example.com'), 'connector', 86.0, 'invited', 0, 0, admin, '-1 days', null);
  steps(c2, admin, [
    ['intake', 'Aufnahmeantrag', '-14 days'], ['assessment', 'Aufnahme bestätigt', '-13 days'],
    ['prioritization', 'Profil validiert', '-9 days'], ['support_plan', 'Bedarf priorisiert', '-6 days'],
    ['matching', 'Supportplan bestätigt', '-2 days'],
  ]);

  // Fall 3 – Linh Tran: Priorisierung steht noch aus.
  const linh = E('linh.tran@example.com');
  addProfile(linh, 'venture_scaler',
    { target_markets: 'Vietnam, Singapur', setting: 'urban', conditions: ['regulation'] },
    { existing_support: ['accelerator'], access_quality: '3' },
    { sector: 'D2C Food', business_model: 'Nachhaltige Snacks, Online und Retail', stage: 'market_entry', employees: '1-10', revenue: '<100k' },
    { experience: '1-3', prior_programs: 'yes', hours_per_month: '2-4', languages: ['en'], mode: 'online' },
    '-1 days');
  const c3 = addCase({
    eem: linh, coord: admin, step: 'prioritization', decision: 'accepted',
    motivation: 'Ich möchte Operations und Team professionalisieren.', expectations: '3 Monate, Fokus Operations.',
    consent: null, reason: null, note: null, created: '-7 days', updated: '-1 days',
  });
  addNeed(c3, { goal: 'Lieferkette für den Export nach Singapur aufbauen', bottleneck: 'Keine Erfahrung mit Kühlkette und Exportvorschriften', support: 'Operations-Expertise', criterion: 'Exportfähige Lieferkette für ein Produkt', r: 3, u: 2, i: 3, s: 3, f: 2, ago: '-1 days', by: linh, tags: ['operations', 'market-sea'] });
  addNeed(c3, { goal: 'Delegationsstruktur im Team einführen', bottleneck: 'Gründerin ist in alle Entscheidungen involviert', support: 'Leadership-Mentoring', r: 2, u: 2, i: 2, s: 2, f: 3, ago: '-1 days', by: linh, tags: ['leadership'] });
  steps(c3, admin, [['intake', 'Aufnahmeantrag', '-7 days'], ['assessment', 'Aufnahme bestätigt', '-6 days'], ['prioritization', 'Profil validiert', '-1 days']]);

  // Fall 4 – Omar Haddad: Aufnahmeantrag offen.
  const omar = E('omar.haddad@example.com');
  const c4 = addCase({
    eem: omar, coord: null, step: 'intake', decision: 'pending',
    motivation: 'Wir bereiten eine Finanzierungsrunde vor und brauchen Unterstützung bei Rechtsfragen in Jordanien und Saudi-Arabien.',
    expectations: null, consent: null, reason: null, note: null, created: '-1 days', updated: '-1 days',
  });
  steps(c4, omar, [['intake', 'Aufnahmeantrag', '-1 days']]);

  // Fall 5 – Lucia Mendez: abgeschlossen, Ziel erreicht (Outcome-Daten).
  const lucia = E('lucia.mendez@example.com');
  addProfile(lucia, 'venture_scaler',
    { target_markets: 'Kolumbien, Mexiko', setting: 'urban', conditions: ['logistics'] },
    { existing_support: ['informal_network'], access_quality: '3' },
    { sector: 'E-Commerce', business_model: 'Marktplatz für Kunsthandwerk', stage: 'growth', employees: '11-50', revenue: '100k-1m' },
    { experience: '5-10', prior_programs: 'yes', hours_per_month: '4-8', languages: ['en'], mode: 'online' },
    '-80 days');
  const c5 = addCase({
    eem: lucia, coord: admin, step: 'closed', decision: 'accepted',
    motivation: 'Markteintritt in Mexiko.', expectations: '4 Monate Begleitung.', consent: null,
    reason: 'goal_achieved', note: 'Ziel erreicht: Distributionspartner in Mexiko gewonnen, erster Umsatz im Zielmarkt.',
    created: '-90 days', updated: '-5 days',
  });
  const n51 = addNeed(c5, {
    goal: 'Distributionspartner in Mexiko gewinnen', bottleneck: 'Fehlende Kontakte im Handel', support: 'Connector im lateinamerikanischen Handel',
    criterion: 'Ein unterzeichneter Partnervertrag', r: 3, u: 3, i: 3, s: 3, f: 3, rank: 1, status: 'achieved', ago: '-80 days', by: lucia,
    tags: ['sales', 'market-latam', 'net-distribution'],
    plan: [['introductions', 'Warm Intros zu Händlern'], ['mentoring', 'Begleitung der Verhandlungen']],
    brief: ['connector', 'Handel und Vertrieb Konsumgüter', 'Lateinamerika', 'Distribution & Handel', 'en', '4 Monate', 'online'],
  });
  addCMatch(n51, M('sara.lindqvist@example.com'), 'connector', 91.0, 'confirmed', 1, 1, admin, '-70 days', '-66 days');
  addAgreement(n51, 'Partnervertrag mit einem Händler in Mexiko', 'Sara: Connector; Lucia: Verhandlung', 'Drei Intros, Pilotbestellung', '-10 days');
  addReview(n51, 'achieved', 'Partnervertrag mit Händlernetz in Mexiko-Stadt unterzeichnet; erste Bestellung ausgeliefert.', 'close', admin, '-6 days');
  steps(c5, admin, [['intake', 'Aufnahmeantrag', '-90 days'], ['reassessment', 'Review durchgeführt', '-6 days'], ['closed', 'Ziel erreicht', '-5 days']]);

  // Eine zusaetzliche Teil-Wirkung fuer die Outcome-Auswertung (Amara, Bedarf 2).
  addReview(n12, 'partial', 'Financial Model überarbeitet; erstes Investorengespräch geführt.', 'continue', M('anna.keller@example.com'), '-1 days');

  // Benachrichtigungen passend zum Demo-Stand.
  S.notifications.push(
    { id: nextId('notifications'), user_id: M('fatima.zahra@example.com'), type: 'match',
      title: 'Anfrage von stars: Unterstützung gesucht',
      body: 'Bedarf: «Zugang zu drei Impact-Investoren …». Bitte Matching Brief prüfen.',
      link: `/journey/${c2}`, read_at: null, created_at: ago('-1 days') },
    { id: nextId('notifications'), user_id: admin, type: 'system', title: 'Neuer Aufnahmeantrag',
      body: 'Omar Haddad möchte in die Support Journey aufgenommen werden.',
      link: `/journey/${c4}`, read_at: null, created_at: ago('-1 days') },
  );

  // 6c) Iteration 3: Netzwerkzugang, Give-back und Veranstaltungen.
  //     Die Persona «Sunita Rai» ist FIKTIV und lediglich an ein Feedback aus dem
  //     stars-Netzwerk angelehnt (EEM-Feedback, Oktober 2026); im oeffentlich
  //     zugaenglichen Prototyp werden keine Echtnamen verwendet (Datenminimierung).
  const addTagIfMissing = (uid: number, slug: string, w: number) => {
    if (!S.user_tags.some((ut) => ut.user_id === uid && ut.tag_id === tagId[slug])) {
      S.user_tags.push({ user_id: uid, tag_id: tagId[slug], weight: w });
    }
  };
  const alumni3: { email: string; name: string; country: string; region: string; headline: string; bio: string;
                   tags: [string, number][]; roles: string; hours: number }[] = [
    { email: 'priya.nair@example.com', name: 'Priya Nair', country: 'Indien', region: 'South Asia',
      headline: 'Ex-Supply-Managerin, internationale Entwicklungsorganisation',
      bio: 'Beschaffung und Lieferketten für Bildungs- und Gesundheitsprogramme in Südasien und Ostafrika.',
      tags: [['operations', 5], ['institutional-sales', 4], ['market-sa', 5], ['market-ssa', 3], ['net-ngo', 5]],
      roles: 'expert,connector', hours: 3 },
    { email: 'daniel.kiprop@example.com', name: 'Daniel Kiprop', country: 'Kenia', region: 'Sub-Saharan Africa',
      headline: 'Gründer, Schul-Hardware (B2G)', bio: 'Hat Lernhardware über Bildungsministerien in drei ostafrikanische Länder gebracht.',
      tags: [['institutional-sales', 5], ['intl-expansion', 5], ['market-ssa', 5], ['net-government', 4]],
      roles: 'lead_mentor,expert', hours: 4 },
    { email: 'martina.brunner@example.com', name: 'Martina Brunner', country: 'Schweiz', region: 'Europe',
      headline: 'Leiterin CSR, Industrieunternehmen; Stiftungsrätin', bio: 'Verantwortet Bildungsprojekte einer Unternehmensstiftung.',
      tags: [['sustainability', 4], ['strategy', 3], ['net-foundations', 5], ['net-corporates', 4]],
      roles: 'connector', hours: 2 },
    { email: 'kenji.tanaka@example.com', name: 'Kenji Tanaka', country: 'Singapur', region: 'Asia',
      headline: 'COO, Hardware-Scale-up', bio: 'Patente, Auftragsfertigung und Aufbau einer Holding in Singapur.',
      tags: [['ip-manufacturing', 5], ['operations', 4], ['product', 4], ['market-sea', 4], ['intl-expansion', 4]],
      roles: 'expert', hours: 2 },
  ];
  for (const m of alumni3) {
    const id = addUser({
      email: m.email, name: m.name, role: 'mentor', country: m.country, region: m.region,
      headline: m.headline, bio: m.bio, languages: 'en', avatar: m.name, ago: '-1 months',
    });
    mentorIds[m.email] = id;
    const u = findUser(id)!;
    u.support_roles = m.roles;
    u.capacity_hours = m.hours;
    u.available = 1;
    for (const [slug, w] of m.tags) addTagIfMissing(id, slug, w);
  }

  const sunita = addUser({
    email: 'sunita.rai@example.com', name: 'Sunita Rai', role: 'entrepreneur', country: 'Nepal', region: 'South Asia',
    headline: 'Gründerin, Hardware-EdTech (fiktive Persona)',
    bio: 'Patentiertes Lerngerät für Schulen, in Nepal bewährt. Nächster Schritt: Operations in Indien, Kenia oder Bangladesch – über Institutionen der Bildungsentwicklung. Teilt gerne eigene Gründungserfahrung.',
    languages: 'en', avatar: 'Sunita Rai', ago: '-20 days',
  });
  entIds['sunita.rai@example.com'] = sunita;
  findUser(sunita)!.offers_peer_support = 1;
  for (const [slug, w] of [['intl-expansion', 5], ['institutional-sales', 4], ['product', 4], ['market-sa', 5], ['stage-growth', 3]] as [string, number][])
    addTagIfMissing(sunita, slug, w);

  // Support-Journey-Fall im Matching: Der Matching Brief bildet das gewuenschte
  // Mentor:innen-Profil ab (institutioneller Vertrieb, Entwicklungsorganisationen,
  // Expansion physischer Produkte, IP/Fertigung).
  addProfile(sunita, 'venture_scaler',
    { target_markets: 'Indien, Kenia, Bangladesch', setting: 'mixed', conditions: ['regulation', 'capital_access'], conditions_note: 'Kein Vorbild eines nepalesischen Hardware-Produkts mit Operations im Ausland.' },
    { existing_support: ['informal_network'], access_quality: '2', gaps: 'Kaum Zugang zu Stiftungen, CSR-Programmen und Entwicklungsorganisationen.' },
    { sector: 'EdTech (Hardware)', business_model: 'Verkauf an Schulen und Bildungsprogramme (B2G/B2B)', stage: 'growth', employees: '11-50', revenue: '100k-1m' },
    { experience: '3-5', prior_programs: 'yes', hours_per_month: '4-8', languages: ['en'], mode: 'online', strengths: 'Patent, Produkt im Heimmarkt bewiesen' },
    '-6 days');
  const c6 = addCase({
    eem: sunita, coord: admin, step: 'matching', decision: 'accepted',
    motivation: 'Wir möchten Operations in einem zweiten Land aufbauen und dafür mit Institutionen arbeiten, die Bildungsentwicklungsprojekte umsetzen.',
    expectations: 'Begleitung über 6 Monate; Fokus auf Markteintritt über Institutionen und Fertigung.',
    consent: '-1 days', reason: null, note: null, created: '-12 days', updated: '-1 days',
  });
  addNeed(c6, {
    goal: 'Operations in einem zweiten Land über Bildungsinstitutionen aufbauen',
    bottleneck: 'Kein Zugang zu Entwicklungsorganisationen; keine Erfahrung im institutionellen Vertrieb im Ausland',
    support: 'Erfahrung im Verkauf physischer Produkte an Institutionen und in der Zusammenarbeit mit Entwicklungsorganisationen',
    criterion: 'Zwei qualifizierte Gespräche mit Institutionen im Zielland; Entscheid für ein Zielland',
    r: 3, u: 3, i: 3, s: 3, f: 2, rank: 1, ago: '-5 days', by: sunita,
    tags: ['institutional-sales', 'intl-expansion', 'market-sa', 'net-ngo'],
    plan: [['mentoring', 'Lead Mentor:in mit Erfahrung in B2G-Expansion'], ['introductions', 'Intros zu Alumni in Stiftungen/CSR'], ['stage', 'Pitch & Learn im Online Alumni Chapter']],
    brief: ['lead_mentor', 'Verkauf physischer Produkte an Institutionen; Expansion in andere Emerging Markets', 'Südasien oder Ostafrika', 'Entwicklungsorganisationen, Stiftungen/CSR', 'en', '6 Monate', 'online, zweiwöchentlich'],
  });
  addNeed(c6, {
    goal: 'Fertigung für mehrere Märkte skalieren und IP absichern',
    bottleneck: 'Patent nur national; Fertigung lokal und manuell',
    support: 'Fachexpertise IP und Skalierung der Fertigung', criterion: 'Fertigungs- und IP-Plan für ein Zielland',
    r: 3, u: 2, i: 3, s: 2, f: 2, rank: 2, ago: '-5 days', by: sunita,
    tags: ['ip-manufacturing', 'operations'],
    plan: [['skills', 'Sparring IP & Auftragsfertigung']],
    brief: ['expert', 'IP-Strategie und Auftragsfertigung', 'Asien', '', 'en', '3 Monate', 'online, punktuell'],
  });
  steps(c6, admin, [
    ['intake', 'Aufnahmeantrag', '-12 days'], ['assessment', 'Aufnahme bestätigt', '-11 days'],
    ['prioritization', 'Profil validiert', '-6 days'], ['support_plan', 'Zwei Bedarfe priorisiert', '-4 days'],
    ['matching', 'Supportplan bestätigt', '-1 days'],
  ]);

  // Online Alumni Chapter (Community of Practice) mit Pitch-&-Learn-Formaten.
  const chapterId = nextId('communities');
  S.communities.push({
    id: chapterId, slug: 'online-alumni-chapter', name_de: 'Online Alumni Chapter', name_en: 'Online Alumni Chapter',
    description_de: 'Ortsunabhängiges Chapter für Fellows und Alumni: Pitch & Learn, Peer-Austausch zwischen Entrepreneurs aus Emerging Markets und Give-back.',
    description_en: 'Location-independent chapter for fellows and alumni: pitch & learn, peer exchange between emerging-market entrepreneurs and give-back.',
    tag_id: tagId['intl-expansion'], created_at: ago('-3 months'),
  });
  addMember(chapterId, admin, 'moderator');
  for (const m of [sunita, M('martina.brunner@example.com'), M('priya.nair@example.com'), M('daniel.kiprop@example.com'),
    M('kenji.tanaka@example.com'), E('ravi.patel@example.com'), E('kwame.mensah@example.com'), M('anna.keller@example.com')]) addMember(chapterId, m, 'member');
  const addCPost = (author: number, body: string, a: string) =>
    S.community_posts.push({ id: nextId('community_posts'), community_id: chapterId, author_id: author, body, created_at: ago(a) });
  addCPost(sunita, 'Hallo zusammen! Unser Lerngerät ist in Nepal erprobt und patentiert. Wer hat Erfahrung damit, über Stiftungen oder Bildungsprogramme in einen neuen Markt zu gehen?', '-4 days');
  addCPost(M('priya.nair@example.com'), 'Sunita, Entwicklungsorganisationen beschaffen meist über Rahmenverträge. Frühzeitig klären: Zertifizierungen, Lieferfähigkeit, Referenzprojekte. Gerne mehr in deiner Session.', '-3 days');
  addCPost(M('kenji.tanaka@example.com'), 'Wir haben unsere Holding in Singapur aufgebaut – Zugang zu Kapital und IP-Schutz war dort deutlich einfacher. Ich biete dazu eine Peer Session an.', '-2 days');
  // starts_at entspricht strftime('%Y-%m-%d 15:00', 'now', when)
  const addSession = (host: number, title: string, desc: string, format: string, when: string) => {
    const sid = nextId('community_sessions');
    S.community_sessions.push({
      id: sid, community_id: chapterId, host_id: host, title, description: desc, format,
      starts_at: dateAt(when) + ' 15:00', created_at: ago('-10 days'),
    });
    return sid;
  };
  const addAttendee = (sid: number, uid: number) => {
    if (!S.session_attendees.some((x) => x.session_id === sid && x.user_id === uid)) S.session_attendees.push({ session_id: sid, user_id: uid });
  };
  const pitchSid = addSession(sunita, 'Pitch & Learn: Lernhardware über Bildungsinstitutionen skalieren',
    'Sunita stellt ihr Produkt vor und lernt von Alumni aus Stiftungen und CSR, wie diese neue Innovationen übernehmen.', 'pitch_learn', '+12 days');
  for (const a of [sunita, M('martina.brunner@example.com'), M('priya.nair@example.com')]) addAttendee(pitchSid, a);
  const sgSid = addSession(M('kenji.tanaka@example.com'), 'Singapur als Unternehmensbasis für Emerging-Market-Ventures',
    'Peer Session: Holding, Banking, IP – Erfahrungen und Fallstricke.', 'peer_session', '+20 days');
  addAttendee(sgSid, sunita);
  S.session_requests.push({
    id: nextId('session_requests'), community_id: chapterId, requester_id: E('ravi.patel@example.com'),
    title: 'Pitch & Learn: Telemedizin für ländliche Kliniken',
    description: 'Kurzvorstellung und Diskussion, wie Gesundheitsstiftungen Pilotprojekte auswählen.',
    audience: 'Alumni aus Gesundheitsstiftungen und CSR', preferred_date: dateAt('+25 days'),
    status: 'pending', session_id: null, created_at: ago('-1 days'),
  });

  // Intro-Anfragen (Warm Introductions mit stars-Empfehlung).
  const addIntro = (requester: number, target: string, purpose: string, status: string, supporter: number | null,
                    vouch: string | null, created: string, updated: string, tags: string[]) => {
    const id = nextId('intro_requests');
    S.intro_requests.push({
      id, requester_id: requester, target_profile: target, purpose, status, supporter_id: supporter,
      vouch_note: vouch, response_note: null, conversation_id: null, created_at: ago(created), updated_at: ago(updated),
    });
    for (const t of tags) S.intro_request_tags.push({ intro_id: id, tag_id: tagId[t] });
    return id;
  };
  addIntro(sunita, 'Alumni, die in oder mit Stiftungen bzw. CSR-Programmen mit Bildungsfokus arbeiten',
    'Erfindung vorstellen und verstehen, wie Stiftungen neue Bildungsprojekte auswählen und übernehmen.', 'requested', null, null, '-2 days', '-2 days',
    ['net-foundations', 'net-ngo', 'institutional-sales', 'market-sa']);
  addIntro(E('omar.haddad@example.com'), 'Investor:in mit Erfahrung in EdTech im MENA-Raum',
    'Feedback zum Pitch und Einschätzung der Finanzierungsstrategie vor der ersten Runde.', 'proposed', M('anna.keller@example.com'),
    'Omar ist seit einem Monat Fellow; sein Team hat eine funktionierende Lernplattform mit zahlenden Schulen. stars kennt ihn aus dem Aufnahmegespräch und empfiehlt ein kurzes Kennenlernen.', '-5 days', '-1 days',
    ['financing', 'net-investors', 'market-mena']);
  const seedNotif = (uid: number, type: string, title: string, body: string, link: string, a: string) =>
    S.notifications.push({ id: nextId('notifications'), user_id: uid, type, title, body, link, read_at: null, created_at: ago(a) });
  seedNotif(M('anna.keller@example.com'), 'match', 'stars möchte dich Omar Haddad vorstellen', 'Investor:in mit Erfahrung in EdTech im MENA-Raum', '/network', '-1 days');
  seedNotif(admin, 'system', 'Neue Intro-Anfrage', 'Sunita Rai: Alumni in Stiftungen/CSR mit Bildungsfokus', '/network', '-2 days');

  // Veranstaltungen von stars (Termine gemaess stars, Stand Oktober 2026).
  const ev: Record<string, number> = {};
  const eventData: [string, string, string, string, string, string, string, string, string][] = [
    ['india-2027', 'study_tour', 'stars India Study Tour', 'stars India Study Tour', 'Mumbai, Pune, Bengaluru (in Partnerschaft mit Tata)', '2027-01-17', '2027-01-23',
      'Studienreise zu Unternehmen und Gründer:innen in drei indischen Wirtschaftszentren.', 'Study tour to companies and founders in three Indian business hubs.'],
    ['bulgaria-2027', 'study_tour', 'stars Bulgaria Study Tour', 'stars Bulgaria Study Tour', 'Sofia', '2027-05-06', '2027-05-09',
      'Studienreise in das Tech- und Start-up-Ökosystem von Sofia.', 'Study tour to the Sofia tech and start-up ecosystem.'],
    ['singapore-2027', 'symposium', 'stars Singapore Symposium', 'stars Singapore Symposium', 'Singapur', '2027-06-23', '2027-06-26',
      'Symposium für Leaders of the Next Generation in Asien.', 'Symposium for Leaders of the Next Generation in Asia.'],
    ['switzerland-2027', 'symposium', 'stars Switzerland Symposium', 'stars Switzerland Symposium', 'Wolfsberg, Ermatingen', '2027-09-03', '2027-09-06',
      'Symposium am Bodensee mit Fellows, Alumni und Partnern.', 'Symposium at Lake Constance with fellows, alumni and partners.'],
  ];
  for (const [slug, kind, de, en, loc, from, to, dde, den] of eventData) {
    const id = nextId('events');
    S.events.push({
      id, slug, kind, title_de: de, title_en: en, location: loc, starts_on: from, ends_on: to,
      description_de: dde, description_en: den, url: 'https://www.the-stars.ch',
    });
    ev[slug] = id;
  }
  const addReg = (eventId: number, uid: number, scholarship: number, motivation: string | null, status: string, a: string) =>
    S.event_registrations.push({ event_id: eventId, user_id: uid, scholarship, motivation, status, created_at: ago(a) });
  addReg(ev['singapore-2027'], sunita, 1, 'Ohne Firmensponsoring kann ich die Teilnahme nicht finanzieren. Das Symposium wäre der Zugang zu Partnern für den Aufbau einer Unternehmensbasis in Singapur.', 'requested', '-3 days');
  addReg(ev['india-2027'], E('amara.okafor@example.com'), 0, null, 'interested', '-6 days');
  addReg(ev['india-2027'], E('ravi.patel@example.com'), 1, 'Austausch mit indischen HealthTech-Unternehmen und potenziellen Partnern vor Ort.', 'waitlist', '-9 days');
  seedNotif(admin, 'system', 'Antrag auf Förderplatz', 'Sunita Rai: stars Singapore Symposium', '/events', '-3 days');

  // 7) Start-Benachrichtigung -------------------------------------------
  S.notifications.push({
    id: nextId('notifications'), user_id: entIds['amara.okafor@example.com'], type: 'system',
    title: 'Willkommen bei stars', body: 'Dein Konto wurde erfolgreich erstellt.',
    link: '/dashboard', read_at: null, created_at: ago('-1 days'),
  });

  save();
}

// ---------------------------------------------------------------------------
// Helfer (Portierung von server/src/helpers.js und db.js)
// ---------------------------------------------------------------------------
function orderPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

function publicUser(u: Row | undefined | null) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    country: u.country,
    region: u.region,
    headline: u.headline,
    bio: u.bio,
    languages: u.languages ? String(u.languages).split(',') : [],
    avatar_seed: u.avatar_seed || u.name,
    support_roles: u.support_roles ? String(u.support_roles).split(',') : [],
    capacity_hours: u.capacity_hours ?? null,
    available: u.available === undefined ? true : !!u.available,
    offers_peer_support: !!u.offers_peer_support,
  };
}

// Verknuepfungstabellen liefert SQLite ueber den zusammengesetzten Primaerschluessel,
// d.h. sortiert nach tag_id (relevant bei Gleichstand, z.B. gleichem Gewicht).
const byTagId = (a: Row, b: Row) => a.tag_id - b.tag_id;

function tagById(id: number) {
  return S.tags.find((t) => t.id === id);
}

function userTags(userId: number) {
  return S.user_tags
    .filter((ut) => ut.user_id === userId)
    .map((ut) => {
      const t = tagById(ut.tag_id)!;
      return { id: t.id, slug: t.slug, name_de: t.name_de, name_en: t.name_en, category: t.category, weight: ut.weight };
    })
    .sort((a, b) => b.weight - a.weight || a.id - b.id);
}

function notify(userId: number, n: { type: string; title: string; body?: string | null; link?: string | null }) {
  S.notifications.push({
    id: nextId('notifications'), user_id: userId, type: n.type, title: n.title,
    body: n.body ?? null, link: n.link ?? null, read_at: null, created_at: now(),
  });
}

function findUser(id: number) {
  return S.users.find((u) => u.id === id);
}

// ---------------------------------------------------------------------------
// Matching-Logik (identische Portierung von server/src/matching.js)
// ---------------------------------------------------------------------------
const WEIGHTS = { coverage: 0.55, expertise: 0.30, market: 0.15 };
const MARKET_CATEGORIES = new Set(['market']);

function scoreMentor(questionTags: Row[], mentorTags: Row[]) {
  const mentorById = new Map(mentorTags.map((t) => [t.id, t]));

  const domainQ = questionTags.filter((t) => !MARKET_CATEGORIES.has(t.category));
  const marketQ = questionTags.filter((t) => MARKET_CATEGORIES.has(t.category));

  const matchedDomain = domainQ.filter((t) => mentorById.has(t.id));
  const matchedMarket = marketQ.filter((t) => mentorById.has(t.id));
  const matchedTagIds = [...matchedDomain, ...matchedMarket].map((t) => t.id);

  const coverage = domainQ.length ? matchedDomain.length / domainQ.length : 0;
  const expertise = matchedDomain.length
    ? matchedDomain.reduce((sum, t) => sum + (mentorById.get(t.id)!.weight || 3), 0) / (matchedDomain.length * 5)
    : 0;
  const market = marketQ.length === 0 ? 0.5 : matchedMarket.length / marketQ.length;

  const raw = WEIGHTS.coverage * coverage + WEIGHTS.expertise * expertise + WEIGHTS.market * market;

  return {
    score: Math.round(raw * 1000) / 10,
    coverage: Math.round(coverage * 100),
    expertise: Math.round(expertise * 100),
    market: Math.round(market * 100),
    matchedTagIds,
  };
}

function questionTagRows(qid: number) {
  return S.question_tags
    .filter((qt) => qt.question_id === qid)
    .sort(byTagId)
    .map((qt) => tagById(qt.tag_id))
    .filter(Boolean) as Row[];
}

function rankMentors(questionId: number, limit = 5) {
  const question = S.questions.find((q) => q.id === questionId);
  if (!question) return [] as Row[];

  const qTags = questionTagRows(questionId);
  const tagName = new Map(qTags.map((t) => [t.id, { de: t.name_de, en: t.name_en }]));

  return S.users
    .filter((u) => u.role === 'mentor' && u.id !== question.asker_id)
    .map((m) => {
      const mTags = S.user_tags
        .filter((ut) => ut.user_id === m.id)
        .map((ut) => ({ id: ut.tag_id, category: tagById(ut.tag_id)!.category, weight: ut.weight }));
      const result = scoreMentor(qTags, mTags);
      return {
        mentor: { id: m.id, name: m.name, country: m.country, region: m.region, headline: m.headline, avatar_seed: m.avatar_seed },
        ...result,
        matchedTags: result.matchedTagIds.map((id) => tagName.get(id)).filter(Boolean),
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function computeMatches(questionId: number, limit = 5) {
  const scored = rankMentors(questionId, limit);
  const question = S.questions.find((q) => q.id === questionId);

  for (const r of scored) {
    const existing = S.matches.find((m) => m.question_id === questionId && m.mentor_id === r.mentor.id);
    if (existing) existing.score = r.score;
    else S.matches.push({
      id: nextId('matches'), question_id: questionId, mentor_id: r.mentor.id,
      score: r.score, status: 'suggested', created_at: now(),
    });
  }
  if (scored.length && question && question.status === 'open') question.status = 'matched';
  return scored;
}

// --- Iteration 2: rollendifferenziertes Matching auf Basis des Matching Briefs
// (identische Portierung von scoreSupporter/rankSupporters aus server/src/matching.js)
const SUPPORT_WEIGHTS = { expertise: 0.45, context: 0.15, network: 0.15, language: 0.1, capacity: 0.15 };
const ROLE_HOURS: Record<string, number> = { lead_mentor: 4, expert: 2, connector: 1 };
const NEUTRAL = 0.5;

function scoreSupporter(
  need: { tags: Row[]; role: string; language?: string | null },
  supporter: { tags: Row[]; languages: string[]; capacity_hours: number | null; available: boolean; support_roles: string[] },
) {
  const byId = new Map(supporter.tags.map((t) => [t.id, t]));
  const domainQ = need.tags.filter((t) => t.category !== 'market' && t.category !== 'network');
  const marketQ = need.tags.filter((t) => t.category === 'market');
  const networkQ = need.tags.filter((t) => t.category === 'network');

  const hitDomain = domainQ.filter((t) => byId.has(t.id));
  const hitMarket = marketQ.filter((t) => byId.has(t.id));
  const hitNetwork = networkQ.filter((t) => byId.has(t.id));

  const coverage = domainQ.length ? hitDomain.length / domainQ.length : NEUTRAL;
  const depth = hitDomain.length
    ? hitDomain.reduce((s, t) => s + (byId.get(t.id)!.weight || 3), 0) / (hitDomain.length * 5)
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

  const roleOk = !supporter.support_roles.length || supporter.support_roles.includes(need.role);
  const substantive =
    hitDomain.length > 0 || (need.role === 'connector' && hitNetwork.length > 0) ||
    (domainQ.length === 0 && (hitMarket.length > 0 || hitNetwork.length > 0));
  const eligible = roleOk && supporter.available && substantive;

  const pct = (v: number) => Math.round(v * 100);
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

function rankSupporters(needId: number, limit = 6) {
  const need = S.needs.find((n) => n.id === needId);
  const c = need ? S.cases.find((x) => x.id === need.case_id) : null;
  if (!need || !c) return [] as Row[];
  const brief = S.matching_briefs.find((b) => b.need_id === needId);
  const nTags = S.need_tags
    .filter((nt) => nt.need_id === needId)
    .sort(byTagId)
    .map((nt) => tagById(nt.tag_id))
    .filter(Boolean)
    .map((t) => ({ id: t!.id, category: t!.category, name_de: t!.name_de, name_en: t!.name_en }));
  const role = brief?.main_role || 'expert';
  const tagName = new Map(nTags.map((t) => [t.id, { de: t.name_de, en: t.name_en }]));

  // Aktuelle Auslastung: bestaetigte oder offene Einladungen in nicht
  // abgeschlossenen Faellen.
  const loadOf = (sid: number) =>
    S.case_matches.filter((cm) => {
      if (cm.supporter_id !== sid || cm.status === 'declined') return false;
      const n = S.needs.find((x) => x.id === cm.need_id);
      const cc = n ? S.cases.find((x) => x.id === n.case_id) : null;
      return !!cc && cc.step !== 'closed';
    }).length;

  return S.users
    .filter((u) => u.role === 'mentor' && u.id !== c.eem_id)
    .map((s) => {
      const sup = {
        tags: S.user_tags
          .filter((ut) => ut.user_id === s.id)
          .map((ut) => ({ id: ut.tag_id, category: tagById(ut.tag_id)!.category, weight: ut.weight })),
        languages: s.languages ? String(s.languages).split(',') : [],
        capacity_hours: s.capacity_hours ?? null,
        available: s.available === null || s.available === undefined ? true : !!s.available,
        support_roles: s.support_roles ? String(s.support_roles).split(',') : [],
      };
      const r = scoreSupporter({ tags: nTags, role, language: brief?.language || null }, sup);
      return {
        supporter: {
          id: s.id, name: s.name, country: s.country, region: s.region, headline: s.headline,
          avatar_seed: s.avatar_seed, languages: sup.languages, capacity_hours: s.capacity_hours ?? null,
          support_roles: sup.support_roles,
        },
        role,
        eligible: r.eligible,
        score: r.score,
        components: r.components,
        matchedTags: r.matchedTagIds.map((id) => tagName.get(id)).filter(Boolean),
        active_load: loadOf(s.id),
      };
    })
    .filter((r) => r.eligible)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Domaenenlogik der Support Journey (Portierung von server/src/journey.js)
// ---------------------------------------------------------------------------
const STEPS = [
  'intake', 'assessment', 'prioritization', 'support_plan', 'matching',
  'agreement', 'implementation', 'reassessment',
];
const FORMATS = [
  'mentoring', 'skills', 'education', 'knowledge_sharing',
  'introductions', 'partnerships', 'projects', 'stage',
];
// Formate ohne einzelne Unterstuetzungsperson (laufen ueber Bibliothek bzw. Community).
const SELF_SERVE_FORMATS = new Set(['education', 'knowledge_sharing']);
const ROLES = ['lead_mentor', 'expert', 'connector'];

function parseJson(s: any): Row {
  try {
    const v = JSON.parse(s || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

const filled = (obj: Row) =>
  Object.values(obj).some((v) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && String(v).trim() !== ''));

function profileOf(userId: number) {
  const p = S.eem_profiles.find((x) => x.user_id === userId);
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

function prioritizedNeeds(caseId: number, cycle: number) {
  return S.needs
    .filter((n) => n.case_id === caseId && n.cycle === cycle && n.priority_rank != null && n.status !== 'dropped')
    .sort((a, b) => cmp(a.priority_rank, b.priority_rank));
}

const msg = (code: string, de: string, en: string) => ({ code, de, en });
const formatsOf = (needId: number) => S.plan_items.filter((p) => p.need_id === needId).map((p) => p.format);

/** Prueft, ob der Output des aktuellen Schritts vorliegt (verbindliche Uebergabe). */
function handoverCheck(c: Row) {
  const missing: { code: string; de: string; en: string }[] = [];
  const idx = STEPS.indexOf(c.step);
  const next = idx >= 0 && idx < STEPS.length - 1 ? STEPS[idx + 1] : null;
  const needs = prioritizedNeeds(c.id, c.cycle);

  switch (c.step) {
    case 'intake':
      if (c.intake_decision !== 'accepted')
        missing.push(msg('intake_decision', 'Aufnahmeentscheid durch stars', 'Intake decision by stars'));
      break;
    case 'assessment': {
      const p = profileOf(c.eem_id) as Row | null;
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
        const items = formatsOf(n.id);
        if (!items.length) missing.push(msg(`need_${n.id}_plan`, `Formate für «${n.goal}»`, `Formats for “${n.goal}”`));
        const needsPerson = items.some((f) => !SELF_SERVE_FORMATS.has(f));
        const brief = S.matching_briefs.some((b) => b.need_id === n.id);
        if (needsPerson && !brief)
          missing.push(msg(`need_${n.id}_brief`, `Matching Brief für «${n.goal}»`, `Matching brief for “${n.goal}”`));
      }
      if (!c.plan_consent_at)
        missing.push(msg('plan_consent', 'Zustimmung des EEM zum Supportplan', 'EEM consent to support plan'));
      break;
    case 'matching':
      for (const n of needs) {
        const needsPerson = formatsOf(n.id).some((f) => !SELF_SERVE_FORMATS.has(f));
        const confirmed = S.case_matches.some((cm) => cm.need_id === n.id && cm.status === 'confirmed');
        if (needsPerson && !confirmed)
          missing.push(msg(`need_${n.id}_match`, `Bestätigter Match für «${n.goal}»`, `Confirmed match for “${n.goal}”`));
      }
      break;
    case 'agreement':
      for (const n of needs) {
        const a = S.agreements.find((x) => x.need_id === n.id);
        if (!a) missing.push(msg(`need_${n.id}_agreement`, `Vereinbarung mit Review-Termin für «${n.goal}»`, `Agreement with review date for “${n.goal}”`));
      }
      break;
    case 'implementation': {
      // Fortschritt muss im aktuellen Umsetzungszyklus dokumentiert sein.
      const stepTimes = S.case_events
        .filter((e) => e.case_id === c.id && e.type === 'step' && e.step === 'implementation')
        .map((e) => e.created_at)
        .sort();
      const since = stepTimes.length ? stepTimes[stepTimes.length - 1] : c.created_at;
      const progress = S.case_events.some((e) => e.case_id === c.id && e.type === 'progress' && e.created_at >= since);
      if (!progress)
        missing.push(msg('progress', 'Mindestens ein dokumentierter Fortschritt', 'At least one documented progress note'));
      break;
    }
    case 'reassessment':
      for (const n of needs) {
        const r = S.reviews.some((x) => x.need_id === n.id);
        if (!r) missing.push(msg(`need_${n.id}_review`, `Re-Assessment für «${n.goal}»`, `Re-assessment for “${n.goal}”`));
      }
      break;
    default:
      break;
  }
  return { next, missing, canAdvance: !!next && missing.length === 0 };
}

function logEvent(caseId: number, userId: number | null, type: string, step: string | null, body: string | null = null) {
  S.case_events.push({ id: nextId('case_events'), case_id: caseId, user_id: userId, type, step, body, created_at: now() });
}

function setStep(caseId: number, step: string, userId: number, note: string | null = null) {
  const c = S.cases.find((x) => x.id === caseId)!;
  c.step = step;
  c.updated_at = now();
  logEvent(caseId, userId, 'step', step, note);
}

// ---------------------------------------------------------------------------
// Mini-Router
// ---------------------------------------------------------------------------
class HttpError extends Error {
  status: number;
  extra?: Row;
  /** extra: zusaetzliche Felder der Fehlerantwort (z.B. caseId, missing). */
  constructor(status: number, message: string, extra?: Row) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

interface Ctx {
  params: Record<string, string>;
  query: URLSearchParams;
  body: any;
  user: { id: number; role: string; name: string } | null;
}

type Handler = (ctx: Ctx) => any;

const routes: { method: string; re: RegExp; keys: string[]; auth: boolean; handler: Handler }[] = [];

function on(method: string, path: string, auth: boolean, handler: Handler) {
  const keys: string[] = [];
  const re = new RegExp(
    '^' + path.replace(/:[A-Za-z_]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$'
  );
  routes.push({ method, re, keys, auth, handler });
}

// --- Token (Demo: Base64 statt signiertem JWT) ------------------------------
function signToken(user: Row): string {
  const payload = JSON.stringify({ id: user.id, role: user.role, name: user.name });
  return 'demo.' + btoa(String.fromCharCode(...new TextEncoder().encode(payload)));
}
function verifyToken(token: string | null) {
  if (!token || !token.startsWith('demo.')) return null;
  try {
    const bin = atob(token.slice(5));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Endpunkte (1:1 zu server/src/routes/**)
// ---------------------------------------------------------------------------

// --- health ---
on('GET', '/health', false, () => ({ status: 'ok', ts: new Date().toISOString() }));

// --- auth ---
on('POST', '/auth/register', false, ({ body }) => {
  const { email, password, name, role, country, region, headline, bio, languages } = body || {};
  if (!email || !password || !name || !role) throw new HttpError(400, 'email, password, name und role sind erforderlich');
  // Admin-Konten entstehen nur ueber den Seed, nie per Selbstregistrierung.
  if (!['entrepreneur', 'mentor'].includes(role)) throw new HttpError(400, 'Ungültige Rolle');
  if (S.users.some((u) => u.email === email)) throw new HttpError(409, 'E-Mail bereits registriert');

  const user = {
    id: nextId('users'), email, password_hash: password, name, role,
    country: country || null, region: region || null, headline: headline || null, bio: bio || null,
    languages: Array.isArray(languages) ? languages.join(',') : languages || 'en',
    avatar_seed: name, support_roles: null, capacity_hours: null, available: 1, offers_peer_support: 0, created_at: now(),
  };
  S.users.push(user);
  return { status: 201, data: { token: signToken(user), user: publicUser(user) } };
});

on('POST', '/auth/login', false, ({ body }) => {
  const { email, password } = body || {};
  const user = S.users.find((u) => u.email === email);
  if (!user || user.password_hash !== (password || '')) throw new HttpError(401, 'E-Mail oder Passwort falsch');
  return { token: signToken(user), user: publicUser(user) };
});

on('GET', '/auth/me', true, ({ user }) => {
  const u = findUser(user!.id);
  if (!u) throw new HttpError(404, 'Nutzer nicht gefunden');
  return { user: publicUser(u), tags: userTags(u.id) };
});

on('PATCH', '/auth/me', true, ({ user, body }) => {
  const u = findUser(user!.id)!;
  const { name, country, region, headline, bio, languages, support_roles, capacity_hours, available,
    offers_peer_support } = body || {};
  // Iteration 2: Unterstuetzer-Merkmale (Rollen, Kapazitaet, Verfuegbarkeit); COALESCE-Semantik wie im Server.
  const roles = Array.isArray(support_roles)
    ? support_roles.filter((r: string) => ['lead_mentor', 'expert', 'connector'].includes(r)).join(',')
    : null;
  const capacity =
    capacity_hours === undefined || capacity_hours === null || capacity_hours === ''
      ? null
      : Math.max(0, Math.min(80, Number(capacity_hours) || 0));
  if (name != null) u.name = name;
  if (country != null) u.country = country;
  if (region != null) u.region = region;
  if (headline != null) u.headline = headline;
  if (bio != null) u.bio = bio;
  if (languages != null) u.languages = Array.isArray(languages) ? languages.join(',') : languages;
  if (roles !== null) u.support_roles = roles;
  if (capacity !== null) u.capacity_hours = capacity;
  if (available !== undefined) u.available = available ? 1 : 0;
  if (offers_peer_support !== undefined) u.offers_peer_support = offers_peer_support ? 1 : 0;
  return { user: publicUser(u), tags: userTags(u.id) };
});

on('PUT', '/auth/me/tags', true, ({ user, body }) => {
  const { tags } = body || {};
  if (!Array.isArray(tags)) throw new HttpError(400, 'tags-Array erwartet');
  S.user_tags = S.user_tags.filter((ut) => ut.user_id !== user!.id);
  for (const t of tags) {
    if (S.user_tags.some((ut) => ut.user_id === user!.id && ut.tag_id === t.tag_id)) continue;
    S.user_tags.push({ user_id: user!.id, tag_id: t.tag_id, weight: Math.min(5, Math.max(1, t.weight || 3)) });
  }
  return { tags: userTags(user!.id) };
});

// --- tags ---
on('GET', '/tags', false, () => ({
  tags: [...S.tags].sort((a, b) => (a.category < b.category ? -1 : a.category > b.category ? 1
    : a.name_de < b.name_de ? -1 : 1)),
}));

// --- forums (Saeule 1) ---
on('GET', '/forums', false, () => ({
  forums: [...S.forums]
    .sort((a, b) => a.sort_order - b.sort_order || (a.title_de < b.title_de ? -1 : 1))
    .map((f) => {
      const th = S.threads.filter((t) => t.forum_id === f.id);
      return {
        ...f,
        thread_count: th.length,
        last_activity: th.length ? th.map((t) => t.created_at).sort().slice(-1)[0] : null,
      };
    }),
}));

on('GET', '/forums/threads/:threadId', false, ({ params }) => {
  const thread = S.threads.find((t) => t.id === Number(params.threadId));
  if (!thread) throw new HttpError(404, 'Thread nicht gefunden');
  const a = findUser(thread.author_id)!;
  const comments = S.comments
    .filter((c) => c.thread_id === thread.id)
    .sort((x, y) => (x.created_at < y.created_at ? -1 : x.created_at > y.created_at ? 1 : x.id - y.id))
    .map((c) => {
      const cu = findUser(c.author_id)!;
      return {
        id: c.id, body: c.body, created_at: c.created_at, author_id: cu.id,
        author_name: cu.name, author_role: cu.role, author_avatar: cu.avatar_seed,
      };
    });
  return {
    thread: { ...thread, author_name: a.name, author_role: a.role, author_avatar: a.avatar_seed },
    comments,
  };
});

on('POST', '/forums/threads/:threadId/comments', true, ({ params, body, user }) => {
  if (!body?.body) throw new HttpError(400, 'body erforderlich');
  const thread = S.threads.find((t) => t.id === Number(params.threadId));
  if (!thread) throw new HttpError(404, 'Thread nicht gefunden');
  const comment = {
    id: nextId('comments'), thread_id: thread.id, author_id: user!.id,
    body: body.body, created_at: now(),
  };
  S.comments.push(comment);
  if (thread.author_id !== user!.id) {
    notify(thread.author_id, {
      type: 'comment',
      title: 'Neue Antwort auf deinen Beitrag',
      body: `${user!.name}: "${thread.title}"`,
      link: `/community/thread/${thread.id}`,
    });
  }
  return { status: 201, data: { comment } };
});

on('GET', '/forums/:id/threads', false, ({ params }) => {
  const forum = S.forums.find((f) => f.id === Number(params.id));
  if (!forum) throw new HttpError(404, 'Forum nicht gefunden');
  const threads = S.threads
    .filter((t) => t.forum_id === forum.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id))
    .map((t) => {
      const u = findUser(t.author_id)!;
      return {
        id: t.id, title: t.title, body: t.body, created_at: t.created_at,
        author_id: u.id, author_name: u.name, author_role: u.role, author_avatar: u.avatar_seed,
        comment_count: S.comments.filter((c) => c.thread_id === t.id).length,
      };
    });
  return { forum, threads };
});

on('POST', '/forums/:id/threads', true, ({ params, body, user }) => {
  const { title, body: text } = body || {};
  if (!title || !text) throw new HttpError(400, 'title und body erforderlich');
  const forum = S.forums.find((f) => f.id === Number(params.id));
  if (!forum) throw new HttpError(404, 'Forum nicht gefunden');
  const thread = {
    id: nextId('threads'), forum_id: forum.id, author_id: user!.id,
    title, body: text, created_at: now(),
  };
  S.threads.push(thread);
  return { status: 201, data: { thread } };
});

// --- questions (Saeule 2a) ---
function questionTagsPublic(qid: number) {
  return questionTagRows(qid).map((t) => ({
    id: t.id, slug: t.slug, name_de: t.name_de, name_en: t.name_en, category: t.category,
  }));
}

on('GET', '/questions', true, () => ({
  questions: [...S.questions]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id))
    .map((q) => {
      const u = findUser(q.asker_id)!;
      return { ...q, asker_name: u.name, asker_avatar: u.avatar_seed, asker_country: u.country, tags: questionTagsPublic(q.id) };
    }),
}));

on('POST', '/questions', true, ({ body, user }) => {
  const { title, body: text, tagIds } = body || {};
  if (!title || !text) throw new HttpError(400, 'title und body erforderlich');
  const question = {
    id: nextId('questions'), asker_id: user!.id, title, body: text,
    status: 'open', created_at: now(),
  };
  S.questions.push(question);
  if (Array.isArray(tagIds)) {
    for (const id of tagIds) {
      if (!S.question_tags.some((qt) => qt.question_id === question.id && qt.tag_id === Number(id))) {
        S.question_tags.push({ question_id: question.id, tag_id: Number(id) });
      }
    }
  }
  const matches = computeMatches(question.id, 5);
  for (const m of matches) {
    notify(m.mentor.id, {
      type: 'match',
      title: 'Passende Anfrage für dich',
      body: `${user!.name} sucht Expertise: "${title}"`,
      link: `/mentoring/question/${question.id}`,
    });
  }
  return { status: 201, data: { question: { ...question, tags: questionTagsPublic(question.id) }, matches } };
});

on('POST', '/questions/:id/rematch', true, ({ params }) => ({ matches: computeMatches(Number(params.id), 5) }));

on('POST', '/questions/:id/matches/:mentorId/accept', true, ({ params, user }) => {
  const qid = Number(params.id);
  const question = S.questions.find((q) => q.id === qid);
  if (!question) throw new HttpError(404, 'Frage nicht gefunden');
  if (question.asker_id !== user!.id) throw new HttpError(403, 'Nur die fragende Person kann annehmen');
  const mentorId = Number(params.mentorId);

  const match = S.matches.find((m) => m.question_id === qid && m.mentor_id === mentorId);
  if (match) match.status = 'accepted';
  question.status = 'resolved';

  const [low, high] = orderPair(user!.id, mentorId);
  let conv = S.conversations.find((c) => c.user_low === low && c.user_high === high);
  if (!conv) {
    conv = { id: nextId('conversations'), user_low: low, user_high: high, created_at: now() };
    S.conversations.push(conv);
  }
  notify(mentorId, {
    type: 'match',
    title: 'Deine Unterstützung wurde angenommen',
    body: `${user!.name} möchte mit dir zu "${question.title}" sprechen.`,
    link: `/messages/${conv.id}`,
  });
  return { conversationId: conv.id };
});

on('GET', '/questions/:id', true, ({ params }) => {
  const qid = Number(params.id);
  const q = S.questions.find((x) => x.id === qid);
  if (!q) throw new HttpError(404, 'Frage nicht gefunden');
  const u = findUser(q.asker_id)!;

  const persisted = new Map(S.matches.filter((m) => m.question_id === qid).map((m) => [m.mentor_id, m.status]));
  const matches = rankMentors(qid, 5).map((r: any) => ({
    mentor_id: r.mentor.id,
    mentor_name: r.mentor.name,
    headline: r.mentor.headline,
    country: r.mentor.country,
    region: r.mentor.region,
    avatar_seed: r.mentor.avatar_seed,
    score: r.score,
    coverage: r.coverage,
    expertise: r.expertise,
    market: r.market,
    matchedTags: r.matchedTags,
    status: persisted.get(r.mentor.id) || 'suggested',
  }));

  return {
    question: { ...q, asker_name: u.name, asker_avatar: u.avatar_seed, asker_country: u.country, tags: questionTagsPublic(qid) },
    matches,
  };
});

// --- mentors ---
on('GET', '/mentors', true, ({ query }) => {
  const tag = query.get('tag');
  // Seit Iteration 3 auch Entrepreneurs mit Opt-in (Peer-Expert:innen, FA-27); ORDER BY role DESC, name.
  let list = S.users
    .filter((u) => u.role === 'mentor' || (u.role === 'entrepreneur' && u.offers_peer_support === 1))
    .sort((a, b) => cmp(b.role, a.role) || cmp(a.name, b.name))
    .map((m) => ({ ...publicUser(m)!, tags: userTags(m.id) }));
  if (tag) list = list.filter((m) => m.tags.some((t) => t.slug === tag));
  return { mentors: list };
});

on('GET', '/mentors/:id', true, ({ params }) => {
  const u = findUser(Number(params.id));
  if (!u) throw new HttpError(404, 'Profil nicht gefunden');
  return { user: publicUser(u), tags: userTags(u.id) };
});

// --- messages (Saeule 2b) ---
on('GET', '/messages', true, ({ user }) => {
  const uid = user!.id;
  const conversations = S.conversations
    .filter((c) => c.user_low === uid || c.user_high === uid)
    .sort((a, b) => b.id - a.id)
    .map((c) => {
      const otherId = c.user_low === uid ? c.user_high : c.user_low;
      const msgs = S.messages.filter((m) => m.conversation_id === c.id).sort((a, b) => a.id - b.id);
      const last = msgs.length ? msgs[msgs.length - 1] : null;
      return {
        id: c.id,
        partner: publicUser(findUser(otherId)),
        lastMessage: last ? { body: last.body, sender_id: last.sender_id, created_at: last.created_at } : undefined,
        unread: msgs.filter((m) => m.sender_id !== uid && !m.read_at).length,
      };
    });
  return { conversations };
});

on('POST', '/messages/with/:userId', true, ({ params, user }) => {
  const otherId = Number(params.userId);
  if (otherId === user!.id) throw new HttpError(400, 'Nicht mit sich selbst');
  if (!findUser(otherId)) throw new HttpError(404, 'Nutzer nicht gefunden');
  const [low, high] = orderPair(user!.id, otherId);
  let conv = S.conversations.find((c) => c.user_low === low && c.user_high === high);
  if (!conv) {
    conv = { id: nextId('conversations'), user_low: low, user_high: high, created_at: now() };
    S.conversations.push(conv);
  }
  return { conversationId: conv.id };
});

on('POST', '/messages/:id/messages', true, ({ params, body, user }) => {
  const uid = user!.id;
  if (!body?.body) throw new HttpError(400, 'body erforderlich');
  const conv = S.conversations.find((c) => c.id === Number(params.id));
  if (!conv || (conv.user_low !== uid && conv.user_high !== uid)) throw new HttpError(404, 'Konversation nicht gefunden');
  const message = {
    id: nextId('messages'), conversation_id: conv.id, sender_id: uid,
    body: body.body, read_at: null, created_at: now(),
  };
  S.messages.push(message);
  const otherId = conv.user_low === uid ? conv.user_high : conv.user_low;
  notify(otherId, {
    type: 'message',
    title: `Neue Nachricht von ${user!.name}`,
    body: body.body.length > 80 ? body.body.slice(0, 80) + '…' : body.body,
    link: `/messages/${conv.id}`,
  });
  return { status: 201, data: { message } };
});

on('GET', '/messages/:id', true, ({ params, user }) => {
  const uid = user!.id;
  const conv = S.conversations.find((c) => c.id === Number(params.id));
  if (!conv || (conv.user_low !== uid && conv.user_high !== uid)) throw new HttpError(404, 'Konversation nicht gefunden');
  const otherId = conv.user_low === uid ? conv.user_high : conv.user_low;

  for (const m of S.messages) {
    if (m.conversation_id === conv.id && m.sender_id !== uid && !m.read_at) m.read_at = now();
  }
  const messages = S.messages.filter((m) => m.conversation_id === conv.id).sort((a, b) => a.id - b.id);
  return { partner: publicUser(findUser(otherId)), messages };
});

// --- learning (Saeule 3) ---
function moduleTags(id: number) {
  return S.module_tags
    .filter((mt) => mt.module_id === id)
    .sort(byTagId)
    .map((mt) => {
      const t = tagById(mt.tag_id)!;
      return { id: t.id, slug: t.slug, name_de: t.name_de, name_en: t.name_en, category: t.category };
    });
}

on('GET', '/learning', true, ({ user }) => ({
  modules: [...S.learning_modules]
    .sort((a, b) => (a.level < b.level ? -1 : a.level > b.level ? 1 : a.title_de < b.title_de ? -1 : 1))
    .map((m) => {
      const p = S.learning_progress.find((x) => x.user_id === user!.id && x.module_id === m.id);
      return { ...m, tags: moduleTags(m.id), progress: p?.progress ?? 0, completed: !!p?.completed };
    }),
}));

on('POST', '/learning/:id/progress', true, ({ params, body, user }) => {
  const progress = Math.min(100, Math.max(0, Number(body?.progress ?? 0)));
  const completed = progress >= 100 ? 1 : 0;
  const mid = Number(params.id);
  const existing = S.learning_progress.find((x) => x.user_id === user!.id && x.module_id === mid);
  if (existing) {
    existing.progress = progress;
    existing.completed = completed;
    existing.updated_at = now();
  } else {
    S.learning_progress.push({ user_id: user!.id, module_id: mid, progress, completed, updated_at: now() });
  }
  return { progress, completed: !!completed };
});

on('GET', '/learning/:id', true, ({ params, user }) => {
  const m = S.learning_modules.find((x) => x.id === Number(params.id));
  if (!m) throw new HttpError(404, 'Modul nicht gefunden');
  const p = S.learning_progress.find((x) => x.user_id === user!.id && x.module_id === m.id);
  return { module: { ...m, tags: moduleTags(m.id), progress: p?.progress ?? 0, completed: !!p?.completed } };
});

// --- dashboard ---
const caseOfNeed = (needId: number) => {
  const n = S.needs.find((x) => x.id === needId);
  return n ? S.cases.find((c) => c.id === n.case_id) : undefined;
};

// Iteration 2 (FA-21): Programm- und Outcome-Kennzahlen.
function programmeStats() {
  const funnel = [...STEPS, 'closed'].map((step) => ({
    step,
    n: S.cases.filter((c) => c.step === step).length,
  }));
  const reviewMix = Object.fromEntries(
    ['none', 'partial', 'achieved'].map((p) => [p, S.reviews.filter((r) => r.progress === p).length])
  );
  // Durchschnittliche Tage von der Fallanlage bis zum ersten bestaetigten Match (je Fall).
  const firstConfirmed = new Map<number, number | null>();
  for (const cm of S.case_matches) {
    if (cm.status !== 'confirmed') continue;
    const c = caseOfNeed(cm.need_id);
    if (!c) continue;
    const t = cm.confirmed_at ? julian(cm.confirmed_at) : null;
    const prev = firstConfirmed.has(c.id) ? firstConfirmed.get(c.id)! : null;
    firstConfirmed.set(c.id, t === null ? prev : prev === null ? t : Math.min(prev, t));
  }
  const diffs: number[] = [];
  for (const [cid, t] of firstConfirmed) {
    const c = S.cases.find((x) => x.id === cid)!;
    if (t !== null) diffs.push(t - julian(c.created_at));
  }
  const avg = diffs.length ? diffs.reduce((s, d) => s + d, 0) / diffs.length : null;

  const dueLimit = dateAt('+14 days');
  const reviewsDue = S.agreements
    .map((a) => {
      const n = S.needs.find((x) => x.id === a.need_id);
      const c = n ? S.cases.find((x) => x.id === n.case_id) : undefined;
      return { a, n, c };
    })
    .filter(({ a, n, c }) =>
      n && c && c.step !== 'closed' && a.review_date <= dueLimit &&
      !S.reviews.some((r) => r.need_id === a.need_id && r.created_at >= a.updated_at))
    .sort((x, y) => cmp(x.a.review_date, y.a.review_date))
    .map(({ a, n, c }) => ({
      need_id: a.need_id, review_date: a.review_date, goal: n!.goal, case_id: c!.id, eem_name: findUser(c!.eem_id)?.name,
    }));
  const outcomes = S.reviews
    .filter((r) => r.outcome != null)
    .sort((a, b) => cmp(b.created_at, a.created_at))
    .slice(0, 6)
    .map((r) => {
      const n = S.needs.find((x) => x.id === r.need_id)!;
      const c = S.cases.find((x) => x.id === n.case_id)!;
      return { progress: r.progress, outcome: r.outcome, created_at: r.created_at, goal: n.goal, case_id: c.id, eem_name: findUser(c.eem_id)?.name };
    });
  const nowMin = nowMinute();
  return {
    kpis: {
      cases_active: S.cases.filter((c) => !['closed', 'intake'].includes(c.step)).length,
      intake_pending: S.cases.filter((c) => c.step === 'intake' && c.intake_decision === 'pending').length,
      needs_prioritized: S.needs.filter((n) => {
        const c = S.cases.find((x) => x.id === n.case_id);
        return !!c && n.priority_rank != null && n.cycle === c.cycle && c.step !== 'closed';
      }).length,
      needs_achieved: S.needs.filter((n) => n.status === 'achieved').length,
      matches_confirmed: S.case_matches.filter((m) => m.status === 'confirmed').length,
      matches_pending: S.case_matches.filter((m) => m.status === 'invited').length,
      avg_days_to_match: avg == null ? 0 : Math.round(avg * 10) / 10,
      communities: S.communities.length,
      community_members: new Set(S.community_members.map((m) => m.user_id)).size,
      sessions_upcoming: S.community_sessions.filter((s) => s.starts_at >= nowMin).length,
    },
    funnel,
    reviewMix,
    reviewsDue,
    outcomes,
  };
}

on('GET', '/dashboard', true, ({ user }) => {
  const uid = user!.id;
  const role = user!.role;

  const unreadFor = (id: number) =>
    S.messages.filter((m) => {
      const c = S.conversations.find((x) => x.id === m.conversation_id);
      return c && (c.user_low === id || c.user_high === id) && m.sender_id !== id && !m.read_at;
    }).length;

  if (role === 'admin') {
    const byMonth: Record<string, number> = {};
    for (const u of S.users) {
      const month = String(u.created_at).slice(0, 7);
      byMonth[month] = (byMonth[month] || 0) + 1;
    }
    const growth = Object.keys(byMonth).sort().map((month) => ({ month, n: byMonth[month] }));
    return {
      role,
      kpis: {
        entrepreneurs: S.users.filter((u) => u.role === 'entrepreneur').length,
        mentors: S.users.filter((u) => u.role === 'mentor').length,
        forums: S.forums.length,
        threads: S.threads.length,
        comments: S.comments.length,
        questions_open: S.questions.filter((q) => q.status === 'open').length,
        questions_matched: S.questions.filter((q) => q.status === 'matched').length,
        questions_resolved: S.questions.filter((q) => q.status === 'resolved').length,
        matches_accepted: S.matches.filter((m) => m.status === 'accepted').length,
        messages: S.messages.length,
        modules: S.learning_modules.length,
        completions: S.learning_progress.filter((p) => p.completed).length,
      },
      growth,
      programme: programmeStats(),
      // Iteration 3: offene Vermittlungs- und Feedback-Aufgaben fuer stars.
      network: {
        intros_open: S.intro_requests.filter((i) => i.status === 'requested').length,
        intros_proposed: S.intro_requests.filter((i) => i.status === 'proposed').length,
        intros_accepted: S.intro_requests.filter((i) => i.status === 'accepted').length,
        scholarship_requests: S.event_registrations.filter((r) => r.status === 'requested').length,
        session_requests: S.session_requests.filter((r) => r.status === 'pending').length,
        peer_experts: S.users.filter((u) => u.offers_peer_support === 1).length,
        feedback_new: S.feedback.filter((f) => f.status === 'new').length,
      },
    };
  }

  if (role === 'mentor') {
    return {
      role,
      kpis: {
        suggested_matches: S.matches.filter((m) => m.mentor_id === uid && m.status === 'suggested').length,
        active_mentorships: S.matches.filter((m) => m.mentor_id === uid && m.status === 'accepted').length,
        unread_messages: unreadFor(uid),
        threads_started: S.threads.filter((t) => t.author_id === uid).length,
        comments_written: S.comments.filter((c) => c.author_id === uid).length,
        invitations_open: S.case_matches.filter((m) => m.supporter_id === uid && m.status === 'invited' && !m.supporter_ok).length,
        supports_active: S.case_matches.filter((m) => {
          if (m.supporter_id !== uid || m.status !== 'confirmed') return false;
          const c = caseOfNeed(m.need_id);
          return !!c && c.step !== 'closed';
        }).length,
        communities_joined: S.community_members.filter((m) => m.user_id === uid).length,
      },
      topTags: userTags(uid).slice(0, 5).map((t) => ({ name_de: t.name_de, name_en: t.name_en, weight: t.weight })),
    };
  }

  const progress = S.learning_progress.filter((p) => p.user_id === uid);
  const avg = progress.length ? progress.reduce((s, p) => s + p.progress, 0) / progress.length : 0;
  // Aktueller (offener vor abgeschlossenem, juengster zuerst) Fall der Support Journey.
  const myCase = S.cases
    .filter((c) => c.eem_id === uid)
    .sort((a, b) => (a.step === 'closed' ? 1 : 0) - (b.step === 'closed' ? 1 : 0) || cmp(b.created_at, a.created_at))[0];
  const journey = myCase
    ? {
        case_id: myCase.id,
        step: myCase.step,
        needs: S.needs
          .filter((n) => n.case_id === myCase.id && n.cycle === myCase.cycle && n.priority_rank != null)
          .sort((a, b) => cmp(a.priority_rank, b.priority_rank))
          .map((n) => ({
            id: n.id, goal: n.goal, status: n.status, priority_rank: n.priority_rank,
            review_date: S.agreements.find((a) => a.need_id === n.id)?.review_date ?? null,
          })),
      }
    : null;
  return {
    role,
    journey,
    kpis: {
      communities_joined: S.community_members.filter((m) => m.user_id === uid).length,
      questions_asked: S.questions.filter((q) => q.asker_id === uid).length,
      questions_resolved: S.questions.filter((q) => q.asker_id === uid && q.status === 'resolved').length,
      conversations: S.conversations.filter((c) => c.user_low === uid || c.user_high === uid).length,
      unread_messages: unreadFor(uid),
      modules_started: progress.length,
      modules_completed: progress.filter((p) => p.completed).length,
      avg_progress: Math.round(avg),
    },
  };
});

// --- notifications ---
on('GET', '/notifications', true, ({ user }) => {
  const items = S.notifications.filter((n) => n.user_id === user!.id).sort((a, b) => b.id - a.id).slice(0, 50);
  return { notifications: items, unread: S.notifications.filter((n) => n.user_id === user!.id && !n.read_at).length };
});

on('POST', '/notifications/read-all', true, ({ user }) => {
  for (const n of S.notifications) if (n.user_id === user!.id && !n.read_at) n.read_at = now();
  return { ok: true };
});

on('POST', '/notifications/:id/read', true, ({ params, user }) => {
  const n = S.notifications.find((x) => x.id === Number(params.id) && x.user_id === user!.id);
  if (n && !n.read_at) n.read_at = now();
  return { ok: true };
});

// ===========================================================================
// Iteration 2 – Support Journey (1:1 zu server/src/routes/journey.js)
// stars (Rolle admin) fuehrt den Prozess; der EEM entscheidet ueber Ziele,
// Supportplan und Match mit.
// ===========================================================================
type User = NonNullable<Ctx['user']>;

const isAdmin = (u: User) => u.role === 'admin';

function requireRole(u: User, ...roles: string[]) {
  if (!roles.includes(u.role)) throw new HttpError(403, 'Keine Berechtigung');
}

function loadCase(id: any) {
  return S.cases.find((c) => c.id === Number(id));
}

// Zugriffsrolle der anfragenden Person auf einen Fall.
function accessOf(u: User, c: Row | undefined): string | null {
  if (!c) return null;
  if (isAdmin(u)) return 'admin';
  if (c.eem_id === u.id) return 'eem';
  const needIds = new Set(S.needs.filter((n) => n.case_id === c.id).map((n) => n.id));
  const m = S.case_matches.filter((cm) => needIds.has(cm.need_id) && cm.supporter_id === u.id && cm.status !== 'declined');
  if (m.length) return m.some((x) => x.status === 'confirmed') ? 'supporter' : 'invited';
  return null;
}

function caseFor(id: any, u: User, roles = ['admin', 'eem', 'supporter', 'invited']) {
  const c = loadCase(id);
  if (!c) throw new HttpError(404, 'Fall nicht gefunden');
  const access = accessOf(u, c);
  if (!access || !roles.includes(access)) throw new HttpError(403, 'Keine Berechtigung für diesen Fall');
  return { c, access };
}

function needFor(needId: any, u: User, roles: string[]) {
  const n = S.needs.find((x) => x.id === Number(needId));
  if (!n) throw new HttpError(404, 'Bedarf nicht gefunden');
  const c = loadCase(n.case_id)!;
  const access = accessOf(u, c);
  if (!access || !roles.includes(access)) throw new HttpError(403, 'Keine Berechtigung');
  return { n, c, access };
}

function needTagsOf(needId: number) {
  return S.need_tags
    .filter((nt) => nt.need_id === needId)
    .sort(byTagId)
    .map((nt) => tagById(nt.tag_id))
    .filter(Boolean)
    .map((t) => ({ id: t!.id, slug: t!.slug, name_de: t!.name_de, name_en: t!.name_en, category: t!.category }));
}

function setNeedTags(needId: number, tagIds: any) {
  if (!Array.isArray(tagIds)) return;
  const ids = tagIds.map(Number);
  // Fremdschluessel wie in SQLite: unbekannte Tags fuehren zu einem Fehler (Transaktion ohne Aenderung).
  if (ids.some((id) => !tagById(id))) throw new Error('FOREIGN KEY constraint failed');
  S.need_tags = S.need_tags.filter((nt) => nt.need_id !== needId);
  for (const id of ids) {
    if (!S.need_tags.some((nt) => nt.need_id === needId && nt.tag_id === id)) S.need_tags.push({ need_id: needId, tag_id: id });
  }
}

function admins() {
  return S.users.filter((u) => u.role === 'admin').map((u) => u.id);
}

// Vollstaendige Fallansicht. Eingeladene Unterstuetzer:innen sehen nur den
// Matching Brief ihres Bedarfs, nicht das ganze EEM-Profil (Datensparsamkeit).
function caseDetail(c: Row, access: string, viewerId: number) {
  const eem = publicUser(findUser(c.eem_id));
  const coordinator = c.coordinator_id ? publicUser(findUser(c.coordinator_id)) : null;
  let needs: Row[] = S.needs
    .filter((n) => n.case_id === c.id)
    .sort((a, b) => b.cycle - a.cycle || (a.priority_rank ?? 9) - (b.priority_rank ?? 9) || a.id - b.id)
    .map((n) => ({
      ...n,
      tags: needTagsOf(n.id),
      plan: S.plan_items
        .filter((p) => p.need_id === n.id)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        .map((p) => ({ ...p })),
      brief: (() => { const b = S.matching_briefs.find((x) => x.need_id === n.id); return b ? { ...b } : null; })(),
      matches: S.case_matches
        .filter((cm) => cm.need_id === n.id)
        .sort((a, b) => cmp(a.created_at, b.created_at))
        .map((cm) => {
          const u = findUser(cm.supporter_id)!;
          return {
            ...cm, supporter_name: u.name, supporter_headline: u.headline,
            supporter_avatar: u.avatar_seed, supporter_country: u.country,
          };
        }),
      agreement: (() => { const a = S.agreements.find((x) => x.need_id === n.id); return a ? { ...a } : null; })(),
      reviews: S.reviews
        .filter((r) => r.need_id === n.id)
        .sort((a, b) => cmp(b.created_at, a.created_at))
        .map((r) => ({ ...r })),
    }));

  if (access === 'invited') {
    needs = needs.filter((n) => n.matches.some((m: Row) => m.supporter_id === viewerId));
  }

  const events = access === 'invited'
    ? []
    : S.case_events
        .filter((e) => e.case_id === c.id)
        .sort((a, b) => cmp(b.created_at, a.created_at) || b.id - a.id)
        .map((e) => ({ ...e, user_name: e.user_id != null ? findUser(e.user_id)?.name ?? null : null }));

  return {
    case: { ...c },
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

// --- EEM-Profil (FA-14): vier Online-Frageboegen Context/Ecosystem/Venture/Entrepreneur
// Express-Route '/profile/:userId?' -> hier zwei Routen (mit und ohne userId).
function getProfile({ params, user }: Ctx) {
  const uid = params.userId ? Number(params.userId) : user!.id;
  if (uid !== user!.id && !isAdmin(user!)) throw new HttpError(403, 'Keine Berechtigung');
  return { profile: profileOf(uid) };
}

function putProfile({ params, user, body }: Ctx) {
  const uid = params.userId ? Number(params.userId) : user!.id;
  if (uid !== user!.id && !isAdmin(user!)) throw new HttpError(403, 'Keine Berechtigung');
  const { case_type, context, ecosystem, venture, entrepreneur, validated } = body || {};
  const obj = (v: any) => JSON.stringify(v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const current = profileOf(uid);
  const values = {
    case_type: ['venture_scaler', 'ecosystem_builder'].includes(case_type) ? case_type : current?.case_type ?? null,
    context: obj(context ?? current?.context),
    ecosystem: obj(ecosystem ?? current?.ecosystem),
    venture: obj(venture ?? current?.venture),
    entrepreneur: obj(entrepreneur ?? current?.entrepreneur),
    updated_at: now(),
  };
  let p = S.eem_profiles.find((x) => x.user_id === uid);
  if (p) Object.assign(p, values);
  else {
    // Fremdschluessel auf users wie in SQLite
    if (!findUser(uid)) throw new Error('FOREIGN KEY constraint failed');
    p = { user_id: uid, ...values, validated_at: null };
    S.eem_profiles.push(p);
  }
  // Validierung im Vertiefungsinterview ist Aufgabe der Programmkoordination.
  if (isAdmin(user!) && validated !== undefined) p.validated_at = validated ? now() : null;
  return { profile: profileOf(uid) };
}

on('GET', '/journey/profile', true, getProfile);
on('GET', '/journey/profile/:userId', true, getProfile);
on('PUT', '/journey/profile', true, putProfile);
on('PUT', '/journey/profile/:userId', true, putProfile);

// --- Faelle
on('GET', '/journey/cases', true, ({ user }) => {
  const u = user!;
  let rows: Row[];
  if (isAdmin(u)) {
    rows = [...S.cases].sort((a, b) => cmp(b.updated_at, a.updated_at));
  } else if (u.role === 'mentor') {
    rows = S.cases
      .filter((c) => {
        const needIds = new Set(S.needs.filter((n) => n.case_id === c.id).map((n) => n.id));
        return S.case_matches.some((cm) => needIds.has(cm.need_id) && cm.supporter_id === u.id && cm.status !== 'declined');
      })
      .sort((a, b) => cmp(b.updated_at, a.updated_at));
  } else {
    rows = S.cases.filter((c) => c.eem_id === u.id).sort((a, b) => cmp(b.created_at, a.created_at));
  }
  const cases = rows.map((c) => {
    const needs = prioritizedNeeds(c.id, c.cycle);
    const reviewDates = S.needs
      .filter((n) => n.case_id === c.id && n.cycle === c.cycle)
      .map((n) => S.agreements.find((a) => a.need_id === n.id)?.review_date)
      .filter((d) => d != null)
      .sort();
    return {
      ...c,
      eem: publicUser(findUser(c.eem_id)),
      case_type: profileOf(c.eem_id)?.case_type ?? null,
      prioritized: needs.map((n) => ({ id: n.id, goal: n.goal, status: n.status })),
      next_review: reviewDates.length ? reviewDates[0] : null,
      handover: handoverCheck(c),
      my_invitations: u.role === 'mentor'
        ? S.case_matches
            .filter((cm) => cm.supporter_id === u.id && S.needs.some((n) => n.id === cm.need_id && n.case_id === c.id))
            .map((cm) => ({
              id: cm.id, status: cm.status, supporter_ok: cm.supporter_ok, role: cm.role,
              goal: S.needs.find((n) => n.id === cm.need_id)!.goal,
            }))
        : undefined,
    };
  });
  return { cases };
});

// Aufnahme beantragen (EEM). Ein offener Fall je EEM.
on('POST', '/journey/cases', true, ({ user, body }) => {
  requireRole(user!, 'entrepreneur');
  const open = S.cases.find((c) => c.eem_id === user!.id && c.step !== 'closed');
  if (open) throw new HttpError(409, 'Es existiert bereits ein offener Fall', { caseId: open.id });
  const { motivation } = body || {};
  if (!motivation) throw new HttpError(400, 'motivation erforderlich');
  const id = nextId('cases');
  const ts = now();
  S.cases.push({
    id, eem_id: user!.id, coordinator_id: null, step: 'intake', intake_decision: 'pending',
    motivation, expectations: null, plan_consent_at: null, cycle: 1, closed_reason: null, closing_note: null,
    created_at: ts, updated_at: ts,
  });
  logEvent(id, user!.id, 'step', 'intake', motivation);
  for (const a of admins()) {
    notify(a, {
      type: 'system',
      title: 'Neuer Aufnahmeantrag',
      body: `${user!.name} möchte in die Support Journey aufgenommen werden.`,
      link: `/journey/${id}`,
    });
  }
  return { status: 201, data: { case: { ...loadCase(id) } } };
});

on('GET', '/journey/cases/:id', true, ({ params, user }) => {
  const r = caseFor(params.id, user!);
  return caseDetail(r.c, r.access, user!.id);
});

// Aufnahmeentscheid (stars). Verbindlicher Output: Entscheid + geklaerte Erwartungen.
on('POST', '/journey/cases/:id/intake', true, ({ params, user, body }) => {
  requireRole(user!, 'admin');
  const r = caseFor(params.id, user!, ['admin']);
  const { decision, expectations } = body || {};
  if (!['accepted', 'declined'].includes(decision)) throw new HttpError(400, 'decision ungültig');
  if (decision === 'accepted' && !expectations)
    throw new HttpError(400, 'Erwartungen (Umfang, Dauer, Mitwirkung) müssen festgehalten werden');
  r.c.intake_decision = decision;
  r.c.expectations = expectations || null;
  r.c.coordinator_id = user!.id;
  if (decision === 'accepted') {
    setStep(r.c.id, 'assessment', user!.id, expectations);
  } else {
    r.c.closed_reason = 'declined';
    r.c.closing_note = expectations || null;
    setStep(r.c.id, 'closed', user!.id, 'Aufnahme abgelehnt');
  }
  notify(r.c.eem_id, {
    type: 'system',
    title: decision === 'accepted' ? 'Du wurdest in die Support Journey aufgenommen' : 'Aufnahmeentscheid',
    body: decision === 'accepted' ? 'Nächster Schritt: Profil in vier kurzen Fragebögen ausfüllen.' : 'Dein Antrag wurde aktuell nicht angenommen.',
    link: decision === 'accepted' ? '/journey/profile' : `/journey/${r.c.id}`,
  });
  return caseDetail(loadCase(r.c.id)!, 'admin', user!.id);
});

// Naechster Schritt – nur wenn die verbindliche Uebergabe vollstaendig ist.
on('POST', '/journey/cases/:id/advance', true, ({ params, user, body }) => {
  requireRole(user!, 'admin');
  const r = caseFor(params.id, user!, ['admin']);
  const check = handoverCheck(r.c);
  if (!check.canAdvance) throw new HttpError(409, 'Übergabe unvollständig', { missing: check.missing });
  setStep(r.c.id, check.next!, user!.id, body?.note || null);
  notify(r.c.eem_id, {
    type: 'system',
    title: 'Deine Support Journey geht weiter',
    body: `Neuer Schritt: ${check.next}`,
    link: `/journey/${r.c.id}`,
  });
  return caseDetail(loadCase(r.c.id)!, 'admin', user!.id);
});

// Nach dem Re-Assessment: neuer Zyklus (zurueck zur Priorisierung) ...
on('POST', '/journey/cases/:id/new-cycle', true, ({ params, user, body }) => {
  requireRole(user!, 'admin');
  const r = caseFor(params.id, user!, ['admin']);
  if (r.c.step !== 'reassessment') throw new HttpError(409, 'Nur nach dem Re-Assessment möglich');
  const check = handoverCheck(r.c);
  if (check.missing.length) throw new HttpError(409, 'Re-Assessment unvollständig', { missing: check.missing });
  const oldCycle = r.c.cycle;
  r.c.cycle = oldCycle + 1;
  r.c.plan_consent_at = null;
  // Nicht erreichte, nicht verworfene Bedarfe werden in den neuen Zyklus uebernommen
  // (ohne Priorisierung – diese wird gemeinsam neu vorgenommen).
  for (const n of S.needs) {
    if (n.case_id === r.c.id && n.status === 'open' && n.cycle === oldCycle) {
      n.cycle = oldCycle + 1;
      n.priority_rank = null;
    }
  }
  setStep(r.c.id, 'prioritization', user!.id, body?.note || 'Neuer Unterstützungszyklus');
  return caseDetail(loadCase(r.c.id)!, 'admin', user!.id);
});

// ... oder Abschluss (Ziel erreicht, Wunsch des EEM, kein weiterer Bedarf).
on('POST', '/journey/cases/:id/close', true, ({ params, user, body }) => {
  requireRole(user!, 'admin');
  const r = caseFor(params.id, user!, ['admin']);
  const { reason, note } = body || {};
  if (!['goal_achieved', 'eem_request', 'no_further_need'].includes(reason))
    throw new HttpError(400, 'reason ungültig');
  if (!note) throw new HttpError(400, 'Abschlussdokumentation erforderlich');
  r.c.closed_reason = reason;
  r.c.closing_note = note;
  setStep(r.c.id, 'closed', user!.id, note);
  notify(r.c.eem_id, { type: 'system', title: 'Deine Support Journey wurde abgeschlossen', body: note, link: `/journey/${r.c.id}` });
  return caseDetail(loadCase(r.c.id)!, 'admin', user!.id);
});

// Zustimmung des EEM zum Supportplan.
on('POST', '/journey/cases/:id/plan-consent', true, ({ params, user }) => {
  const r = caseFor(params.id, user!, ['eem']);
  if (r.c.step !== 'support_plan') throw new HttpError(409, 'Supportplan ist noch nicht zur Zustimmung bereit');
  r.c.plan_consent_at = now();
  logEvent(r.c.id, user!.id, 'note', r.c.step, 'Supportplan durch EEM bestätigt');
  if (r.c.coordinator_id) notify(r.c.coordinator_id, { type: 'system', title: 'Supportplan bestätigt', body: user!.name, link: `/journey/${r.c.id}` });
  return caseDetail(loadCase(r.c.id)!, r.access, user!.id);
});

// Fortschrittsnotiz / Notiz (EEM, Unterstuetzer:innen, stars).
on('POST', '/journey/cases/:id/events', true, ({ params, user, body }) => {
  const r = caseFor(params.id, user!, ['admin', 'eem', 'supporter']);
  const { body: text, type } = body || {};
  if (!text) throw new HttpError(400, 'body erforderlich');
  logEvent(r.c.id, user!.id, type === 'progress' ? 'progress' : 'note', r.c.step, text);
  return { status: 201, data: caseDetail(loadCase(r.c.id)!, r.access, user!.id) };
});

// --- Bedarfe (FA-15): Bedarfsformel und gemeinsame Priorisierung
const RATINGS = ['relevance', 'urgency', 'impact', 'stars_contribution', 'feasibility'];
const clampRating = (v: any) => (v === null || v === undefined || v === '' ? null : Math.min(3, Math.max(1, Number(v))));

on('POST', '/journey/cases/:id/needs', true, ({ params, user, body }) => {
  const r = caseFor(params.id, user!, ['admin', 'eem']);
  if (r.c.step === 'closed') throw new HttpError(409, 'Fall ist abgeschlossen');
  const { goal, bottleneck, support_needed, success_criterion, tagIds } = body || {};
  if (!goal) throw new HttpError(400, 'goal erforderlich');
  const id = nextId('needs');
  S.needs.push({
    id, case_id: r.c.id, goal, bottleneck: bottleneck || null, support_needed: support_needed || null,
    success_criterion: success_criterion || null, relevance: null, urgency: null, impact: null,
    stars_contribution: null, feasibility: null, priority_rank: null, status: 'open',
    cycle: r.c.cycle, created_by: user!.id, created_at: now(),
  });
  setNeedTags(id, tagIds);
  return { status: 201, data: caseDetail(loadCase(r.c.id)!, r.access, user!.id) };
});

on('PATCH', '/journey/needs/:needId', true, ({ params, user, body }) => {
  const r = needFor(params.needId, user!, ['admin', 'eem']);
  const b = body || {};
  const fields: Row = {};
  for (const f of ['goal', 'bottleneck', 'support_needed', 'success_criterion']) if (b[f] !== undefined) fields[f] = b[f] || null;
  for (const f of RATINGS) if (b[f] !== undefined) fields[f] = clampRating(b[f]);
  if (b.status !== undefined && ['open', 'achieved', 'dropped'].includes(b.status)) fields.status = b.status;

  if (b.priority_rank !== undefined) {
    const rank = b.priority_rank === null || b.priority_rank === '' ? null : Number(b.priority_rank);
    if (rank !== null) {
      if (![1, 2, 3].includes(rank)) throw new HttpError(400, 'priority_rank muss 1–3 sein');
      // Rang ist je Zyklus eindeutig: ein bereits vergebener Rang wird freigegeben.
      for (const o of S.needs) {
        if (o.case_id === r.n.case_id && o.cycle === r.n.cycle && o.priority_rank === rank && o.id !== r.n.id) o.priority_rank = null;
      }
    }
    fields.priority_rank = rank;
  }
  Object.assign(r.n, fields);
  if (b.tagIds !== undefined) setNeedTags(r.n.id, b.tagIds);
  return caseDetail(loadCase(r.c.id)!, r.access, user!.id);
});

// --- Supportplan (FA-18) und Matching Brief (FA-16) – Aufgabe von stars
on('PUT', '/journey/needs/:needId/plan', true, ({ params, user, body }) => {
  requireRole(user!, 'admin');
  const r = needFor(params.needId, user!, ['admin']);
  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items) throw new HttpError(400, 'items-Array erwartet');
  if (items.some((i: Row) => !FORMATS.includes(i.format))) throw new HttpError(400, 'Unbekanntes Format');
  S.plan_items = S.plan_items.filter((p) => p.need_id !== r.n.id);
  items.forEach((i: Row, idx: number) => {
    S.plan_items.push({ id: nextId('plan_items'), need_id: r.n.id, format: i.format, note: i.note || null, sort_order: idx });
  });
  // Eine Planaenderung erfordert eine erneute Zustimmung des EEM.
  r.c.plan_consent_at = null;
  return caseDetail(loadCase(r.c.id)!, 'admin', user!.id);
});

on('PUT', '/journey/needs/:needId/brief', true, ({ params, user, body }) => {
  requireRole(user!, 'admin');
  const r = needFor(params.needId, user!, ['admin']);
  const b = body || {};
  if (!ROLES.includes(b.main_role)) throw new HttpError(400, 'main_role ungültig');
  const values = {
    main_role: b.main_role, experience: b.experience || null, context_ref: b.context_ref || null,
    network_access: b.network_access || null, language: b.language || null, duration: b.duration || null,
    working_mode: b.working_mode || null, updated_at: now(),
  };
  const existing = S.matching_briefs.find((x) => x.need_id === r.n.id);
  if (existing) Object.assign(existing, values);
  else S.matching_briefs.push({ need_id: r.n.id, ...values });
  if (b.tagIds !== undefined) setNeedTags(r.n.id, b.tagIds);
  return caseDetail(loadCase(r.c.id)!, 'admin', user!.id);
});

// --- Moderiertes Matching (FA-17, FA-22)
on('GET', '/journey/needs/:needId/candidates', true, ({ params, user }) => {
  requireRole(user!, 'admin');
  const r = needFor(params.needId, user!, ['admin']);
  const existing = new Map(S.case_matches.filter((m) => m.need_id === r.n.id).map((m) => [m.supporter_id, m.status]));
  const candidates = rankSupporters(r.n.id, 6).map((c) => ({ ...c, status: existing.get(c.supporter.id) || null }));
  return { candidates };
});

// stars laedt eine vorgeschlagene Person ein (Freigabe durch die Programmkoordination).
on('POST', '/journey/needs/:needId/invite', true, ({ params, user, body }) => {
  requireRole(user!, 'admin');
  const r = needFor(params.needId, user!, ['admin']);
  const supporterId = Number(body?.supporterId);
  const role = body?.role;
  if (!ROLES.includes(role)) throw new HttpError(400, 'role ungültig');
  const sup = S.users.find((u) => u.id === supporterId && u.role === 'mentor');
  if (!sup) throw new HttpError(404, 'Unterstützer:in nicht gefunden');
  const ranked = rankSupporters(r.n.id, 50).find((x) => x.supporter.id === supporterId);
  const existing = S.case_matches.find((m) => m.need_id === r.n.id && m.supporter_id === supporterId);
  if (existing) {
    Object.assign(existing, {
      status: 'invited', role, supporter_ok: 0, eem_ok: 0, score: ranked?.score ?? null, invited_by: user!.id,
    });
  } else {
    S.case_matches.push({
      id: nextId('case_matches'), need_id: r.n.id, supporter_id: supporterId, role, score: ranked?.score ?? null,
      status: 'invited', supporter_ok: 0, eem_ok: 0, invited_by: user!.id, created_at: now(), confirmed_at: null,
    });
  }
  logEvent(r.c.id, user!.id, 'match', r.c.step, `Einladung an Unterstützer:in #${supporterId} (${role})`);
  notify(supporterId, {
    type: 'match',
    title: 'Anfrage von stars: Unterstützung gesucht',
    body: `Bedarf: «${r.n.goal}». Bitte Matching Brief prüfen und zu- oder absagen.`,
    link: `/journey/${r.c.id}`,
  });
  return caseDetail(loadCase(r.c.id)!, 'admin', user!.id);
});

// Antwort der eingeladenen Person bzw. Bestaetigung des EEM.
on('POST', '/journey/matches/:matchId/respond', true, ({ params, user, body }) => {
  const m = S.case_matches.find((x) => x.id === Number(params.matchId));
  if (!m) throw new HttpError(404, 'Match nicht gefunden');
  const n = S.needs.find((x) => x.id === m.need_id)!;
  const c = loadCase(n.case_id)!;
  const accept = !!body?.accept;
  let side: 'supporter' | 'eem';
  if (m.supporter_id === user!.id) side = 'supporter';
  else if (c.eem_id === user!.id) side = 'eem';
  else throw new HttpError(403, 'Keine Berechtigung');
  if (m.status !== 'invited') throw new HttpError(409, 'Match ist nicht mehr offen');
  if (side === 'eem' && !m.supporter_ok) throw new HttpError(409, 'Zuerst muss die Unterstützer:in zusagen');

  if (!accept) {
    m.status = 'declined';
    logEvent(c.id, user!.id, 'match', c.step, `Match abgelehnt (${side}): ${body?.note || ''}`.trim());
    for (const a of c.coordinator_id ? [c.coordinator_id] : admins()) {
      notify(a, { type: 'match', title: 'Match abgelehnt – alternative Lösung suchen', body: n.goal, link: `/journey/${c.id}` });
    }
    return { status: 'declined' };
  }

  if (side === 'supporter') m.supporter_ok = 1;
  else m.eem_ok = 1;
  let conversationId: number | null = null;
  if (m.supporter_ok && m.eem_ok) {
    m.status = 'confirmed';
    m.confirmed_at = now();
    const [low, high] = orderPair(c.eem_id, m.supporter_id);
    let conv = S.conversations.find((x) => x.user_low === low && x.user_high === high);
    if (!conv) {
      conv = { id: nextId('conversations'), user_low: low, user_high: high, created_at: now() };
      S.conversations.push(conv);
    }
    conversationId = conv.id;
    logEvent(c.id, user!.id, 'match', c.step, `Match bestätigt: Unterstützer:in #${m.supporter_id} für «${n.goal}»`);
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
  return { status: m.supporter_ok && m.eem_ok ? 'confirmed' : 'invited', conversationId };
});

// --- Vereinbarung und Re-Assessment (FA-19, FA-21)
on('PUT', '/journey/needs/:needId/agreement', true, ({ params, user, body }) => {
  const r = needFor(params.needId, user!, ['admin', 'eem', 'supporter']);
  const { goal, roles, next_steps, review_date } = body || {};
  if (!goal || !review_date || !/^\d{4}-\d{2}-\d{2}$/.test(review_date))
    throw new HttpError(400, 'goal und review_date (YYYY-MM-DD) erforderlich');
  const values = { goal, roles: roles || null, next_steps: next_steps || null, review_date, updated_at: now() };
  const existing = S.agreements.find((a) => a.need_id === r.n.id);
  if (existing) Object.assign(existing, values);
  else S.agreements.push({ need_id: r.n.id, ...values });
  logEvent(r.c.id, user!.id, 'note', r.c.step, `Vereinbarung für «${r.n.goal}» festgehalten (Review: ${review_date})`);
  return caseDetail(loadCase(r.c.id)!, r.access, user!.id);
});

on('POST', '/journey/needs/:needId/reviews', true, ({ params, user, body }) => {
  const r = needFor(params.needId, user!, ['admin', 'eem', 'supporter']);
  const { progress, outcome, next_step } = body || {};
  if (!['none', 'partial', 'achieved'].includes(progress)) throw new HttpError(400, 'progress ungültig');
  if (!['continue', 'new_goal', 'rematch', 'close'].includes(next_step)) throw new HttpError(400, 'next_step ungültig');
  S.reviews.push({
    id: nextId('reviews'), need_id: r.n.id, progress, outcome: outcome || null, next_step,
    created_by: user!.id, created_at: now(),
  });
  if (progress === 'achieved') r.n.status = 'achieved';
  logEvent(r.c.id, user!.id, 'note', r.c.step, `Re-Assessment «${r.n.goal}»: ${progress}${outcome ? ` – ${outcome}` : ''}`);
  return { status: 201, data: caseDetail(loadCase(r.c.id)!, r.access, user!.id) };
});

// ===========================================================================
// Iteration 2 – Communities of Practice (1:1 zu server/src/routes/communities.js)
// ===========================================================================
const SESSION_FORMATS = ['peer_session', 'roundtable', 'masterclass', 'pitch_learn'];

function membership(communityId: number, userId: number) {
  return S.community_members.find((m) => m.community_id === communityId && m.user_id === userId);
}

function canModerate(u: User, communityId: number) {
  return u.role === 'admin' || membership(communityId, u.id)?.role === 'moderator';
}

// Entspricht listSql (Community-Zeile mit Tag, Zaehlern, naechster Session und eigener Rolle).
function communityRow(c: Row, uid: number): Row {
  const t = c.tag_id != null ? tagById(c.tag_id) : undefined;
  const nowMin = nowMinute();
  const upcoming = S.community_sessions
    .filter((s) => s.community_id === c.id && s.starts_at >= nowMin)
    .map((s) => s.starts_at)
    .sort();
  return {
    ...c,
    tag_slug: t?.slug ?? null,
    tag_name_de: t?.name_de ?? null,
    tag_name_en: t?.name_en ?? null,
    tag_category: t?.category ?? null,
    member_count: S.community_members.filter((m) => m.community_id === c.id).length,
    post_count: S.community_posts.filter((p) => p.community_id === c.id).length,
    next_session: upcoming.length ? upcoming[0] : null,
    my_role: membership(c.id, uid)?.role ?? null,
  };
}

on('GET', '/communities', true, ({ user }) => ({
  communities: S.communities
    .map((c) => communityRow(c, user!.id))
    .sort((a, b) => b.member_count - a.member_count || cmp(a.name_de, b.name_de)),
}));

// Vorschlaege passender Communities zu einer Tag-Auswahl (z.B. aus einer Frage).
// Muss vor '/communities/:id' registriert sein.
on('GET', '/communities/suggest', true, ({ query, user }) => {
  const ids = String(query.get('tagIds') || '')
    .split(',')
    .map(Number)
    .filter(Boolean);
  if (!ids.length) return { communities: [] };
  return {
    communities: S.communities
      .filter((c) => ids.includes(c.tag_id))
      .map((c) => communityRow(c, user!.id))
      .sort((a, b) => b.member_count - a.member_count),
  };
});

on('POST', '/communities', true, ({ user, body }) => {
  if (user!.role !== 'admin') throw new HttpError(403, 'Keine Berechtigung');
  const { name_de, name_en, description_de, description_en, tag_id } = body || {};
  if (!name_de) throw new HttpError(400, 'name_de erforderlich');
  const slug = String(name_de).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
  const id = nextId('communities');
  S.communities.push({
    id, slug, name_de, name_en: name_en || name_de, description_de: description_de || null,
    description_en: description_en || description_de || null, tag_id: tag_id ? Number(tag_id) : null, created_at: now(),
  });
  S.community_members.push({ community_id: id, user_id: user!.id, role: 'moderator', joined_at: now() });
  return { status: 201, data: { id } };
});

on('POST', '/communities/sessions/:sessionId/attend', true, ({ params, user }) => {
  const s = S.community_sessions.find((x) => x.id === Number(params.sessionId));
  if (!s) throw new HttpError(404, 'Session nicht gefunden');
  const exists = S.session_attendees.some((a) => a.session_id === s.id && a.user_id === user!.id);
  if (exists) {
    S.session_attendees = S.session_attendees.filter((a) => !(a.session_id === s.id && a.user_id === user!.id));
  } else {
    if (!membership(s.community_id, user!.id)) {
      S.community_members.push({ community_id: s.community_id, user_id: user!.id, role: 'member', joined_at: now() });
    }
    S.session_attendees.push({ session_id: s.id, user_id: user!.id });
  }
  return { attending: !exists };
});

on('GET', '/communities/:id', true, ({ params, user }) => {
  const id = Number(params.id);
  const c = S.communities.find((x) => x.id === id);
  if (!c) throw new HttpError(404, 'Community nicht gefunden');
  const community = communityRow(c, user!.id);
  const members = S.community_members
    .filter((m) => m.community_id === id)
    .map((m) => {
      const u = findUser(m.user_id)!;
      return { id: u.id, name: u.name, user_role: u.role, country: u.country, headline: u.headline, avatar_seed: u.avatar_seed, role: m.role };
    })
    .sort((a, b) => cmp(b.role, a.role) || cmp(a.name, b.name));
  const sessions = S.community_sessions
    .filter((s) => s.community_id === id)
    .sort((a, b) => cmp(b.starts_at, a.starts_at))
    .map((s) => ({
      ...s,
      host_name: s.host_id != null ? findUser(s.host_id)?.name ?? null : null,
      attendee_count: S.session_attendees.filter((a) => a.session_id === s.id).length,
      attending: S.session_attendees.some((a) => a.session_id === s.id && a.user_id === user!.id) ? 1 : 0,
    }));
  const posts = S.community_posts
    .filter((p) => p.community_id === id)
    .sort((a, b) => cmp(b.created_at, a.created_at))
    .slice(0, 100)
    .map((p) => {
      const u = findUser(p.author_id)!;
      return {
        id: p.id, body: p.body, created_at: p.created_at, author_id: u.id, author_name: u.name,
        author_role: u.role, author_avatar: u.avatar_seed,
      };
    });
  // Iteration 3: Slot-Antraege (Moderation sieht alle, Mitglieder ihre eigenen).
  const mod = canModerate(user!, id);
  const sessionRequests = S.session_requests
    .filter((r) => r.community_id === id && (mod || r.requester_id === user!.id))
    .sort((a, b) => (b.status === 'pending' ? 1 : 0) - (a.status === 'pending' ? 1 : 0) || cmp(b.created_at, a.created_at))
    .map((r) => {
      const u = findUser(r.requester_id)!;
      return { ...r, requester_name: u.name, requester_avatar: u.avatar_seed };
    });
  return { community, members, sessions, posts, sessionRequests, canModerate: mod };
});

on('POST', '/communities/:id/join', true, ({ params, user }) => {
  const id = Number(params.id);
  if (!S.communities.some((x) => x.id === id)) throw new HttpError(404, 'Community nicht gefunden');
  if (!membership(id, user!.id)) S.community_members.push({ community_id: id, user_id: user!.id, role: 'member', joined_at: now() });
  return { ok: true };
});

on('POST', '/communities/:id/leave', true, ({ params, user }) => {
  const id = Number(params.id);
  S.community_members = S.community_members.filter((m) => !(m.community_id === id && m.user_id === user!.id));
  return { ok: true };
});

on('POST', '/communities/:id/posts', true, ({ params, user, body }) => {
  const id = Number(params.id);
  if (!membership(id, user!.id) && user!.role !== 'admin') throw new HttpError(403, 'Nur Mitglieder können posten');
  const { body: text } = body || {};
  if (!text) throw new HttpError(400, 'body erforderlich');
  if (!S.communities.some((x) => x.id === id)) throw new Error('FOREIGN KEY constraint failed');
  S.community_posts.push({ id: nextId('community_posts'), community_id: id, author_id: user!.id, body: text, created_at: now() });
  return { status: 201, data: { ok: true } };
});

// Session ansetzen (Moderation); alle Mitglieder werden benachrichtigt.
on('POST', '/communities/:id/sessions', true, ({ params, user, body }) => {
  const id = Number(params.id);
  if (!canModerate(user!, id)) throw new HttpError(403, 'Nur Moderation kann Sessions ansetzen');
  const { title, description, format, starts_at } = body || {};
  if (!title || !starts_at) throw new HttpError(400, 'title und starts_at erforderlich');
  const fmtName = SESSION_FORMATS.includes(format) ? format : 'peer_session';
  const community = S.communities.find((x) => x.id === id);
  if (!community) throw new Error('FOREIGN KEY constraint failed');
  S.community_sessions.push({
    id: nextId('community_sessions'), community_id: id, host_id: user!.id, title, description: description || null,
    format: fmtName, starts_at: String(starts_at).replace('T', ' ').slice(0, 16), created_at: now(),
  });
  for (const m of S.community_members.filter((x) => x.community_id === id && x.user_id !== user!.id)) {
    notify(m.user_id, { type: 'system', title: `Neue Session: ${title}`, body: community.name_de, link: `/communities/${id}` });
  }
  return { status: 201, data: { ok: true } };
});

// Iteration 3 – Pitch-&-Learn-Slots (FA-24): Mitglieder beantragen einen
// Session-Slot; die Moderation genehmigt und terminiert oder lehnt ab.
// '/communities/session-requests/:rid/decide' (4 Segmente) kollidiert nicht mit
// '/communities/:id/...' (3 Segmente), da die Muster vollstaendig verankert sind.
on('POST', '/communities/:id/session-requests', true, ({ params, user, body }) => {
  const id = Number(params.id);
  if (!membership(id, user!.id) && user!.role !== 'admin')
    throw new HttpError(403, 'Nur Mitglieder können einen Slot beantragen');
  const { title, description, audience, preferred_date } = body || {};
  if (!title) throw new HttpError(400, 'title erforderlich');
  if (!S.communities.some((x) => x.id === id)) throw new Error('FOREIGN KEY constraint failed');
  S.session_requests.push({
    id: nextId('session_requests'), community_id: id, requester_id: user!.id, title,
    description: description || null, audience: audience || null, preferred_date: preferred_date || null,
    status: 'pending', session_id: null, created_at: now(),
  });
  const mods = S.community_members.filter((m) => m.community_id === id && m.role === 'moderator');
  for (const m of mods) {
    if (m.user_id !== user!.id)
      notify(m.user_id, { type: 'system', title: `Slot-Antrag: ${title}`, body: user!.name, link: `/communities/${id}` });
  }
  return { status: 201, data: { ok: true } };
});

on('POST', '/communities/session-requests/:rid/decide', true, ({ params, user, body }) => {
  const r = S.session_requests.find((x) => x.id === Number(params.rid));
  if (!r) throw new HttpError(404, 'Antrag nicht gefunden');
  if (!canModerate(user!, r.community_id)) throw new HttpError(403, 'Nur Moderation kann entscheiden');
  if (r.status !== 'pending') throw new HttpError(409, 'Antrag bereits entschieden');
  const { approve, starts_at, format } = body || {};
  if (!approve) {
    r.status = 'declined';
    notify(r.requester_id, { type: 'system', title: `Slot-Antrag abgelehnt: ${r.title}`, link: `/communities/${r.community_id}` });
    return { ok: true };
  }
  if (!starts_at) throw new HttpError(400, 'starts_at erforderlich');
  const sid = nextId('community_sessions');
  S.community_sessions.push({
    id: sid, community_id: r.community_id, host_id: r.requester_id, title: r.title,
    description: [r.description, r.audience && `Publikum: ${r.audience}`].filter(Boolean).join('\n') || null,
    format: SESSION_FORMATS.includes(format) ? format : 'pitch_learn',
    starts_at: String(starts_at).replace('T', ' ').slice(0, 16), created_at: now(),
  });
  r.status = 'approved';
  r.session_id = sid;
  if (!S.session_attendees.some((a) => a.session_id === sid && a.user_id === r.requester_id)) {
    S.session_attendees.push({ session_id: sid, user_id: r.requester_id });
  }
  for (const m of S.community_members.filter((x) => x.community_id === r.community_id && x.user_id !== user!.id)) {
    notify(m.user_id, {
      type: 'system',
      title: m.user_id === r.requester_id ? `Dein Slot ist bestätigt: ${r.title}` : `Neue Session: ${r.title}`,
      link: `/communities/${r.community_id}`,
    });
  }
  return { ok: true, session_id: sid };
});

// ===========================================================================
// Iteration 3 – Warm Introductions mit stars-Empfehlung (1:1 zu server/src/routes/intros.js)
//   requested -> proposed (stars waehlt Person + Empfehlung)
//   -> accepted (Konversation wird eroeffnet) | declined | closed
// ===========================================================================
function introTags(introId: number) {
  return S.intro_request_tags
    .filter((it) => it.intro_id === introId)
    .sort(byTagId)
    .map((it) => tagById(it.tag_id))
    .filter(Boolean)
    .map((t) => ({ id: t!.id, slug: t!.slug, name_de: t!.name_de, name_en: t!.name_en, category: t!.category }));
}

// Entspricht baseSql (Anfrage mit Namen von Antragsteller:in und vorgeschlagener Person).
function introRow(i: Row): Row {
  const r = findUser(i.requester_id)!;
  const s = i.supporter_id != null ? findUser(i.supporter_id) : undefined;
  return {
    ...i,
    requester_name: r.name, requester_country: r.country, requester_headline: r.headline, requester_avatar: r.avatar_seed,
    supporter_name: s?.name ?? null, supporter_headline: s?.headline ?? null, supporter_avatar: s?.avatar_seed ?? null,
    tags: introTags(i.id),
  };
}

function loadIntro(id: any) {
  const i = S.intro_requests.find((x) => x.id === Number(id));
  return i ? introRow(i) : null;
}

const introCanSee = (u: User, intro: Row) => isAdmin(u) || intro.requester_id === u.id || intro.supporter_id === u.id;

on('GET', '/intros', true, ({ user }) => {
  const u = user!;
  const rows = isAdmin(u)
    ? [...S.intro_requests].sort((a, b) =>
        (b.status === 'requested' ? 1 : 0) - (a.status === 'requested' ? 1 : 0) || cmp(b.updated_at, a.updated_at))
    : S.intro_requests
        .filter((i) => i.requester_id === u.id || (i.supporter_id === u.id && i.status !== 'requested'))
        .sort((a, b) => cmp(b.updated_at, a.updated_at));
  return { intros: rows.map(introRow) };
});

on('POST', '/intros', true, ({ user, body }) => {
  const { target_profile, purpose, tag_ids } = body || {};
  if (!target_profile || !purpose) throw new HttpError(400, 'target_profile und purpose erforderlich');
  const ids = (Array.isArray(tag_ids) ? tag_ids : []).map(Number);
  // Fremdschluessel wie in SQLite (Transaktion ohne Aenderung).
  if (ids.some((t: number) => !tagById(t))) throw new Error('FOREIGN KEY constraint failed');
  const id = nextId('intro_requests');
  const ts = now();
  S.intro_requests.push({
    id, requester_id: user!.id, target_profile, purpose, status: 'requested', supporter_id: null,
    vouch_note: null, response_note: null, conversation_id: null, created_at: ts, updated_at: ts,
  });
  for (const t of ids) {
    if (!S.intro_request_tags.some((x) => x.intro_id === id && x.tag_id === t)) S.intro_request_tags.push({ intro_id: id, tag_id: t });
  }
  for (const a of admins()) {
    notify(a, { type: 'system', title: 'Neue Intro-Anfrage', body: `${user!.name}: ${target_profile}`, link: '/network' });
  }
  return { status: 201, data: { id } };
});

on('GET', '/intros/:id', true, ({ params, user }) => {
  const intro = loadIntro(params.id);
  if (!intro || !introCanSee(user!, intro)) throw new HttpError(404, 'Anfrage nicht gefunden');
  return { intro };
});

// Vorschlaege fuer stars: Alumni und Peer-Expert:innen, bewertet mit der
// Unterstuetzer-Logik in der Rolle «Connector» (Netzwerkzugang zaehlt).
on('GET', '/intros/:id/suggestions', true, ({ params, user }) => {
  if (!isAdmin(user!)) throw new HttpError(403, 'Keine Berechtigung');
  const intro = loadIntro(params.id);
  if (!intro) throw new HttpError(404, 'Anfrage nicht gefunden');
  const names = new Map(intro.tags.map((t: Row) => [t.id, { de: t.name_de, en: t.name_en }]));
  const suggestions = S.users
    .filter((u) => u.id !== intro.requester_id && (u.role === 'mentor' || (u.role === 'entrepreneur' && u.offers_peer_support === 1)))
    .map((u) => {
      const r = scoreSupporter(
        { tags: intro.tags, role: 'connector', language: null },
        {
          tags: S.user_tags
            .filter((ut) => ut.user_id === u.id)
            .map((ut) => ({ id: ut.tag_id, category: tagById(ut.tag_id)!.category, weight: ut.weight })),
          languages: u.languages ? String(u.languages).split(',') : [],
          capacity_hours: u.capacity_hours ?? null,
          available: u.available === null || u.available === undefined ? true : !!u.available,
          support_roles: [], // fuer eine Vorstellung genuegt Netzwerk/Fachbezug, keine Rollenpflicht
        },
      );
      return {
        user: { id: u.id, name: u.name, role: u.role, country: u.country, headline: u.headline, avatar_seed: u.avatar_seed },
        peer: u.role === 'entrepreneur',
        score: r.score,
        matchedTags: r.matchedTagIds.map((id) => names.get(id)).filter(Boolean),
      };
    })
    .filter((s) => s.matchedTags.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  return { suggestions };
});

on('POST', '/intros/:id/propose', true, ({ params, user, body }) => {
  if (!isAdmin(user!)) throw new HttpError(403, 'Keine Berechtigung');
  const intro = loadIntro(params.id);
  if (!intro) throw new HttpError(404, 'Anfrage nicht gefunden');
  if (!['requested', 'declined'].includes(intro.status))
    throw new HttpError(409, 'Anfrage ist bereits vergeben oder abgeschlossen');
  const { supporter_id, vouch_note } = body || {};
  const supporter = supporter_id == null ? undefined : findUser(Number(supporter_id));
  if (!supporter || supporter.id === intro.requester_id) throw new HttpError(400, 'Ungültige Person');
  if (!vouch_note) throw new HttpError(400, 'Empfehlungsnotiz erforderlich');
  const row = S.intro_requests.find((x) => x.id === intro.id)!;
  Object.assign(row, { status: 'proposed', supporter_id: supporter.id, vouch_note, response_note: null, updated_at: now() });
  notify(supporter.id, {
    type: 'match', title: `stars möchte dich ${intro.requester_name} vorstellen`, body: intro.target_profile, link: '/network',
  });
  notify(intro.requester_id, { type: 'system', title: 'Deine Intro-Anfrage ist in Bearbeitung', body: `Vorgeschlagen: ${supporter.name}`, link: '/network' });
  return { intro: loadIntro(intro.id) };
});

// Antwort der vorgestellten Person. Bei Annahme eroeffnet das System die
// Konversation mit einer Einleitungsnachricht, die die Empfehlung enthaelt.
on('POST', '/intros/:id/respond', true, ({ params, user, body }) => {
  const intro = loadIntro(params.id);
  if (!intro || intro.supporter_id !== user!.id) throw new HttpError(404, 'Anfrage nicht gefunden');
  if (intro.status !== 'proposed') throw new HttpError(409, 'Keine offene Vorstellung');
  const { accept, note } = body || {};
  const row = S.intro_requests.find((x) => x.id === intro.id)!;
  if (!accept) {
    Object.assign(row, { status: 'declined', response_note: note || null, updated_at: now() });
    for (const a of admins()) {
      notify(a, { type: 'system', title: 'Vorstellung abgelehnt', body: `${user!.name} → ${intro.requester_name}`, link: '/network' });
    }
    return { intro: loadIntro(intro.id) };
  }
  const [low, high] = orderPair(intro.requester_id, user!.id);
  let conv = S.conversations.find((c) => c.user_low === low && c.user_high === high);
  if (!conv) {
    conv = { id: nextId('conversations'), user_low: low, user_high: high, created_at: now() };
    S.conversations.push(conv);
  }
  const text =
    `stars stellt vor: ${intro.requester_name} ↔ ${user!.name}\n\n` +
    `Anliegen: ${intro.purpose}\n\nEmpfehlung von stars: ${intro.vouch_note}` +
    (note ? `\n\n${user!.name}: ${note}` : '');
  S.messages.push({ id: nextId('messages'), conversation_id: conv.id, sender_id: user!.id, body: text, read_at: null, created_at: now() });
  Object.assign(row, { status: 'accepted', response_note: note || null, conversation_id: conv.id, updated_at: now() });
  notify(intro.requester_id, {
    type: 'match', title: `${user!.name} hat die Vorstellung angenommen`, body: intro.target_profile, link: `/messages/${conv.id}`,
  });
  return { intro: loadIntro(intro.id), conversation_id: conv.id };
});

on('POST', '/intros/:id/close', true, ({ params, user, body }) => {
  if (!isAdmin(user!)) throw new HttpError(403, 'Keine Berechtigung');
  const intro = loadIntro(params.id);
  if (!intro) throw new HttpError(404, 'Anfrage nicht gefunden');
  const { note } = body || {};
  const row = S.intro_requests.find((x) => x.id === intro.id)!;
  Object.assign(row, { status: 'closed', response_note: note || row.response_note, updated_at: now() });
  notify(intro.requester_id, { type: 'system', title: 'Intro-Anfrage abgeschlossen', body: note || intro.target_profile, link: '/network' });
  return { intro: loadIntro(intro.id) };
});

// ===========================================================================
// Iteration 3 – Veranstaltungen und Foerderplaetze (1:1 zu server/src/routes/events.js)
// ===========================================================================
on('GET', '/events', true, ({ user }) => ({
  events: [...S.events]
    .sort((a, b) => cmp(a.starts_on, b.starts_on))
    .map((e) => {
      const regs = S.event_registrations.filter((r) => r.event_id === e.id);
      const mine = regs.find((r) => r.user_id === user!.id);
      return {
        ...e,
        interested_count: regs.length,
        scholarship_count: regs.filter((r) => r.scholarship === 1).length,
        my_status: mine?.status ?? null,
        my_scholarship: mine?.scholarship ?? null,
        my_motivation: mine?.motivation ?? null,
      };
    }),
}));

// Uebersicht fuer stars: alle Interessensbekundungen und Antraege.
on('GET', '/events/registrations', true, ({ user }) => {
  if (user!.role !== 'admin') throw new HttpError(403, 'Keine Berechtigung');
  const registrations = S.event_registrations
    .map((r): Row => {
      const e = S.events.find((x) => x.id === r.event_id)!;
      const u = findUser(r.user_id)!;
      return {
        ...r, title_de: e.title_de, title_en: e.title_en, name: u.name, country: u.country,
        headline: u.headline, avatar_seed: u.avatar_seed, role: u.role,
      };
    })
    .sort((a, b) =>
      b.scholarship - a.scholarship ||
      (b.status === 'requested' ? 1 : 0) - (a.status === 'requested' ? 1 : 0) ||
      cmp(b.created_at, a.created_at));
  return { registrations };
});

// Interesse bekunden bzw. Foerderplatz beantragen (erneuter Aufruf aktualisiert).
on('POST', '/events/:id/register', true, ({ params, user, body }) => {
  const ev = S.events.find((x) => x.id === Number(params.id));
  if (!ev) throw new HttpError(404, 'Veranstaltung nicht gefunden');
  const { scholarship, motivation } = body || {};
  if (scholarship && !motivation) throw new HttpError(400, 'Begründung für den Förderplatz erforderlich');
  const status = scholarship ? 'requested' : 'interested';
  const values = { scholarship: scholarship ? 1 : 0, motivation: motivation || null, status };
  const existing = S.event_registrations.find((r) => r.event_id === ev.id && r.user_id === user!.id);
  if (existing) Object.assign(existing, values);
  else S.event_registrations.push({ event_id: ev.id, user_id: user!.id, ...values, created_at: now() });
  if (scholarship) {
    for (const a of admins()) {
      notify(a, { type: 'system', title: 'Antrag auf Förderplatz', body: `${user!.name}: ${ev.title_de}`, link: '/events' });
    }
  }
  return { ok: true, status };
});

on('POST', '/events/:id/withdraw', true, ({ params, user }) => {
  const eid = Number(params.id);
  S.event_registrations = S.event_registrations.filter((r) => !(r.event_id === eid && r.user_id === user!.id));
  return { ok: true };
});

on('POST', '/events/registrations/:eventId/:userId/decide', true, ({ params, user, body }) => {
  if (user!.role !== 'admin') throw new HttpError(403, 'Keine Berechtigung');
  const { status } = body || {};
  if (!['granted', 'waitlist', 'declined'].includes(status)) throw new HttpError(400, 'Ungültiger Status');
  const reg = S.event_registrations.find((r) => r.event_id === Number(params.eventId) && r.user_id === Number(params.userId));
  if (!reg || !reg.scholarship) throw new HttpError(404, 'Antrag nicht gefunden');
  reg.status = status;
  const ev = S.events.find((x) => x.id === reg.event_id)!;
  const label = ({ granted: 'gewährt', waitlist: 'auf der Warteliste', declined: 'abgelehnt' } as Record<string, string>)[status];
  notify(reg.user_id, { type: 'system', title: `Förderplatz ${label}`, body: ev.title_de, link: '/events' });
  return { ok: true };
});

// ===========================================================================
// Iteration 3 – Feedback an das Entwicklungsteam (1:1 zu server/src/routes/feedback.js)
// ===========================================================================
const FEEDBACK_CATEGORIES = ['bug', 'idea', 'usability', 'praise', 'other'];
const FEEDBACK_STATUSES = ['new', 'in_progress', 'done'];

on('GET', '/feedback', true, ({ user }) => {
  const all = user!.role === 'admin';
  const feedback = S.feedback
    .filter((f) => all || f.user_id === user!.id)
    .sort((a, b) => (b.status === 'new' ? 1 : 0) - (a.status === 'new' ? 1 : 0) || cmp(b.created_at, a.created_at))
    .map((f) => {
      const u = f.user_id != null ? findUser(f.user_id) : undefined;
      return { ...f, user_name: u?.name ?? null, user_role: u?.role ?? null };
    });
  return { feedback };
});

on('POST', '/feedback', true, ({ user, body }) => {
  const { category, area, rating, body: text, page } = body || {};
  if (!FEEDBACK_CATEGORIES.includes(category)) throw new HttpError(400, 'Ungültige Kategorie');
  if (!text || !String(text).trim()) throw new HttpError(400, 'Beschreibung erforderlich');
  const r = rating ? Math.max(1, Math.min(5, Number(rating) || 0)) || null : null;
  const id = nextId('feedback');
  const ts = now();
  S.feedback.push({
    id, user_id: user!.id, category, area: area || null, rating: r, body: String(text).slice(0, 5000),
    page: page ? String(page).slice(0, 200) : null, status: 'new', response: null, created_at: ts, updated_at: ts,
  });
  for (const a of admins().filter((a) => a !== user!.id)) {
    notify(a, { type: 'system', title: 'Neues Feedback', body: `${user!.name}: ${String(text).slice(0, 80)}`, link: '/feedback' });
  }
  return { status: 201, data: { id } };
});

on('PATCH', '/feedback/:id', true, ({ params, user, body }) => {
  if (user!.role !== 'admin') throw new HttpError(403, 'Keine Berechtigung');
  const fb = S.feedback.find((x) => x.id === Number(params.id));
  if (!fb) throw new HttpError(404, 'Feedback nicht gefunden');
  const { status, response } = body || {};
  if (status && !FEEDBACK_STATUSES.includes(status)) throw new HttpError(400, 'Ungültiger Status');
  const oldResponse = fb.response;
  if (status) fb.status = status;
  if (response !== undefined && response !== null) fb.response = response;
  fb.updated_at = now();
  if (fb.user_id && response && response !== oldResponse) {
    notify(fb.user_id, { type: 'system', title: 'Antwort auf dein Feedback', body: String(response).slice(0, 80), link: '/feedback' });
  }
  return { feedback: { ...fb } };
});

// ---------------------------------------------------------------------------
// fetch-Interceptor: faengt alle Aufrufe an /api/** ab
// ---------------------------------------------------------------------------
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handle(method: string, rawPath: string, init: RequestInit | undefined): Promise<Response> {
  const [pathname, search = ''] = rawPath.replace(/^\/api/, '').split('?');
  const query = new URLSearchParams(search);

  const headers = new Headers(init?.headers || {});
  const authHeader = headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const user = verifyToken(token);

  let body: any = undefined;
  if (typeof init?.body === 'string') {
    try { body = JSON.parse(init.body); } catch { body = undefined; }
  }

  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.re.exec(pathname);
    if (!m) continue;
    if (r.auth && !user) return jsonResponse({ error: 'Nicht authentifiziert' }, 401);

    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });

    try {
      const out = r.handler({ params, query, body, user });
      save();
      if (out && typeof out === 'object' && 'status' in out && 'data' in out) {
        return jsonResponse((out as any).data, (out as any).status);
      }
      return jsonResponse(out);
    } catch (err) {
      if (err instanceof HttpError) return jsonResponse({ error: err.message, ...(err.extra || {}) }, err.status);
      console.error(err);
      return jsonResponse({ error: 'Interner Serverfehler' }, 500);
    }
  }
  return jsonResponse({ error: 'Endpunkt nicht gefunden' }, 404);
}

export function installMockApi() {
  // Store laden oder frisch aufsetzen.
  let stored: string | null = null;
  try { stored = localStorage.getItem(STORE_KEY); } catch { stored = null; }
  let ok = false;
  if (stored) {
    try {
      S = JSON.parse(stored);
      ok = !!S && Array.isArray(S.users) && S.users.length > 0 && Array.isArray(S.cases) && Array.isArray(S.communities);
    } catch { ok = false; }
  }
  if (!ok) seed();

  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: any, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input?.url ?? String(input);
    const method = (init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
    if (url.startsWith('/api')) return handle(method, url, init);
    return originalFetch(input, init);
  }) as typeof window.fetch;

  // Demo-Daten zuruecksetzen (auch ueber den Button unten rechts erreichbar).
  (window as any).starsDemoReset = () => {
    try {
      localStorage.removeItem(STORE_KEY);
      localStorage.removeItem('stars_token');
    } catch { /* ignorieren */ }
    location.reload();
  };
}
