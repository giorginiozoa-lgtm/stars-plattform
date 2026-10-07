// Datenbankzugriff der stars-Plattform.
// Verwendet das in Node.js integrierte SQLite-Modul (node:sqlite) – dadurch
// werden keine nativen Build-Tools benoetigt und die DB ist eine einzelne
// Datei (ressourcenschonend, passt zum Offline-/Low-Bandwidth-Ziel).
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'data.sqlite');

export const db = new DatabaseSync(DB_PATH);

// Referentielle Integritaet und WAL-Modus (bessere Nebenlaeufigkeit).
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// -----------------------------------------------------------------------------
// Schema (Data Definition Language). Ein einziger Ort als Wahrheitsquelle,
// wird beim Start idempotent angewendet (CREATE TABLE IF NOT EXISTS).
// -----------------------------------------------------------------------------
export function initSchema() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('entrepreneur','mentor','admin')),
    country       TEXT,
    region        TEXT,               -- z.B. 'Sub-Saharan Africa'
    headline      TEXT,               -- kurze Rolle/Position
    bio           TEXT,
    languages     TEXT,               -- kommagetrennt, z.B. 'de,en'
    avatar_seed   TEXT,               -- für generierte Avatare (kein Bild-Upload nötig)
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tags (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    slug      TEXT NOT NULL UNIQUE,
    name_de   TEXT NOT NULL,
    name_en   TEXT NOT NULL,
    category  TEXT NOT NULL           -- 'domain' | 'stage' | 'market' | 'skill'
  );

  -- Fachgebiete/Interessen der Nutzer:innen (Mentor:innen = Expertise,
  -- Entrepreneurs = Interessen). Grundlage der Matching-Logik.
  CREATE TABLE IF NOT EXISTS user_tags (
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_id    INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    weight    INTEGER NOT NULL DEFAULT 3,   -- Selbsteinschätzung 1..5 (Kompetenzgrad)
    PRIMARY KEY (user_id, tag_id)
  );

  -- Saeule 1: Community (themenbezogene Foren mit Threads und Kommentaren)
  CREATE TABLE IF NOT EXISTS forums (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    slug           TEXT NOT NULL UNIQUE,
    title_de       TEXT NOT NULL,
    title_en       TEXT NOT NULL,
    description_de TEXT,
    description_en TEXT,
    sort_order     INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS threads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    forum_id    INTEGER NOT NULL REFERENCES forums(id) ON DELETE CASCADE,
    author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id   INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Saeule 2a: Fragen der Entrepreneurs -> Matching auf Expert:innen
  CREATE TABLE IF NOT EXISTS questions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    asker_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','matched','resolved')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS question_tags (
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, tag_id)
  );

  -- Ergebnis der Matching-Logik: vorgeschlagene/akzeptierte Zuordnungen
  CREATE TABLE IF NOT EXISTS matches (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    mentor_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score       REAL NOT NULL,
    status      TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','accepted','declined')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (question_id, mentor_id)
  );

  -- Saeule 2b: 1:1-Direktnachrichten
  CREATE TABLE IF NOT EXISTS conversations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_low    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_high   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_low, user_high)      -- user_low < user_high erzwingt genau eine Konversation je Paar
  );

  CREATE TABLE IF NOT EXISTS messages (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id  INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body             TEXT NOT NULL,
    read_at          TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Saeule 3: Microlearning-Bibliothek
  CREATE TABLE IF NOT EXISTS learning_modules (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    slug           TEXT NOT NULL UNIQUE,
    title_de       TEXT NOT NULL,
    title_en       TEXT NOT NULL,
    description_de TEXT,
    description_en TEXT,
    video_url      TEXT,               -- Platzhalter-URL (Content-Produktion = Nicht-Ziel)
    duration_min   INTEGER NOT NULL DEFAULT 5,
    level          TEXT NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner','intermediate','advanced')),
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS module_tags (
    module_id INTEGER NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
    tag_id    INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (module_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS learning_progress (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id   INTEGER NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
    progress    INTEGER NOT NULL DEFAULT 0,     -- 0..100 %
    completed   INTEGER NOT NULL DEFAULT 0,     -- 0/1
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, module_id)
  );

  -- Kann-Ziel: Benachrichtigungen
  CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,          -- 'message' | 'match' | 'comment' | 'system'
    title       TEXT NOT NULL,
    body        TEXT,
    link        TEXT,                   -- Frontend-Route
    read_at     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ===========================================================================
  -- Iteration 2: Programmlogik des BCP 2026 (Eberle et al., 2026a)
  -- Support Journey, EEM-Profil, Bedarfe, Supportplan, Matching Brief,
  -- moderiertes Matching, Vereinbarung, Re-Assessment, Communities of Practice.
  -- ===========================================================================

  -- Strukturiertes EEM-Profil (FA-14): vier Analysebereiche als JSON-Objekte,
  -- damit der Fragenkatalog ohne Schemaaenderung angepasst werden kann.
  CREATE TABLE IF NOT EXISTS eem_profiles (
    user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    case_type     TEXT CHECK (case_type IN ('venture_scaler','ecosystem_builder')),
    context       TEXT NOT NULL DEFAULT '{}',
    ecosystem     TEXT NOT NULL DEFAULT '{}',
    venture       TEXT NOT NULL DEFAULT '{}',
    entrepreneur  TEXT NOT NULL DEFAULT '{}',
    validated_at  TEXT,               -- gesetzt, wenn stars das Profil im Vertiefungsinterview validiert hat
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Unterstuetzungsfall entlang der Support Journey (FA-19).
  CREATE TABLE IF NOT EXISTS cases (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    eem_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coordinator_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    step            TEXT NOT NULL DEFAULT 'intake' CHECK (step IN
                      ('intake','assessment','prioritization','support_plan','matching',
                       'agreement','implementation','reassessment','closed')),
    intake_decision TEXT NOT NULL DEFAULT 'pending' CHECK (intake_decision IN ('pending','accepted','declined')),
    motivation      TEXT,             -- Anliegen bei der Aufnahme
    expectations    TEXT,             -- geklärte Erwartungen (Aufnahme-Output)
    plan_consent_at TEXT,             -- Zustimmung des EEM zum Supportplan
    cycle           INTEGER NOT NULL DEFAULT 1,
    closed_reason   TEXT CHECK (closed_reason IN ('goal_achieved','eem_request','no_further_need','declined')),
    closing_note    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Bedarfe in der Bedarfsformel des BCP (FA-15) inkl. Priorisierungskriterien
  -- (je 1 = tief, 2 = mittel, 3 = hoch).
  CREATE TABLE IF NOT EXISTS needs (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id           INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    goal              TEXT NOT NULL,  -- «Der EEM möchte [Ergebnis] erreichen.»
    bottleneck        TEXT,           -- «… erschwert durch [Engpass und Ursache].»
    support_needed    TEXT,           -- «… Unterstützung in Form von [Kompetenz/Erfahrung/Zugang].»
    success_criterion TEXT,           -- «Fortschritt zeigt sich an [Erfolgskriterium].»
    relevance         INTEGER CHECK (relevance BETWEEN 1 AND 3),
    urgency           INTEGER CHECK (urgency BETWEEN 1 AND 3),
    impact            INTEGER CHECK (impact BETWEEN 1 AND 3),
    stars_contribution INTEGER CHECK (stars_contribution BETWEEN 1 AND 3),
    feasibility       INTEGER CHECK (feasibility BETWEEN 1 AND 3),
    priority_rank     INTEGER CHECK (priority_rank BETWEEN 1 AND 3),
    status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','achieved','dropped')),
    cycle             INTEGER NOT NULL DEFAULT 1,
    created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Fachgebiete/Maerkte/Netzwerkzugaenge eines Bedarfs (Grundlage des Matchings).
  CREATE TABLE IF NOT EXISTS need_tags (
    need_id INTEGER NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (need_id, tag_id)
  );

  -- Supportplan (FA-18): Unterstuetzungsformate je Bedarf.
  CREATE TABLE IF NOT EXISTS plan_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    need_id    INTEGER NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
    format     TEXT NOT NULL CHECK (format IN
                 ('mentoring','skills','education','knowledge_sharing',
                  'introductions','partnerships','projects','stage')),
    note       TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- Matching Brief (FA-16), genau einer je Bedarf.
  CREATE TABLE IF NOT EXISTS matching_briefs (
    need_id        INTEGER PRIMARY KEY REFERENCES needs(id) ON DELETE CASCADE,
    main_role      TEXT NOT NULL CHECK (main_role IN ('lead_mentor','expert','connector')),
    experience     TEXT,              -- Branchen-, Fach- und Skalierungserfahrung
    context_ref    TEXT,              -- Region, Zielmarkt, EM-Erfahrung
    network_access TEXT,              -- benoetigter Zugang (Kunden, Partner, Investoren …)
    language       TEXT,              -- Sprachcode, z.B. 'en'
    duration       TEXT,              -- gewuenschte Begleitungsdauer
    working_mode   TEXT,              -- Arbeitsweise (online, vor Ort, Frequenz)
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Moderiertes Matching (FA-17/FA-22): stars schlaegt vor (Einladung),
  -- Unterstuetzer:in und EEM bestaetigen; erst dann gilt der Match.
  CREATE TABLE IF NOT EXISTS case_matches (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    need_id       INTEGER NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
    supporter_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role          TEXT NOT NULL CHECK (role IN ('lead_mentor','expert','connector')),
    score         REAL,
    status        TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','confirmed','declined')),
    supporter_ok  INTEGER NOT NULL DEFAULT 0,
    eem_ok        INTEGER NOT NULL DEFAULT 0,
    invited_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    confirmed_at  TEXT,
    UNIQUE (need_id, supporter_id)
  );

  -- Vereinbarung (Ziel, Rollen, naechste Schritte, Review-Termin) je Bedarf.
  CREATE TABLE IF NOT EXISTS agreements (
    need_id     INTEGER PRIMARY KEY REFERENCES needs(id) ON DELETE CASCADE,
    goal        TEXT NOT NULL,
    roles       TEXT,
    next_steps  TEXT,
    review_date TEXT NOT NULL,        -- YYYY-MM-DD
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Re-Assessment / Outcome-Erfassung (FA-21).
  CREATE TABLE IF NOT EXISTS reviews (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    need_id     INTEGER NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
    progress    TEXT NOT NULL CHECK (progress IN ('none','partial','achieved')),
    outcome     TEXT,                 -- beobachtetes Ergebnis (z.B. Partnerschaft vereinbart)
    next_step   TEXT NOT NULL CHECK (next_step IN ('continue','new_goal','rematch','close')),
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Verlauf eines Falls: dokumentierte Uebergaben und Fortschrittsnotizen.
  CREATE TABLE IF NOT EXISTS case_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id     INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type        TEXT NOT NULL,        -- 'step' | 'progress' | 'note' | 'match'
    step        TEXT,
    body        TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Communities of Practice (FA-20, DP10).
  CREATE TABLE IF NOT EXISTS communities (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    slug           TEXT NOT NULL UNIQUE,
    name_de        TEXT NOT NULL,
    name_en        TEXT NOT NULL,
    description_de TEXT,
    description_en TEXT,
    tag_id         INTEGER REFERENCES tags(id) ON DELETE SET NULL,  -- gemeinsame Domäne
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS community_members (
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','moderator')),
    joined_at    TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (community_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS community_posts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    author_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body         TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Terminierte Knowledge-Sharing-Formate (Peer Session, Roundtable, Masterclass).
  CREATE TABLE IF NOT EXISTS community_sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    host_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title        TEXT NOT NULL,
    description  TEXT,
    format       TEXT NOT NULL DEFAULT 'peer_session' CHECK (format IN ('peer_session','roundtable','masterclass','pitch_learn')),
    starts_at    TEXT NOT NULL,       -- 'YYYY-MM-DD HH:MM' (UTC)
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS session_attendees (
    session_id INTEGER NOT NULL REFERENCES community_sessions(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, user_id)
  );

  -- ===========================================================================
  -- Iteration 3: Feedback eines EEM aus dem stars-Netzwerk (Oktober 2026)
  -- Warm Introductions mit stars-Empfehlung, Pitch-&-Learn-Slots,
  -- Veranstaltungen/Foerderplaetze, Peer-Expert:innen, Feedback-Kanal.
  -- ===========================================================================

  -- Warm Introduction (FA-23): EEM fragt an, stars waehlt eine Person aus und
  -- buergt mit einer Empfehlungsnotiz (Vouching), die Person nimmt an/lehnt ab.
  CREATE TABLE IF NOT EXISTS intro_requests (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_profile  TEXT NOT NULL,      -- gesuchtes Profil, z.B. «Alumni in Stiftungen/CSR»
    purpose         TEXT NOT NULL,      -- Zweck der Vorstellung
    status          TEXT NOT NULL DEFAULT 'requested' CHECK (status IN
                      ('requested','proposed','accepted','declined','closed')),
    supporter_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    vouch_note      TEXT,               -- Empfehlung durch stars
    response_note   TEXT,               -- Rueckmeldung der angefragten Person / Begruendung
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS intro_request_tags (
    intro_id INTEGER NOT NULL REFERENCES intro_requests(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (intro_id, tag_id)
  );

  -- Antrag auf einen Session-Slot in einer Community (FA-24, Pitch & Learn).
  CREATE TABLE IF NOT EXISTS session_requests (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id   INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    requester_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    description    TEXT,
    audience       TEXT,              -- gewuenschtes Publikum
    preferred_date TEXT,              -- 'YYYY-MM-DD'
    status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
    session_id     INTEGER REFERENCES community_sessions(id) ON DELETE SET NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Veranstaltungen von stars (Symposien, Studienreisen) und Foerderplaetze (FA-26).
  CREATE TABLE IF NOT EXISTS events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    slug           TEXT NOT NULL UNIQUE,
    kind           TEXT NOT NULL CHECK (kind IN ('symposium','study_tour','online')),
    title_de       TEXT NOT NULL,
    title_en       TEXT NOT NULL,
    location       TEXT,
    starts_on      TEXT NOT NULL,     -- 'YYYY-MM-DD'
    ends_on        TEXT,
    description_de TEXT,
    description_en TEXT,
    url            TEXT
  );

  CREATE TABLE IF NOT EXISTS event_registrations (
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scholarship INTEGER NOT NULL DEFAULT 0,   -- Antrag auf Foerderplatz
    motivation  TEXT,
    status      TEXT NOT NULL DEFAULT 'interested' CHECK (status IN
                  ('interested','requested','granted','waitlist','declined')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (event_id, user_id)
  );

  -- Feedback an das Entwicklungsteam (FA-28): laufender Evaluationskanal.
  CREATE TABLE IF NOT EXISTS feedback (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    category    TEXT NOT NULL CHECK (category IN ('bug','idea','usability','praise','other')),
    area        TEXT,
    rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
    body        TEXT NOT NULL,
    page        TEXT,               -- Route, von der aus das Feedback kam
    status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','done')),
    response    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_intro_req       ON intro_requests(requester_id);
  CREATE INDEX IF NOT EXISTS idx_intro_supp      ON intro_requests(supporter_id);
  CREATE INDEX IF NOT EXISTS idx_feedback_user   ON feedback(user_id);

  CREATE INDEX IF NOT EXISTS idx_cases_eem       ON cases(eem_id);
  CREATE INDEX IF NOT EXISTS idx_needs_case      ON needs(case_id);
  CREATE INDEX IF NOT EXISTS idx_cmatch_need     ON case_matches(need_id);
  CREATE INDEX IF NOT EXISTS idx_cmatch_supp     ON case_matches(supporter_id);
  CREATE INDEX IF NOT EXISTS idx_events_case     ON case_events(case_id);
  CREATE INDEX IF NOT EXISTS idx_cposts_comm     ON community_posts(community_id);

  CREATE INDEX IF NOT EXISTS idx_threads_forum   ON threads(forum_id);
  CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments(thread_id);
  CREATE INDEX IF NOT EXISTS idx_messages_conv   ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_notif_user      ON notifications(user_id, read_at);
  CREATE INDEX IF NOT EXISTS idx_matches_question ON matches(question_id);
  `);

  // Migration bestehender Datenbanken (Iteration 1 -> 2): Unterstuetzer-Merkmale
  // fuer das rollendifferenzierte Matching (Rollen, Kapazitaet, Verfuegbarkeit).
  addColumnIfMissing('users', 'support_roles', 'TEXT');          // z.B. 'lead_mentor,expert,connector'
  addColumnIfMissing('users', 'capacity_hours', 'INTEGER');      // verfuegbare Stunden pro Monat
  addColumnIfMissing('users', 'available', 'INTEGER NOT NULL DEFAULT 1');

  // Migration Iteration 2 -> 3: Peer-Expert:innen (FA-27) und neues
  // Session-Format «Pitch & Learn» (FA-24).
  addColumnIfMissing('users', 'offers_peer_support', 'INTEGER NOT NULL DEFAULT 0');
  // Freigabe neuer Registrierungen durch stars (bestehende Konten bleiben aktiv).
  addColumnIfMissing('users', 'status', "TEXT NOT NULL DEFAULT 'active'");  // 'pending' | 'active' | 'rejected'
  addColumnIfMissing('users', 'signup_note', 'TEXT');                       // Bezug zu stars / Anliegen
  addColumnIfMissing('users', 'reviewed_at', 'TEXT');
  // Zusatzrecht: Lesezugriff auf das KPI-Dashboard ohne Admin-Rechte.
  addColumnIfMissing('users', 'can_view_analytics', 'INTEGER NOT NULL DEFAULT 0');
  extendSessionFormats();
  renameDemoPersona();
}

// Der Beispielfall der dritten Iteration hiess zunaechst «Sunita Rai» (fiktive
// Persona). Mit Einwilligung von Vedika Murarka wird er unter ihrem Namen
// gefuehrt; bestehende Datenbanken werden einmalig angepasst (idempotent).
function renameDemoPersona() {
  const old = db.prepare(`SELECT id FROM users WHERE email = 'sunita.rai@example.com'`).get();
  if (!old || db.prepare(`SELECT 1 FROM users WHERE email = 'vedika.murarka@example.com'`).get()) return;
  withTx(() => {
    db.prepare(
      `UPDATE users SET email = 'vedika.murarka@example.com', name = 'Vedika Murarka', avatar_seed = 'Vedika Murarka',
         headline = ?, bio = ? WHERE id = ?`
    ).run('Gründerin, Educase (EdTech-Hardware)', 'Educase hat ein patentiertes Lernprodukt in Nepal erprobt. Nächster Schritt: Operations in einem neuen Land (z. B. Indien, Kenia oder Bangladesch) aufbauen – über Institutionen, die Bildungsentwicklungsprojekte umsetzen. Teilt gerne eigene Gründungserfahrung.', old.id);
    const swap = (table, col) =>
      db.prepare(`UPDATE ${table} SET ${col} = REPLACE(REPLACE(${col}, 'Sunita Rai', 'Vedika Murarka'), 'Sunita', 'Vedika') WHERE ${col} LIKE '%Sunita%'`).run();
    swap('community_posts', 'body');
    swap('community_sessions', 'description');
    swap('notifications', 'title');
    swap('notifications', 'body');
    swap('intro_requests', 'vouch_note');
    swap('intro_requests', 'response_note');
    swap('messages', 'body');
    swap('feedback', 'body');
    db.prepare(`UPDATE community_posts SET body = REPLACE(body, 'Unser Lerngerät ist in Nepal', 'Unser Lernprodukt von Educase ist in Nepal') WHERE author_id = ?`).run(old.id);
    db.prepare(`UPDATE event_registrations SET motivation = ? WHERE user_id = ? AND motivation LIKE 'Ohne Firmensponsoring%'`).run('Als Entrepreneur aus einem Emerging Market ist der Zugang zu Symposien ohne Firmensponsoring schwierig. Ein subventionierter Platz würde mir die Teilnahme ermöglichen.', old.id);
  });
}

// SQLite kann CHECK-Constraints nicht per ALTER TABLE aendern. Bestehende
// Datenbanken erhalten das Format 'pitch_learn' daher ueber einen Neuaufbau der
// Tabelle (Daten bleiben erhalten).
function extendSessionFormats() {
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'community_sessions'`).get();
  if (!row || row.sql.includes('pitch_learn')) return;
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('PRAGMA legacy_alter_table = ON;');
  withTx(() => {
    db.exec(`ALTER TABLE community_sessions RENAME TO community_sessions_old;`);
    db.exec(row.sql.replace("'masterclass')", "'masterclass','pitch_learn')"));
    db.exec(`INSERT INTO community_sessions SELECT * FROM community_sessions_old;`);
    db.exec(`DROP TABLE community_sessions_old;`);
  });
  db.exec('PRAGMA legacy_alter_table = OFF;');
  db.exec('PRAGMA foreign_keys = ON;');
}

function addColumnIfMissing(table, column, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

// Kleiner Helfer: Konversations-IDs immer als (low, high) ordnen,
// damit pro Nutzerpaar hoechstens eine Konversation existiert.
export function orderPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

// node:sqlite besitzt (anders als better-sqlite3) keine .transaction()-Methode.
// Dieser Helfer kapselt BEGIN/COMMIT/ROLLBACK um eine Funktion.
export function withTx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
