// Seed-Skript: befuellt die Datenbank mit realistischen DEMO-Daten, damit der
// Prototyp unmittelbar demonstrierbar ist. WICHTIG: Dies sind fiktive
// Demonstrationsinhalte des Prototyps, KEINE empirischen Erhebungsdaten.
//
// Ausfuehren:  npm run seed        (im Ordner /server oder via Root-Script)
import { db, initSchema, orderPair } from './db.js';
import { hashPassword } from './auth.js';
import { computeMatches } from './matching.js';

initSchema();

console.log('Bestehende Daten werden zurückgesetzt …');
for (const t of [
  'feedback', 'event_registrations', 'events', 'session_requests', 'intro_request_tags', 'intro_requests',
  'session_attendees', 'community_sessions', 'community_posts', 'community_members', 'communities',
  'case_events', 'reviews', 'agreements', 'case_matches', 'matching_briefs', 'plan_items',
  'need_tags', 'needs', 'cases', 'eem_profiles',
  'notifications', 'learning_progress', 'module_tags', 'learning_modules',
  'messages', 'conversations', 'matches', 'question_tags', 'questions',
  'comments', 'threads', 'forums', 'user_tags', 'tags', 'users',
]) {
  db.exec(`DELETE FROM ${t};`);
}
// Autoincrement-Zaehler zuruecksetzen (falls Tabelle existiert).
try { db.exec(`DELETE FROM sqlite_sequence;`); } catch { /* ignore */ }

const PW = hashPassword('stars1234'); // Demo-Passwort fuer alle Konten

// ---------------------------------------------------------------------------
// 1) Tags (Fachgebiete, Phasen, Maerkte)
// ---------------------------------------------------------------------------
const tagData = [
  // domain / skill
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
  // Iteration 3: Mentor:innen-Profil aus dem EEM-Feedback (Oktober 2026)
  ['institutional-sales', 'Institutioneller Vertrieb (B2G/B2B)', 'Institutional Sales (B2G/B2B)', 'domain'],
  ['intl-expansion', 'Internationale Expansion physischer Produkte', 'International Expansion of Physical Products', 'domain'],
  ['ip-manufacturing', 'IP & Fertigungsskalierung', 'IP & Scaling Manufacturing', 'domain'],
  // stage
  ['stage-idea', 'Phase: Idee', 'Stage: Idea', 'stage'],
  ['stage-early', 'Phase: Gründung', 'Stage: Early-Stage', 'stage'],
  ['stage-growth', 'Phase: Wachstum', 'Stage: Growth', 'stage'],
  // market / region
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
const insTag = db.prepare('INSERT INTO tags (slug, name_de, name_en, category) VALUES (?, ?, ?, ?)');
const tagId = {};
for (const [slug, de, en, cat] of tagData) {
  const info = insTag.run(slug, de, en, cat);
  tagId[slug] = Number(info.lastInsertRowid);
}
console.log(`  ${tagData.length} Tags`);

// ---------------------------------------------------------------------------
// 2) Nutzer:innen  (created_at gestaffelt fuer die Netzwerk-Wachstumskurve)
// ---------------------------------------------------------------------------
const insUser = db.prepare(
  `INSERT INTO users (email, password_hash, name, role, country, region, headline, bio, languages, avatar_seed, created_at)
   VALUES (@email, @pw, @name, @role, @country, @region, @headline, @bio, @languages, @avatar, datetime('now', @ago))`
);
function addUser(u) {
  return Number(insUser.run({ pw: PW, ...u }).lastInsertRowid);
}

// Admin (stars-Team)
const admin = addUser({
  email: 'admin@the-stars.ch', name: 'stars Administration', role: 'admin',
  country: 'Schweiz', region: 'Europe', headline: 'Programm-Management stars',
  bio: 'Koordiniert das Mentoring-Programm und die Community.', languages: 'de,en',
  avatar: 'stars-admin', ago: '-8 months',
});

// Mentor:innen (Alumni aus etablierten Maerkten)
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
const mentorIds = {};
for (const m of mentors) {
  const id = addUser({
    email: m.email, name: m.name, role: 'mentor', country: m.country, region: m.region,
    headline: m.headline, bio: m.bio, languages: 'en,de', avatar: m.name, ago: m.ago,
  });
  mentorIds[m.email] = id;
  const insUT = db.prepare('INSERT INTO user_tags (user_id, tag_id, weight) VALUES (?, ?, ?)');
  for (const [slug, w] of m.tags) insUT.run(id, tagId[slug], w);
}

// Entrepreneurs (aus Emerging Markets)
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
const entIds = {};
for (const e of entrepreneurs) {
  const id = addUser({
    email: e.email, name: e.name, role: 'entrepreneur', country: e.country, region: e.region,
    headline: e.headline, bio: e.bio, languages: 'en', avatar: e.name, ago: e.ago,
  });
  entIds[e.email] = id;
  const insUT = db.prepare('INSERT INTO user_tags (user_id, tag_id, weight) VALUES (?, ?, ?)');
  for (const [slug, w] of e.tags) insUT.run(id, tagId[slug], w);
}
console.log(`  ${1 + mentors.length + entrepreneurs.length} Nutzer:innen`);

// ---------------------------------------------------------------------------
// 3) Foren + Threads + Kommentare (Saeule 1: Community)
// ---------------------------------------------------------------------------
const forumData = [
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
const insForum = db.prepare(
  'INSERT INTO forums (slug, title_de, title_en, description_de, description_en, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
);
const forumId = {};
forumData.forEach(([slug, tde, ten, dde, den], i) => {
  forumId[slug] = Number(insForum.run(slug, tde, ten, dde, den, i).lastInsertRowid);
});

const insThread = db.prepare(
  `INSERT INTO threads (forum_id, author_id, title, body, created_at)
   VALUES (?, ?, ?, ?, datetime('now', ?))`
);
const insComment = db.prepare(
  `INSERT INTO comments (thread_id, author_id, body, created_at)
   VALUES (?, ?, ?, datetime('now', ?))`
);
function addThread(forum, author, title, body, ago, comments = []) {
  const tid = Number(insThread.run(forumId[forum], author, title, body, ago).lastInsertRowid);
  for (const [cAuthor, cBody, cAgo] of comments) insComment.run(tid, cAuthor, cBody, cAgo);
  return tid;
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

console.log(`  ${forumData.length} Foren mit Threads & Kommentaren`);

// ---------------------------------------------------------------------------
// 4) Fragen + Matching (Saeule 2a)
// ---------------------------------------------------------------------------
const insQuestion = db.prepare(
  `INSERT INTO questions (asker_id, title, body, created_at) VALUES (?, ?, ?, datetime('now', ?))`
);
const insQTag = db.prepare('INSERT INTO question_tags (question_id, tag_id) VALUES (?, ?)');
function addQuestion(asker, title, body, tags, ago) {
  const qid = Number(insQuestion.run(asker, title, body, ago).lastInsertRowid);
  for (const slug of tags) insQTag.run(qid, tagId[slug]);
  computeMatches(qid, 5); // Matching direkt berechnen und persistieren
  return qid;
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

console.log('  4 Fragen inkl. berechnetem Matching');

// ---------------------------------------------------------------------------
// 5) Microlearning-Bibliothek (Saeule 3)
// ---------------------------------------------------------------------------
const moduleData = [
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
const insModule = db.prepare(
  `INSERT INTO learning_modules (slug, title_de, title_en, description_de, description_en, duration_min, level)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const insMTag = db.prepare('INSERT INTO module_tags (module_id, tag_id) VALUES (?, ?)');
for (const [slug, tde, ten, dde, den, dur, lvl, tags] of moduleData) {
  const mid = Number(insModule.run(slug, tde, ten, dde, den, dur, lvl).lastInsertRowid);
  for (const t of tags) insMTag.run(mid, tagId[t]);
}
// Etwas Fortschritt fuer Demo-KPIs.
const insProg = db.prepare(
  `INSERT INTO learning_progress (user_id, module_id, progress, completed, updated_at)
   VALUES (?, ?, ?, ?, datetime('now','-1 days'))`
);
insProg.run(entIds['amara.okafor@example.com'], 1, 100, 1);
insProg.run(entIds['amara.okafor@example.com'], 2, 60, 0);
insProg.run(entIds['ravi.patel@example.com'], 3, 100, 1);
insProg.run(entIds['lucia.mendez@example.com'], 6, 40, 0);
console.log(`  ${moduleData.length} Lernmodule`);

// ---------------------------------------------------------------------------
// 6) Beispiel-Konversation (Saeule 2b) + Nachrichten
// ---------------------------------------------------------------------------
const [low, high] = orderPair(entIds['amara.okafor@example.com'], mentorIds['anna.keller@example.com']);
const convId = Number(
  db.prepare('INSERT INTO conversations (user_low, user_high, created_at) VALUES (?, ?, datetime(\'now\',\'-9 days\'))')
    .run(low, high).lastInsertRowid
);
const insMsg = db.prepare(
  `INSERT INTO messages (conversation_id, sender_id, body, read_at, created_at)
   VALUES (?, ?, ?, datetime('now', ?), datetime('now', ?))`
);
// read_at auf ein Datum nach dem Versand setzen (gelesen) bzw. NULL (ungelesen).
insMsg.run(convId, entIds['amara.okafor@example.com'], 'Hallo Anna, danke fürs Annehmen! Ich würde gerne über unsere Seed-Runde sprechen.', '-9 days', '-9 days');
insMsg.run(convId, mentorIds['anna.keller@example.com'], 'Sehr gerne, Amara. Schick mir am besten dein aktuelles Financial Model, dann schauen wir es gemeinsam an.', '-8 days', '-8 days');
db.prepare(
  `INSERT INTO messages (conversation_id, sender_id, body, read_at, created_at)
   VALUES (?, ?, ?, NULL, datetime('now', ?))`
).run(convId, entIds['amara.okafor@example.com'], 'Perfekt, ich bereite es bis morgen vor.', '-8 days');
console.log('  1 Beispiel-Konversation');

// ---------------------------------------------------------------------------
// 6b) Iteration 2: Unterstuetzer-Merkmale, Communities of Practice und
//     Beispielfaelle entlang der Support Journey (fiktive Demo-Daten!)
// ---------------------------------------------------------------------------
const supporterData = {
  'anna.keller@example.com': ['lead_mentor,expert', 6, ['net-investors']],
  'marco.rossi@example.com': ['expert', 3, ['net-academia']],
  'sara.lindqvist@example.com': ['lead_mentor,expert,connector', 4, ['net-distribution', 'net-corporates']],
  'david.chen@example.com': ['expert,connector', 2, ['net-distribution', 'net-corporates']],
  'fatima.zahra@example.com': ['connector,expert', 3, ['net-investors', 'net-ngo']],
  'thomas.mueller@example.com': ['expert', 2, ['net-government']],
  'grace.otieno@example.com': ['lead_mentor,connector', 5, ['net-corporates', 'net-government']],
  'james.wong@example.com': ['expert,connector', 1, ['net-investors']],
};
const updSupporter = db.prepare('UPDATE users SET support_roles = ?, capacity_hours = ?, available = 1 WHERE id = ?');
const insNetTag = db.prepare('INSERT INTO user_tags (user_id, tag_id, weight) VALUES (?, ?, 4) ON CONFLICT DO NOTHING');
for (const [email, [roles, hours, nets]] of Object.entries(supporterData)) {
  updSupporter.run(roles, hours, mentorIds[email]);
  for (const n of nets) insNetTag.run(mentorIds[email], tagId[n]);
}

// --- Communities of Practice ------------------------------------------------
const insCommunity = db.prepare(
  `INSERT INTO communities (slug, name_de, name_en, description_de, description_en, tag_id, created_at)
   VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-3 months'))`
);
const insMember = db.prepare(
  `INSERT INTO community_members (community_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`
);
const insCPost = db.prepare(
  `INSERT INTO community_posts (community_id, author_id, body, created_at) VALUES (?, ?, ?, datetime('now', ?))`
);
const insSession = db.prepare(
  `INSERT INTO community_sessions (community_id, host_id, title, description, format, starts_at, created_at)
   VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%d 15:00', 'now', ?), datetime('now', '-10 days'))`
);
const insAttendee = db.prepare('INSERT INTO session_attendees (session_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING');
const M = (e) => mentorIds[e];
const E = (e) => entIds[e];

const communityData = [
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
let sessionCount = 0;
for (const c of communityData) {
  const cid = Number(insCommunity.run(c.slug, c.de, c.en, c.dde, c.den, tagId[c.tag]).lastInsertRowid);
  for (const m of c.mods) insMember.run(cid, m, 'moderator');
  for (const m of c.members) insMember.run(cid, m, 'member');
  for (const [author, body, ago] of c.posts) insCPost.run(cid, author, body, ago);
  for (const [host, title, desc, fmt, when, attendees] of c.sessions) {
    const sid = Number(insSession.run(cid, host, title, desc, fmt, when).lastInsertRowid);
    for (const a of attendees) insAttendee.run(sid, a);
    sessionCount++;
  }
}
console.log(`  ${communityData.length} Communities of Practice, ${sessionCount} Sessions`);

// --- Support Journey: Beispielfaelle in unterschiedlichen Schritten ----------
const insProfile = db.prepare(
  `INSERT INTO eem_profiles (user_id, case_type, context, ecosystem, venture, entrepreneur, validated_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-20 days'))`
);
const insCase = db.prepare(
  `INSERT INTO cases (eem_id, coordinator_id, step, intake_decision, motivation, expectations, plan_consent_at,
                      closed_reason, closing_note, created_at, updated_at)
   VALUES (@eem, @coord, @step, @decision, @motivation, @expectations, @consent, @reason, @note,
           datetime('now', @created), datetime('now', @updated))`
);
const insNeed = db.prepare(
  `INSERT INTO needs (case_id, goal, bottleneck, support_needed, success_criterion, relevance, urgency, impact,
                      stars_contribution, feasibility, priority_rank, status, created_by, created_at)
   VALUES (@case, @goal, @bottleneck, @support, @criterion, @r, @u, @i, @s, @f, @rank, @status, @by, datetime('now', @ago))`
);
const insNeedTag = db.prepare('INSERT INTO need_tags (need_id, tag_id) VALUES (?, ?)');
const insPlan = db.prepare('INSERT INTO plan_items (need_id, format, note, sort_order) VALUES (?, ?, ?, ?)');
const insBrief = db.prepare(
  `INSERT INTO matching_briefs (need_id, main_role, experience, context_ref, network_access, language, duration, working_mode)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const insCMatch = db.prepare(
  `INSERT INTO case_matches (need_id, supporter_id, role, score, status, supporter_ok, eem_ok, invited_by, created_at, confirmed_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), CASE WHEN ? IS NULL THEN NULL ELSE datetime('now', ?) END)`
);
const insAgreement = db.prepare(
  `INSERT INTO agreements (need_id, goal, roles, next_steps, review_date) VALUES (?, ?, ?, ?, date('now', ?))`
);
const insReview = db.prepare(
  `INSERT INTO reviews (need_id, progress, outcome, next_step, created_by, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))`
);
const insEvent = db.prepare(
  `INSERT INTO case_events (case_id, user_id, type, step, body, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))`
);
const J = (o) => JSON.stringify(o);
function addNeed(caseId, n) {
  const id = Number(
    insNeed.run({
      case: caseId, goal: n.goal, bottleneck: n.bottleneck ?? null, support: n.support ?? null,
      criterion: n.criterion ?? null, r: n.r ?? null, u: n.u ?? null, i: n.i ?? null, s: n.s ?? null,
      f: n.f ?? null, rank: n.rank ?? null, status: n.status ?? 'open', by: n.by ?? admin, ago: n.ago ?? '-15 days',
    }).lastInsertRowid
  );
  for (const t of n.tags || []) insNeedTag.run(id, tagId[t]);
  (n.plan || []).forEach(([fmt, note], i) => insPlan.run(id, fmt, note, i));
  if (n.brief) insBrief.run(id, ...n.brief);
  return id;
}
function steps(caseId, user, list) {
  for (const [step, body, ago] of list) insEvent.run(caseId, user, 'step', step, body, ago);
}

// Fall 1 – Amara Okafor (Venture Scaler): in der Umsetzung, zwei bestaetigte Matches.
const amara = E('amara.okafor@example.com');
insProfile.run(
  amara, 'venture_scaler',
  J({ target_markets: 'Nigeria, Ghana', setting: 'mixed', conditions: ['infrastructure', 'capital_access', 'payment_terms'], conditions_note: 'Lange Zahlungsfristen bei Grosskunden, Stromausfälle in Lagerhäusern.' }),
  J({ existing_support: ['accelerator', 'informal_network'], access_quality: '2', gaps: 'Kaum Zugang zu Distributoren ausserhalb Nigerias.' }),
  J({ sector: 'AgriTech', business_model: 'B2B-Plattform für Kleinbauern und Abnehmer', stage: 'growth', employees: '11-50', revenue: '100k-1m' }),
  J({ experience: '5-10', prior_programs: 'yes', hours_per_month: '4-8', languages: ['en'], mode: 'online', strengths: 'Netzwerk zu Kooperativen, Produktentwicklung' }),
  null
);
db.prepare(`UPDATE eem_profiles SET validated_at = datetime('now','-18 days') WHERE user_id = ?`).run(amara);
const c1 = Number(insCase.run({
  eem: amara, coord: admin, step: 'implementation', decision: 'accepted',
  motivation: 'Wir wollen nach Ghana expandieren und brauchen Zugang zu Distributoren und eine Finanzierung für Working Capital.',
  expectations: 'Begleitung über 6 Monate; monatliche Termine; Amara bringt Zahlen und Kontaktliste ein.',
  consent: null, reason: null, note: null, created: '-30 days', updated: '-6 days',
}).lastInsertRowid);
db.prepare(`UPDATE cases SET plan_consent_at = datetime('now','-12 days') WHERE id = ?`).run(c1);
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
insCMatch.run(n11, M('grace.otieno@example.com'), 'lead_mentor', 88.5, 'confirmed', 1, 1, admin, '-11 days', 1, '-9 days');
insCMatch.run(n12, M('anna.keller@example.com'), 'expert', 90.2, 'confirmed', 1, 1, admin, '-11 days', 1, '-10 days');
insAgreement.run(n11, 'Zwei Distributionspartner in Ghana gewinnen', 'Grace: Lead Mentorin, öffnet Kontakte; Amara: Gespräche führen', 'Kontaktliste bis Ende Monat, erstes Gespräch in Accra', '+25 days');
insAgreement.run(n12, 'Finanzierungsplan und zwei Investorengespräche', 'Anna: Fachexpertin Finanzierung; Amara: Zahlen liefern', 'Financial Model überarbeiten', '+6 days');
steps(c1, admin, [
  ['intake', 'Aufnahmeantrag', '-30 days'], ['assessment', 'Aufnahme bestätigt', '-28 days'],
  ['prioritization', 'Profil validiert', '-22 days'], ['support_plan', 'Zwei Bedarfe priorisiert', '-16 days'],
  ['matching', 'Supportplan bestätigt', '-12 days'], ['agreement', 'Matches bestätigt', '-8 days'],
  ['implementation', 'Vereinbarungen festgehalten', '-6 days'],
]);
insEvent.run(c1, M('grace.otieno@example.com'), 'progress', 'implementation', 'Erstes Gespräch mit einem Distributor in Accra geführt; zweites ist terminiert.', '-2 days');

// Fall 2 – Kwame Mensah: im Matching, Einladung an Connector offen.
const kwame = E('kwame.mensah@example.com');
insProfile.run(
  kwame, 'venture_scaler',
  J({ target_markets: 'Ghana, Togo', setting: 'rural', conditions: ['energy', 'capital_access'] }),
  J({ existing_support: ['ngo_program'], access_quality: '2', gaps: 'Keine Kontakte zu Impact-Investoren' }),
  J({ sector: 'Clean Energy', business_model: 'Solar-Home-Systeme mit Pay-as-you-go', stage: 'growth', employees: '11-50', revenue: '100k-1m' }),
  J({ experience: '3-5', prior_programs: 'no', hours_per_month: '4-8', languages: ['en'], mode: 'online' }),
  null
);
db.prepare(`UPDATE eem_profiles SET validated_at = datetime('now','-9 days') WHERE user_id = ?`).run(kwame);
const c2 = Number(insCase.run({
  eem: kwame, coord: admin, step: 'matching', decision: 'accepted',
  motivation: 'Wir suchen Impact-Investoren für die nächste Wachstumsphase.',
  expectations: 'Begleitung über 3 Monate, Fokus auf Investorenzugang.',
  consent: null, reason: null, note: null, created: '-14 days', updated: '-2 days',
}).lastInsertRowid);
db.prepare(`UPDATE cases SET plan_consent_at = datetime('now','-3 days') WHERE id = ?`).run(c2);
const n21 = addNeed(c2, {
  goal: 'Zugang zu drei Impact-Investoren für eine Seed-Extension', bottleneck: 'Kein Netzwerk zu Impact-Fonds; Pitch nicht auf Impact-KPIs ausgerichtet',
  support: 'Connector mit Investorenzugang', criterion: 'Drei Erstgespräche mit Impact-Investoren',
  r: 3, u: 3, i: 3, s: 3, f: 3, rank: 1, ago: '-8 days', by: kwame,
  tags: ['sustainability', 'financing', 'net-investors'],
  plan: [['introductions', 'Warm Intros zu Impact-Fonds'], ['knowledge_sharing', 'Community «Access to Finance»']],
  brief: ['connector', 'Impact-Finanzierung, Erneuerbare Energie', 'Westafrika oder vergleichbare Märkte', 'Impact-Investor:innen, DFIs', 'en', '3 Monate', 'online'],
});
insCMatch.run(n21, M('fatima.zahra@example.com'), 'connector', 86.0, 'invited', 0, 0, admin, '-1 days', null, null);
steps(c2, admin, [
  ['intake', 'Aufnahmeantrag', '-14 days'], ['assessment', 'Aufnahme bestätigt', '-13 days'],
  ['prioritization', 'Profil validiert', '-9 days'], ['support_plan', 'Bedarf priorisiert', '-6 days'],
  ['matching', 'Supportplan bestätigt', '-2 days'],
]);

// Fall 3 – Linh Tran: Priorisierung steht noch aus.
const linh = E('linh.tran@example.com');
insProfile.run(
  linh, 'venture_scaler',
  J({ target_markets: 'Vietnam, Singapur', setting: 'urban', conditions: ['regulation'] }),
  J({ existing_support: ['accelerator'], access_quality: '3' }),
  J({ sector: 'D2C Food', business_model: 'Nachhaltige Snacks, Online und Retail', stage: 'market_entry', employees: '1-10', revenue: '<100k' }),
  J({ experience: '1-3', prior_programs: 'yes', hours_per_month: '2-4', languages: ['en'], mode: 'online' }),
  null
);
db.prepare(`UPDATE eem_profiles SET validated_at = datetime('now','-1 days') WHERE user_id = ?`).run(linh);
const c3 = Number(insCase.run({
  eem: linh, coord: admin, step: 'prioritization', decision: 'accepted',
  motivation: 'Ich möchte Operations und Team professionalisieren.', expectations: '3 Monate, Fokus Operations.',
  consent: null, reason: null, note: null, created: '-7 days', updated: '-1 days',
}).lastInsertRowid);
addNeed(c3, { goal: 'Lieferkette für den Export nach Singapur aufbauen', bottleneck: 'Keine Erfahrung mit Kühlkette und Exportvorschriften', support: 'Operations-Expertise', criterion: 'Exportfähige Lieferkette für ein Produkt', r: 3, u: 2, i: 3, s: 3, f: 2, ago: '-1 days', by: linh, tags: ['operations', 'market-sea'] });
addNeed(c3, { goal: 'Delegationsstruktur im Team einführen', bottleneck: 'Gründerin ist in alle Entscheidungen involviert', support: 'Leadership-Mentoring', r: 2, u: 2, i: 2, s: 2, f: 3, ago: '-1 days', by: linh, tags: ['leadership'] });
steps(c3, admin, [['intake', 'Aufnahmeantrag', '-7 days'], ['assessment', 'Aufnahme bestätigt', '-6 days'], ['prioritization', 'Profil validiert', '-1 days']]);

// Fall 4 – Omar Haddad: Aufnahmeantrag offen.
const omar = E('omar.haddad@example.com');
const c4 = Number(insCase.run({
  eem: omar, coord: null, step: 'intake', decision: 'pending',
  motivation: 'Wir bereiten eine Finanzierungsrunde vor und brauchen Unterstützung bei Rechtsfragen in Jordanien und Saudi-Arabien.',
  expectations: null, consent: null, reason: null, note: null, created: '-1 days', updated: '-1 days',
}).lastInsertRowid);
steps(c4, omar, [['intake', 'Aufnahmeantrag', '-1 days']]);

// Fall 5 – Lucia Mendez: abgeschlossen, Ziel erreicht (Outcome-Daten).
const lucia = E('lucia.mendez@example.com');
insProfile.run(
  lucia, 'venture_scaler',
  J({ target_markets: 'Kolumbien, Mexiko', setting: 'urban', conditions: ['logistics'] }),
  J({ existing_support: ['informal_network'], access_quality: '3' }),
  J({ sector: 'E-Commerce', business_model: 'Marktplatz für Kunsthandwerk', stage: 'growth', employees: '11-50', revenue: '100k-1m' }),
  J({ experience: '5-10', prior_programs: 'yes', hours_per_month: '4-8', languages: ['en'], mode: 'online' }),
  null
);
db.prepare(`UPDATE eem_profiles SET validated_at = datetime('now','-80 days') WHERE user_id = ?`).run(lucia);
const c5 = Number(insCase.run({
  eem: lucia, coord: admin, step: 'closed', decision: 'accepted',
  motivation: 'Markteintritt in Mexiko.', expectations: '4 Monate Begleitung.', consent: null,
  reason: 'goal_achieved', note: 'Ziel erreicht: Distributionspartner in Mexiko gewonnen, erster Umsatz im Zielmarkt.',
  created: '-90 days', updated: '-5 days',
}).lastInsertRowid);
const n51 = addNeed(c5, {
  goal: 'Distributionspartner in Mexiko gewinnen', bottleneck: 'Fehlende Kontakte im Handel', support: 'Connector im lateinamerikanischen Handel',
  criterion: 'Ein unterzeichneter Partnervertrag', r: 3, u: 3, i: 3, s: 3, f: 3, rank: 1, status: 'achieved', ago: '-80 days', by: lucia,
  tags: ['sales', 'market-latam', 'net-distribution'],
  plan: [['introductions', 'Warm Intros zu Händlern'], ['mentoring', 'Begleitung der Verhandlungen']],
  brief: ['connector', 'Handel und Vertrieb Konsumgüter', 'Lateinamerika', 'Distribution & Handel', 'en', '4 Monate', 'online'],
});
insCMatch.run(n51, M('sara.lindqvist@example.com'), 'connector', 91.0, 'confirmed', 1, 1, admin, '-70 days', 1, '-66 days');
db.prepare(`INSERT INTO agreements (need_id, goal, roles, next_steps, review_date) VALUES (?, ?, ?, ?, date('now','-10 days'))`)
  .run(n51, 'Partnervertrag mit einem Händler in Mexiko', 'Sara: Connector; Lucia: Verhandlung', 'Drei Intros, Pilotbestellung');
insReview.run(n51, 'achieved', 'Partnervertrag mit Händlernetz in Mexiko-Stadt unterzeichnet; erste Bestellung ausgeliefert.', 'close', admin, '-6 days');
steps(c5, admin, [['intake', 'Aufnahmeantrag', '-90 days'], ['reassessment', 'Review durchgeführt', '-6 days'], ['closed', 'Ziel erreicht', '-5 days']]);

// Eine zusaetzliche Teil-Wirkung fuer die Outcome-Auswertung (Amara, Bedarf 2).
insReview.run(n12, 'partial', 'Financial Model überarbeitet; erstes Investorengespräch geführt.', 'continue', M('anna.keller@example.com'), '-1 days');

// Benachrichtigungen passend zum Demo-Stand.
const insNotif = db.prepare(
  `INSERT INTO notifications (user_id, type, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))`
);
insNotif.run(M('fatima.zahra@example.com'), 'match', 'Anfrage von stars: Unterstützung gesucht', 'Bedarf: «Zugang zu drei Impact-Investoren …». Bitte Matching Brief prüfen.', `/journey/${c2}`, '-1 days');
insNotif.run(admin, 'system', 'Neuer Aufnahmeantrag', 'Omar Haddad möchte in die Support Journey aufgenommen werden.', `/journey/${c4}`, '-1 days');
console.log('  5 Support-Journey-Fälle (Aufnahme, Priorisierung, Matching, Umsetzung, Abschluss)');

// ---------------------------------------------------------------------------
// 6c) Iteration 3: Netzwerkzugang, Give-back und Veranstaltungen.
//     Die Persona «Sunita Rai» ist FIKTIV und lediglich an das Feedback einer
//     stars-Fellow angelehnt (Oktober 2026); im oeffentlich zugaenglichen
//     Prototyp werden keine Echtnamen verwendet (Datenminimierung).
// ---------------------------------------------------------------------------
const alumni3 = [
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
const insUT3 = db.prepare('INSERT INTO user_tags (user_id, tag_id, weight) VALUES (?, ?, ?) ON CONFLICT DO NOTHING');
for (const m of alumni3) {
  const id = addUser({
    email: m.email, name: m.name, role: 'mentor', country: m.country, region: m.region,
    headline: m.headline, bio: m.bio, languages: 'en', avatar: m.name, ago: '-1 months',
  });
  mentorIds[m.email] = id;
  updSupporter.run(m.roles, m.hours, id);
  for (const [slug, w] of m.tags) insUT3.run(id, tagId[slug], w);
}

const sunita = addUser({
  email: 'sunita.rai@example.com', name: 'Sunita Rai', role: 'entrepreneur', country: 'Nepal', region: 'South Asia',
  headline: 'Gründerin, Hardware-EdTech (fiktive Persona)',
  bio: 'Patentiertes Lerngerät für Schulen, in Nepal bewährt. Nächster Schritt: Operations in Indien, Kenia oder Bangladesch – über Institutionen der Bildungsentwicklung. Teilt gerne eigene Gründungserfahrung.',
  languages: 'en', avatar: 'Sunita Rai', ago: '-20 days',
});
entIds['sunita.rai@example.com'] = sunita;
db.prepare('UPDATE users SET offers_peer_support = 1 WHERE id = ?').run(sunita);
for (const [slug, w] of [['intl-expansion', 5], ['institutional-sales', 4], ['product', 4], ['market-sa', 5], ['stage-growth', 3]])
  insUT3.run(sunita, tagId[slug], w);

// Support-Journey-Fall im Matching: Der Matching Brief bildet das gewuenschte
// Mentor:innen-Profil ab (institutioneller Vertrieb, Entwicklungsorganisationen,
// Expansion physischer Produkte, IP/Fertigung).
insProfile.run(
  sunita, 'venture_scaler',
  J({ target_markets: 'Indien, Kenia, Bangladesch', setting: 'mixed', conditions: ['regulation', 'capital_access'], conditions_note: 'Kein Vorbild eines nepalesischen Hardware-Produkts mit Operations im Ausland.' }),
  J({ existing_support: ['informal_network'], access_quality: '2', gaps: 'Kaum Zugang zu Stiftungen, CSR-Programmen und Entwicklungsorganisationen.' }),
  J({ sector: 'EdTech (Hardware)', business_model: 'Verkauf an Schulen und Bildungsprogramme (B2G/B2B)', stage: 'growth', employees: '11-50', revenue: '100k-1m' }),
  J({ experience: '3-5', prior_programs: 'yes', hours_per_month: '4-8', languages: ['en'], mode: 'online', strengths: 'Patent, Produkt im Heimmarkt bewiesen' }),
  null
);
db.prepare(`UPDATE eem_profiles SET validated_at = datetime('now','-6 days') WHERE user_id = ?`).run(sunita);
const c6 = Number(insCase.run({
  eem: sunita, coord: admin, step: 'matching', decision: 'accepted',
  motivation: 'Wir möchten Operations in einem zweiten Land aufbauen und dafür mit Institutionen arbeiten, die Bildungsentwicklungsprojekte umsetzen.',
  expectations: 'Begleitung über 6 Monate; Fokus auf Markteintritt über Institutionen und Fertigung.',
  consent: null, reason: null, note: null, created: '-12 days', updated: '-1 days',
}).lastInsertRowid);
db.prepare(`UPDATE cases SET plan_consent_at = datetime('now','-1 days') WHERE id = ?`).run(c6);
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
const chapterId = Number(insCommunity.run(
  'online-alumni-chapter', 'Online Alumni Chapter', 'Online Alumni Chapter',
  'Ortsunabhängiges Chapter für Fellows und Alumni: Pitch & Learn, Peer-Austausch zwischen Entrepreneurs aus Emerging Markets und Give-back.',
  'Location-independent chapter for fellows and alumni: pitch & learn, peer exchange between emerging-market entrepreneurs and give-back.',
  tagId['intl-expansion']
).lastInsertRowid);
insMember.run(chapterId, admin, 'moderator');
for (const m of [sunita, M('martina.brunner@example.com'), M('priya.nair@example.com'), M('daniel.kiprop@example.com'),
  M('kenji.tanaka@example.com'), E('ravi.patel@example.com'), E('kwame.mensah@example.com'), M('anna.keller@example.com')]) insMember.run(chapterId, m, 'member');
insCPost.run(chapterId, sunita, 'Hallo zusammen! Unser Lerngerät ist in Nepal erprobt und patentiert. Wer hat Erfahrung damit, über Stiftungen oder Bildungsprogramme in einen neuen Markt zu gehen?', '-4 days');
insCPost.run(chapterId, M('priya.nair@example.com'), 'Sunita, Entwicklungsorganisationen beschaffen meist über Rahmenverträge. Frühzeitig klären: Zertifizierungen, Lieferfähigkeit, Referenzprojekte. Gerne mehr in deiner Session.', '-3 days');
insCPost.run(chapterId, M('kenji.tanaka@example.com'), 'Wir haben unsere Holding in Singapur aufgebaut – Zugang zu Kapital und IP-Schutz war dort deutlich einfacher. Ich biete dazu eine Peer Session an.', '-2 days');
const pitchSid = Number(insSession.run(chapterId, sunita, 'Pitch & Learn: Lernhardware über Bildungsinstitutionen skalieren',
  'Sunita stellt ihr Produkt vor und lernt von Alumni aus Stiftungen und CSR, wie diese neue Innovationen übernehmen.', 'pitch_learn', '+12 days').lastInsertRowid);
for (const a of [sunita, M('martina.brunner@example.com'), M('priya.nair@example.com')]) insAttendee.run(pitchSid, a);
const sgSid = Number(insSession.run(chapterId, M('kenji.tanaka@example.com'), 'Singapur als Unternehmensbasis für Emerging-Market-Ventures',
  'Peer Session: Holding, Banking, IP – Erfahrungen und Fallstricke.', 'peer_session', '+20 days').lastInsertRowid);
insAttendee.run(sgSid, sunita);
db.prepare(
  `INSERT INTO session_requests (community_id, requester_id, title, description, audience, preferred_date, created_at)
   VALUES (?, ?, ?, ?, ?, date('now','+25 days'), datetime('now','-1 days'))`
).run(chapterId, E('ravi.patel@example.com'), 'Pitch & Learn: Telemedizin für ländliche Kliniken',
  'Kurzvorstellung und Diskussion, wie Gesundheitsstiftungen Pilotprojekte auswählen.', 'Alumni aus Gesundheitsstiftungen und CSR');

// Intro-Anfragen (Warm Introductions mit stars-Empfehlung).
const insIntro = db.prepare(
  `INSERT INTO intro_requests (requester_id, target_profile, purpose, status, supporter_id, vouch_note, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))`
);
const insIntroTag = db.prepare('INSERT INTO intro_request_tags (intro_id, tag_id) VALUES (?, ?)');
const i1 = Number(insIntro.run(sunita, 'Alumni, die in oder mit Stiftungen bzw. CSR-Programmen mit Bildungsfokus arbeiten',
  'Erfindung vorstellen und verstehen, wie Stiftungen neue Bildungsprojekte auswählen und übernehmen.', 'requested', null, null, '-2 days', '-2 days').lastInsertRowid);
for (const t of ['net-foundations', 'net-ngo', 'institutional-sales', 'market-sa']) insIntroTag.run(i1, tagId[t]);
const i2 = Number(insIntro.run(E('omar.haddad@example.com'), 'Investor:in mit Erfahrung in EdTech im MENA-Raum',
  'Feedback zum Pitch und Einschätzung der Finanzierungsstrategie vor der ersten Runde.', 'proposed', M('anna.keller@example.com'),
  'Omar ist seit einem Monat Fellow; sein Team hat eine funktionierende Lernplattform mit zahlenden Schulen. stars kennt ihn aus dem Aufnahmegespräch und empfiehlt ein kurzes Kennenlernen.', '-5 days', '-1 days').lastInsertRowid);
for (const t of ['financing', 'net-investors', 'market-mena']) insIntroTag.run(i2, tagId[t]);
insNotif.run(M('anna.keller@example.com'), 'match', 'stars möchte dich Omar Haddad vorstellen', 'Investor:in mit Erfahrung in EdTech im MENA-Raum', '/network', '-1 days');
insNotif.run(admin, 'system', 'Neue Intro-Anfrage', 'Sunita Rai: Alumni in Stiftungen/CSR mit Bildungsfokus', '/network', '-2 days');

// Veranstaltungen von stars (Termine gemaess stars, Stand Oktober 2026).
const insEv = db.prepare(
  `INSERT INTO events (slug, kind, title_de, title_en, location, starts_on, ends_on, description_de, description_en, url)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'https://www.the-stars.ch')`
);
const ev = {};
for (const [slug, kind, de, en, loc, from, to, dde, den] of [
  ['india-2027', 'study_tour', 'stars India Study Tour', 'stars India Study Tour', 'Mumbai, Pune, Bengaluru (in Partnerschaft mit Tata)', '2027-01-17', '2027-01-23',
    'Studienreise zu Unternehmen und Gründer:innen in drei indischen Wirtschaftszentren.', 'Study tour to companies and founders in three Indian business hubs.'],
  ['bulgaria-2027', 'study_tour', 'stars Bulgaria Study Tour', 'stars Bulgaria Study Tour', 'Sofia', '2027-05-06', '2027-05-09',
    'Studienreise in das Tech- und Start-up-Ökosystem von Sofia.', 'Study tour to the Sofia tech and start-up ecosystem.'],
  ['singapore-2027', 'symposium', 'stars Singapore Symposium', 'stars Singapore Symposium', 'Singapur', '2027-06-23', '2027-06-26',
    'Symposium für Leaders of the Next Generation in Asien.', 'Symposium for Leaders of the Next Generation in Asia.'],
  ['switzerland-2027', 'symposium', 'stars Switzerland Symposium', 'stars Switzerland Symposium', 'Wolfsberg, Ermatingen', '2027-09-03', '2027-09-06',
    'Symposium am Bodensee mit Fellows, Alumni und Partnern.', 'Symposium at Lake Constance with fellows, alumni and partners.'],
]) ev[slug] = Number(insEv.run(slug, kind, de, en, loc, from, to, dde, den).lastInsertRowid);
const insReg = db.prepare(
  `INSERT INTO event_registrations (event_id, user_id, scholarship, motivation, status, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))`
);
insReg.run(ev['singapore-2027'], sunita, 1, 'Ohne Firmensponsoring kann ich die Teilnahme nicht finanzieren. Das Symposium wäre der Zugang zu Partnern für den Aufbau einer Unternehmensbasis in Singapur.', 'requested', '-3 days');
insReg.run(ev['india-2027'], E('amara.okafor@example.com'), 0, null, 'interested', '-6 days');
insReg.run(ev['india-2027'], E('ravi.patel@example.com'), 1, 'Austausch mit indischen HealthTech-Unternehmen und potenziellen Partnern vor Ort.', 'waitlist', '-9 days');
insNotif.run(admin, 'system', 'Antrag auf Förderplatz', 'Sunita Rai: stars Singapore Symposium', '/events', '-3 days');
console.log('  Iteration 3: 4 Alumni, 1 Persona-Fall, Online Alumni Chapter, 2 Intro-Anfragen, 4 Veranstaltungen');

// ---------------------------------------------------------------------------
// 7) Ein paar Start-Benachrichtigungen fuer die Admin-Demo
// ---------------------------------------------------------------------------
db.prepare(
  `INSERT INTO notifications (user_id, type, title, body, link, created_at)
   VALUES (?, 'system', 'Willkommen bei stars', 'Dein Konto wurde erfolgreich erstellt.', '/dashboard', datetime('now','-1 days'))`
).run(entIds['amara.okafor@example.com']);

console.log('\nSeed abgeschlossen.\n');
console.log('Demo-Logins (Passwort für alle: stars1234):');
console.log('  Admin:        admin@the-stars.ch');
console.log('  Mentor:in:    anna.keller@example.com');
console.log('  Entrepreneur: amara.okafor@example.com');
console.log('  Weitere: kwame.mensah@example.com (Matching), fatima.zahra@example.com (offene Einladung)');
console.log('  Iteration 3: sunita.rai@example.com (Intro-Anfrage, Pitch & Learn, Förderplatz)');
