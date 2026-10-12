// Beispielfaelle aus dem EEM-Feedback vom 8. und 10. Oktober 2026:
// Nonzuzo Makanda (NFLA, Suedafrika) und Prasanna Karki (Nepal).
// Namensnennung mit Einwilligung beider Personen (12.10.2026). Die Inhalte
// geben nur wieder, was sie selbst geschrieben haben (Datenminimierung).
// Idempotent: Seed und bestehende Datenbanken (Testbetrieb) erhalten die
// Konten und Eintraege genau einmal.
import { db, withTx } from './db.js';
import { hashPassword } from './auth.js';

const CASES = [
  {
    email: 'nonzuzo.makanda@example.com', name: 'Nonzuzo Makanda', country: 'Südafrika', region: 'Sub-Saharan Africa',
    headline: 'CEO, National Financial Literacy Advocacy (NFLA)',
    bio: 'NFLA bereitet KMU auf Fremdfinanzierung vor und bietet Finanzierern eine Pipeline finanzierungsbereiter KMU. Ziel: das Funding-Readiness-Programm skalieren und einen Fonds aufbauen, der bedingt bewilligten KMU die nötigen Eigenmittel vorschiesst.',
    tags: [['financing', 5], ['sustainability', 4], ['scaling', 4], ['market-ssa', 5]],
    community: 'ecosystem-builders',
    post: 'Hallo zusammen! NFLA bereitet in Südafrika KMU auf Bankkredite vor. Viele erhalten eine bedingte Zusage, scheitern dann aber an den Eigenmitteln. Wer hat Erfahrung mit Fonds oder Programmen, die diese Lücke schliessen?',
    intro: {
      target: 'Fachperson für KMU-Finanzierung in Emerging Markets mit Erfahrung im Entwicklungs- und Impact-Sektor',
      purpose: 'Best Practices für die Skalierung des Funding-Readiness-Programms und den Aufbau eines Fonds für die Eigenmittel von KMU.',
      tags: ['financing', 'net-investors', 'net-ngo', 'market-ssa'],
    },
  },
  {
    email: 'prasanna.karki@example.com', name: 'Prasanna Karki', country: 'Nepal', region: 'South Asia',
    headline: 'Natürliche Wellness-Lebensmittel und Hautpflege, Nepal',
    bio: 'Stellt natürliche Wellness-Lebensmittel und Hautpflegeprodukte in Nepal her. Nächster Schritt: Exportmöglichkeiten finden und in internationale Märkte eintreten, besonders in Europa.',
    tags: [['intl-expansion', 5], ['sales', 4], ['operations', 3], ['market-sa', 5]],
    community: 'online-alumni-chapter',
    post: 'Hallo zusammen! Wir stellen in Nepal natürliche Wellness-Lebensmittel und Hautpflege her und möchten exportieren. Wer kennt Distributoren, Importeure oder strategische Partner in Europa für solche Produkte?',
    intro: {
      target: 'Distributoren, Importeure oder strategische Partner in Europa für natürliche Wellness-Lebensmittel und Hautpflege',
      purpose: 'Exportmöglichkeiten identifizieren und in neue internationale Märkte eintreten.',
      tags: ['net-distribution', 'net-corporates', 'intl-expansion'],
    },
  },
];

export function ensureEemCases2026() {
  const admins = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all();
  if (admins.length === 0) return; // leere Datenbank: der Seed legt alles an
  const tagId = (slug) => db.prepare('SELECT id FROM tags WHERE slug = ?').get(slug)?.id;
  const pw = hashPassword('stars1234');
  for (const c of CASES) {
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(c.email)) continue;
    withTx(() => {
      const uid = Number(db.prepare(
        `INSERT INTO users (email, password_hash, name, role, country, region, headline, bio, languages, avatar_seed, created_at)
         VALUES (?, ?, ?, 'entrepreneur', ?, ?, ?, ?, 'en', ?, datetime('now', '-4 days'))`
      ).run(c.email, pw, c.name, c.country, c.region, c.headline, c.bio, c.name).lastInsertRowid);
      for (const [slug, w] of c.tags) {
        const t = tagId(slug);
        if (t) db.prepare('INSERT INTO user_tags (user_id, tag_id, weight) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(uid, t, w);
      }
      const community = db.prepare('SELECT id FROM communities WHERE slug = ?').get(c.community);
      if (community) {
        db.prepare(`INSERT INTO community_members (community_id, user_id, role) VALUES (?, ?, 'member') ON CONFLICT DO NOTHING`).run(community.id, uid);
        db.prepare(`INSERT INTO community_posts (community_id, author_id, body, created_at) VALUES (?, ?, ?, datetime('now', '-2 days'))`).run(community.id, uid, c.post);
      }
      const introId = Number(db.prepare(
        `INSERT INTO intro_requests (requester_id, target_profile, purpose, status, created_at, updated_at)
         VALUES (?, ?, ?, 'requested', datetime('now', '-2 days'), datetime('now', '-2 days'))`
      ).run(uid, c.intro.target, c.intro.purpose).lastInsertRowid);
      for (const slug of c.intro.tags) {
        const t = tagId(slug);
        if (t) db.prepare('INSERT INTO intro_request_tags (intro_id, tag_id) VALUES (?, ?)').run(introId, t);
      }
      for (const a of admins) {
        db.prepare(
          `INSERT INTO notifications (user_id, type, title, body, link, created_at) VALUES (?, 'system', 'Neue Intro-Anfrage', ?, ?, datetime('now', '-2 days'))`
        ).run(a.id, `${c.name}: ${c.intro.target}`, `/network?focus=${introId}`);
      }
    });
  }
}
