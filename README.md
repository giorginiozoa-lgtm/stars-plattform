# stars Community-Plattform – MVP-Prototyp

Prototypische Implementierung einer community-orientierten digitalen Plattform zur
Förderung von Unternehmertum in Emerging Markets, entwickelt im Rahmen der
Bachelorarbeit *„Konzeption und Umsetzung einer community-orientierten digitalen
Plattform …"* (Kalaidos Fachhochschule, Wirtschaftsingenieurwesen).

Der Prototyp realisiert die drei in der Disposition definierten Säulen:

1. **Community** – themenbezogene Foren mit Beiträgen und Kommentaren
2. **Mentoring & Matching** – regelbasierte Zuordnung von Fragen zu Expert:innen +
   1:1-Direktnachrichten
3. **Microlearning** – Bibliothek kurzer Lernmodule mit Fortschritts-Tracking

Zusätzlich umgesetzte Kann-Ziele: Benachrichtigungen, rollenbasierte Dashboards
(Admin/Mentor:in/Entrepreneur:in), Mehrsprachigkeit (DE/EN) sowie eine
Offline-/ressourcenschonende PWA-Fähigkeit (Service Worker).

### Iteration 2 – Programmlogik des BCP 2026

Nach Vorliegen des Schlussberichts des Business Consulting Projects 2026
(Eberle et al., 2026a) wurde der Prototyp um dessen Programmlogik erweitert:

4. **Support Journey** – begleiteter Unterstützungsfall in acht Schritten
   (Aufnahme → Assessment → Priorisierung → Supportplan → Matching → Vereinbarung →
   Umsetzung → Re-Assessment → neuer Zyklus oder Abschluss). Jeder Schritt endet mit
   einem verbindlichen Output; der nächste Schritt wird serverseitig erst freigegeben,
   wenn dieser vorliegt (`server/src/journey.js`, `handoverCheck`).
   - **EEM-Profil** aus vier kurzen Fragebögen (Context, Ecosystem, Venture,
     Entrepreneur), Validierung durch stars
   - **Bedarfe** in der Bedarfsformel, gemeinsame Priorisierung von 1–3 Bedarfen
   - **Supportplan** aus acht Unterstützungsformaten und **Matching Brief**
   - **Moderiertes, rollendifferenziertes Matching** (Lead Mentor:in, Fachexpert:in,
     Connector): das System schlägt vor, stars lädt ein, Unterstützer:in und EEM
     bestätigen (Human-in-the-Loop)
   - **Vereinbarung** mit Review-Termin, **Re-Assessment** mit Outcome-Erfassung
5. **Communities of Practice** – moderierte Gruppen mit Peer-Austausch und
   terminierten Sessions (Peer Session, Roundtable, Masterclass); Normalfall der
   Unterstützung, das 1:1-Matching ist die gezielte Ergänzung.
6. **Outcome-Dashboard** für stars: Fälle je Schritt, erreichte Ziele, Zeit bis zum
   Match, fällige Reviews, dokumentierte Outcomes.

Ein End-to-End-Test spielt einen vollständigen Fall durch und prüft alle
Übergaberegeln und Berechtigungen (35 Prüfungen):

```bash
npm run seed && npm start          # in einem Terminal
node server/test/journey.e2e.mjs   # in einem zweiten Terminal
```

Die bisherige Frage-Experten-Funktion bleibt als «Expertenfragen» für punktuelle,
klar umrissene Fachfragen bestehen.

### Iteration 3 – Netzwerkzugang, Give-back und Feedback-Kanal

Abgeleitet aus dem Feedback einer stars-Fellow (Oktober 2026):

7. **Netzwerk & Intros** (`/network`) – Warm Introductions mit stars-Empfehlung:
   Entrepreneur:in beschreibt das gesuchte Profil und den Zweck; stars erhält
   Vorschläge aus dem Netzwerk, wählt eine Person und ergänzt eine
   Empfehlungsnotiz (Vouching); bei Annahme öffnet das System eine Konversation.
8. **Pitch-&-Learn-Slots** – Mitglieder einer Community beantragen einen Slot,
   die Moderation terminiert ihn; Beispiel-Community «Online Alumni Chapter».
9. **Veranstaltungen & Förderplätze** (`/events`) – stars-Symposien und
   Studienreisen 2027, Interesse bekunden, Förderplatz beantragen; stars entscheidet.
10. **Peer-Expert:innen** – Entrepreneurs können im Profil angeben, dass sie ihre
    Erfahrung teilen, und erscheinen dann im Verzeichnis.
11. **Feedback an die Entwickler** (`/feedback`, Button oben rechts auf jeder
    Seite) – Kategorie, Bereich, Bewertung, Freitext, Seite; Admin triagiert,
    antwortet und exportiert als CSV.

Neue Schlagwörter für das Matching: institutioneller Vertrieb (B2G/B2B),
internationale Expansion physischer Produkte, IP & Fertigungsskalierung,
Zugang zu Stiftungen & CSR. Die Persona «Sunita Rai» ist fiktiv.

```bash
npm run seed && npm start          # in einem Terminal
node server/test/network.e2e.mjs   # 32 Prüfungen der Iteration 3
```

---

## Online-Betrieb für Testprojekte (kostenlos)

| Variante | Wofür | Daten |
|----------|-------|-------|
| **GitHub Pages** – https://giorginiozoa-lgtm.github.io/stars-plattform/ | Klick-Tests, Usability-Tests mit Einzelpersonen | nur im Browser der Testperson |
| **Render (Free)** – https://stars-plattform.onrender.com (`render.yaml`) | gemeinsame Testprojekte: EEM, Alumni und stars auf denselben Daten | SQLite, gesichert in privates GitHub-Repo |

**GitHub Pages** wird bei jedem Push auf `main` automatisch gebaut
(`.github/workflows/pages.yml`). Feedback aus der Pages-Version geht per
vorausgefüllter E-Mail (Repository-Variable `FEEDBACK_EMAIL`) oder als GitHub-Issue
an das Team, weil dort kein gemeinsamer Server existiert.

**Render einrichten (einmalig, ca. 10 Minuten):**

1. Fine-grained Token erstellen: GitHub → Settings → Developer settings →
   Fine-grained tokens → *Only select repositories*: `stars-plattform-data`,
   Permission *Contents: Read and write*.
2. https://dashboard.render.com mit GitHub anmelden → **New → Blueprint** →
   Repository `stars-plattform` wählen.
3. Werte eintragen: `ADMIN_PASSWORD` (eigenes, starkes Passwort),
   `BACKUP_REPO` = `giorginiozoa-lgtm/stars-plattform-data`, `BACKUP_TOKEN` = Token aus 1.
4. Deploy. Beim ersten Start werden die Demo-Daten angelegt und gesichert.

Hinweise: Der Gratis-Dienst schläft nach 15 Minuten Inaktivität ein; der erste
Aufruf dauert dann ca. 1 Minute. Für Testbetrieb gedacht, nicht für
Produktivbetrieb. Vor Tests mit realen Personendaten Einwilligung einholen;
Admin-Konten entstehen nie per Selbstregistrierung.

---

## Technologie-Stack

| Schicht      | Technologie                                             |
|--------------|---------------------------------------------------------|
| Frontend     | React 18, Vite, TypeScript, React Router, eigenes i18n  |
| Backend      | Node.js, Express, JSON Web Tokens                       |
| Datenbank    | SQLite über das integrierte Modul `node:sqlite`         |
| Passwörter   | scrypt (`node:crypto`)                                  |

Bewusst ohne native Build-Abhängigkeiten und ohne schwere UI-Bibliotheken – das
hält die Installation robust und das Frontend-Bundle klein (~84 kB gzip inkl. Iteration 2), passend
zum Ziel geringer Bandbreite in Emerging Markets.

---

## Voraussetzungen

- **Node.js ≥ 20** (getestet mit v24). Prüfen: `node --version`

## Installation & Start

```bash
# 1) Abhängigkeiten installieren (Root, Server, Client)
npm run install:all

# 2) Datenbank mit Demo-Daten befüllen
npm run seed

# 3) Entwicklungsmodus starten (API + Frontend parallel)
npm run dev
```

Anschließend im Browser öffnen: **http://localhost:5173**
(Die API läuft auf http://localhost:4000, der Vite-Dev-Server leitet `/api` dorthin weiter.)

### Produktionsartefakt

```bash
npm run build     # baut das Frontend nach client/dist
npm start         # Express liefert API + gebautes Frontend auf Port 4000
```

### Eigenständige Demo-Datei (zum Weitergeben)

```bash
npm run build:demo
```

Erzeugt `Plattform/stars-Prototyp-Demo.html` – eine **einzelne HTML-Datei**
(~370 kB), die das komplette Frontend inkl. Iteration 2 sowie ein im Browser laufendes
Demo-Backend enthält. Sie lässt sich per E-Mail versenden und durch Doppelklick
öffnen; weder Node.js noch eine Internetverbindung sind erforderlich.

| Aspekt          | Prototyp (`npm run dev`)      | Demo-Datei                          |
|-----------------|-------------------------------|-------------------------------------|
| Backend         | Express auf Port 4000         | `client/src/demo/mockApi.ts` im Browser |
| Datenhaltung    | SQLite (`server/data.sqlite`) | localStorage des Browsers           |
| Passwörter      | scrypt-Hash                   | Klartext (nur Demo-Konten)          |
| Session         | signiertes JWT                | Base64-Token                        |
| Routing         | BrowserRouter                 | HashRouter (nötig für `file://`)    |
| Matching-Logik  | `server/src/matching.js`      | identische Portierung, gleiche Scores |

Endpunkte, Datenmodell und Seed-Daten sind in beiden Varianten identisch; die
Demo dient ausschliesslich der Vorführung ohne Serverinstallation. Änderungen in
der Demo bleiben lokal im Browser und lassen sich über den Chip unten rechts
zurücksetzen.

---

## Demo-Zugänge

Passwort für **alle** Konten: `stars1234`

| Rolle           | E-Mail                        |
|-----------------|-------------------------------|
| Administration  | `admin@the-stars.ch`          |
| Expert:in/Mentor| `anna.keller@example.com`     |
| Entrepreneur:in | `amara.okafor@example.com`    |
| Entrepreneur:in (Fall im Matching) | `kwame.mensah@example.com` |
| Entrepreneur:in (Priorisierung)    | `linh.tran@example.com`    |
| Expert:in mit offener Anfrage      | `fatima.zahra@example.com` |
| Entrepreneur:in (Intro, Pitch & Learn, Förderplatz) | `sunita.rai@example.com` |

Im Online-Betrieb (Render) gilt für `admin@the-stars.ch` das Passwort aus `ADMIN_PASSWORD`.

Die Demo-Daten enthalten fünf Fälle in unterschiedlichen Journey-Schritten
(Aufnahme offen, Priorisierung, Matching, Umsetzung, abgeschlossen) sowie fünf
Communities mit Beiträgen und Sessions.

Auf dem Login-Bildschirm füllen Buttons die Demo-Zugänge automatisch aus.

---

## Projektstruktur

```
Plattform/
├── package.json            # Root-Skripte (install:all, seed, dev, build, start)
├── server/                 # Backend (Express + node:sqlite)
│   └── src/
│       ├── index.js        # Einstiegspunkt / Routen-Verdrahtung
│       ├── db.js           # DB-Verbindung, Schema (DDL), Transaktions-Helfer
│       ├── auth.js         # Passwort-Hashing, JWT, Middleware
│       ├── matching.js     # Regelbasierte Matching-Logik (Fragen + Matching Brief)
│       ├── journey.js      # Support Journey: Schritte, Übergaberegeln
│       ├── helpers.js      # publicUser, notify, userTags
│       ├── seed.js         # Demo-Daten
│       └── routes/         # auth, tags, forums, questions, mentors,
│                           #   messages, learning, dashboard, notifications,
│                           #   journey, communities
└── client/                 # Frontend (React + Vite)
    ├── public/             # PWA-Manifest, Service Worker
    └── src/
        ├── App.tsx         # Layout, Routing, Sidebar, Notifications
        ├── api.ts          # fetch-Wrapper + JWT
        ├── auth.tsx        # Auth-Context
        ├── i18n.tsx        # DE/EN-Übersetzungen
        ├── components.tsx  # Avatar, TagPill, RoleBadge, timeAgo …
        ├── journey.ts      # Schritte, Formate, Rollen, Fragebögen (Iteration 2)
        └── pages/          # AuthScreen, Dashboard, Community, Thread,
                            #   Mentoring, QuestionDetail, Mentors, Messages,
                            #   Learning, Profile, Journey, CaseDetail,
                            #   EemProfile, Communities
```

---

## Die Matching-Logik (Kern des Prototyps)

Die Zuordnung einer Frage zu Expert:innen (`server/src/matching.js`) ist bewusst
**regelbasiert und transparent** gestaltet. Der Score (0–100) setzt sich aus drei
nachvollziehbaren, gewichteten Komponenten zusammen:

| Komponente   | Gewicht | Bedeutung                                                        |
|--------------|:-------:|------------------------------------------------------------------|
| Coverage     | 0.55    | Anteil der gefragten Fachgebiete, den die Person abdeckt         |
| Expertise    | 0.30    | Durchschnittliche Selbsteinschätzung (1–5) auf den Treffern      |
| Market       | 0.15    | Übereinstimmung des geografischen Marktes / der Region           |

Die Detailansicht einer Frage zeigt diese Zerlegung sowie die konkreten
übereinstimmenden Schlagwörter an, damit Nutzer:innen verstehen, *warum* eine
Person vorgeschlagen wird (Vertrauen/Akzeptanz, vgl. TAM).

### Rollendifferenziertes Matching (Iteration 2)

Für die Support Journey bewertet `scoreSupporter` mögliche Unterstützer:innen
anhand des Matching Briefs. Abgebildet werden die berechenbaren Auswahlkriterien
des BCP 2026; persönliche Passung entsteht erst im Kennenlernen und wird nicht
berechnet.

| Komponente | Gewicht | Bedeutung |
|------------|:-------:|-----------|
| Fachlich   | 0.45 | Abdeckung der Fachgebiete (60 %) und Kompetenzgrad (40 %) |
| Kontext    | 0.15 | Markt-/Regionskenntnis |
| Netzwerk   | 0.15 | geforderte Netzwerkzugänge (Investoren, Corporates, …) |
| Sprache    | 0.10 | gewünschte Arbeitssprache |
| Kapazität  | 0.15 | Stunden pro Monat im Verhältnis zur Rolle (Lead 4 h, Expert:in 2 h, Connector 1 h) |

Nur Personen, die die gesuchte Rolle übernehmen und verfügbar sind, werden
vorgeschlagen. Fehlt der Bezug zu einem Merkmal im Brief, zählt die Komponente
neutral (0.5).

> **Hinweis:** Die per Seed erzeugten Inhalte sind fiktive Demonstrationsdaten des
> Prototyps und stellen **keine** empirischen Erhebungsdaten dar.
