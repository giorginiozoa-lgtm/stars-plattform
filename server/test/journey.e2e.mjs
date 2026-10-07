// End-to-End-Test der Support Journey (Iteration 2) gegen eine laufende API.
// Voraussetzung: frisch befuellte Datenbank (npm run seed) und Server auf
// API_URL (Standard http://localhost:4000/api). Ausfuehren: node server/test/journey.e2e.mjs
const BASE = process.env.API_URL || 'http://localhost:4000/api';
let fails = 0;
async function call(token, method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}
function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label} ${cond ? '' : extra}`);
  if (!cond) fails++;
}
const login = async (email) => (await call(null, 'POST', '/auth/login', { email, password: 'stars1234' })).data.token;

const admin = await login('admin@the-stars.ch');
const omar = await login('omar.haddad@example.com');
const thomas = await login('thomas.mueller@example.com');
const amara = await login('amara.okafor@example.com');

let r = await call(admin, 'GET', '/journey/cases');
check('Admin sieht 6 Faelle', r.data.cases.length === 6);
const omarCase = r.data.cases.find((c) => c.step === 'intake');
const id = omarCase.id;

r = await call(amara, 'GET', `/journey/cases/${id}`);
check('Fremder EEM hat keinen Zugriff', r.status === 403);

r = await call(omar, 'POST', '/journey/cases', { motivation: 'x' });
check('Zweiter offener Fall wird abgelehnt', r.status === 409);

r = await call(admin, 'POST', `/journey/cases/${id}/advance`);
check('Advance ohne Aufnahmeentscheid blockiert', r.status === 409);

r = await call(admin, 'POST', `/journey/cases/${id}/intake`, { decision: 'accepted' });
check('Aufnahme ohne Erwartungen abgelehnt', r.status === 400);
r = await call(admin, 'POST', `/journey/cases/${id}/intake`, { decision: 'accepted', expectations: '3 Monate, monatlich' });
check('Aufnahme -> assessment', r.data.case?.step === 'assessment');

r = await call(admin, 'POST', `/journey/cases/${id}/advance`);
check('Advance ohne Profil blockiert', r.status === 409 && r.data.missing.length >= 4, JSON.stringify(r.data));

await call(omar, 'PUT', '/journey/profile', {
  case_type: 'venture_scaler',
  context: { target_markets: 'Jordanien, KSA' }, ecosystem: { access_quality: '2' },
  venture: { stage: 'early' }, entrepreneur: { languages: ['en'] },
});
r = await call(admin, 'POST', `/journey/cases/${id}/advance`);
check('Advance ohne Validierung blockiert', r.status === 409 && r.data.missing.some((m) => m.code === 'profile_validated'));
const omarId = (await call(omar, 'GET', '/auth/me')).data.user.id;
await call(admin, 'PUT', `/journey/profile/${omarId}`, { validated: true });
r = await call(admin, 'POST', `/journey/cases/${id}/advance`);
check('assessment -> prioritization', r.data.case?.step === 'prioritization');

const tags = (await call(null, 'GET', '/tags')).data.tags;
const T = (slug) => tags.find((t) => t.slug === slug).id;
r = await call(omar, 'POST', `/journey/cases/${id}/needs`, {
  goal: 'Rechtssichere Expansion nach Saudi-Arabien', bottleneck: 'Unklare Lizenzvorschriften',
  support_needed: 'Rechtsexpertise', tagIds: [T('legal'), T('market-mena'), T('net-government')],
});
const needId = r.data.needs[0].id;
r = await call(admin, 'POST', `/journey/cases/${id}/advance`);
check('Advance ohne priorisierten Bedarf blockiert', r.status === 409);
await call(omar, 'PATCH', `/journey/needs/${needId}`, { priority_rank: 1, relevance: 3, urgency: 3 });
r = await call(admin, 'POST', `/journey/cases/${id}/advance`);
check('Advance ohne Erfolgskriterium blockiert', r.status === 409 && r.data.missing.some((m) => m.code.endsWith('criterion')));
await call(omar, 'PATCH', `/journey/needs/${needId}`, { success_criterion: 'Lizenzantrag eingereicht' });
r = await call(admin, 'POST', `/journey/cases/${id}/advance`);
check('prioritization -> support_plan', r.data.case?.step === 'support_plan');

await call(admin, 'PUT', `/journey/needs/${needId}/plan`, { items: [{ format: 'projects', note: 'Rechtsgutachten' }] });
r = await call(admin, 'POST', `/journey/cases/${id}/advance`);
check('Advance ohne Brief/Consent blockiert', r.status === 409 && r.data.missing.length === 2, JSON.stringify(r.data.missing));
await call(admin, 'PUT', `/journey/needs/${needId}/brief`, { main_role: 'expert', experience: 'Handelsrecht', language: 'en' });
await call(omar, 'POST', `/journey/cases/${id}/plan-consent`);
r = await call(admin, 'POST', `/journey/cases/${id}/advance`);
check('support_plan -> matching', r.data.case?.step === 'matching');

r = await call(admin, 'GET', `/journey/needs/${needId}/candidates`);
check('Kandidatenliste vorhanden', r.data.candidates.length > 0);
const top = r.data.candidates[0];
check('Top-Kandidat ist Thomas Mueller (Recht)', top.supporter.name.startsWith('Thomas'), top.supporter.name);
check('Score-Komponenten vorhanden', typeof top.components.capacity === 'number');

r = await call(omar, 'GET', `/journey/needs/${needId}/candidates`);
check('EEM darf Kandidaten nicht abrufen (Human-in-the-Loop)', r.status === 403);

r = await call(admin, 'POST', `/journey/needs/${needId}/invite`, { supporterId: top.supporter.id, role: 'expert' });
const match = r.data.needs[0].matches[0];
r = await call(omar, 'POST', `/journey/matches/${match.id}/respond`, { accept: true });
check('EEM kann nicht vor Unterstuetzer:in bestaetigen', r.status === 409);
r = await call(thomas, 'GET', `/journey/cases/${id}`);
check('Eingeladene sieht Fall, aber kein Profil', r.status === 200 && r.data.profile === null && r.data.access === 'invited');
r = await call(thomas, 'POST', `/journey/matches/${match.id}/respond`, { accept: true });
r = await call(omar, 'POST', `/journey/matches/${match.id}/respond`, { accept: true });
check('Match bestaetigt + Konversation', r.data.status === 'confirmed' && r.data.conversationId);
r = await call(admin, 'POST', `/journey/cases/${id}/advance`);
check('matching -> agreement', r.data.case?.step === 'agreement');

r = await call(admin, 'POST', `/journey/cases/${id}/advance`);
check('Advance ohne Vereinbarung blockiert', r.status === 409);
await call(thomas, 'PUT', `/journey/needs/${needId}/agreement`, { goal: 'Lizenzantrag', review_date: '2026-11-30' });
r = await call(admin, 'POST', `/journey/cases/${id}/advance`);
check('agreement -> implementation', r.data.case?.step === 'implementation');
r = await call(admin, 'POST', `/journey/cases/${id}/advance`);
check('Advance ohne Fortschritt blockiert', r.status === 409);
await call(thomas, 'POST', `/journey/cases/${id}/events`, { type: 'progress', body: 'Gutachten erstellt' });
r = await call(admin, 'POST', `/journey/cases/${id}/advance`);
check('implementation -> reassessment', r.data.case?.step === 'reassessment');
await call(omar, 'POST', `/journey/needs/${needId}/reviews`, { progress: 'achieved', outcome: 'Lizenz beantragt', next_step: 'close' });
r = await call(admin, 'POST', `/journey/cases/${id}/close`, { reason: 'goal_achieved', note: 'Ziel erreicht' });
check('Abschluss', r.data.case?.step === 'closed' && r.data.needs[0].status === 'achieved');

r = await call(admin, 'GET', '/dashboard');
check('Admin-Dashboard mit Programm-KPIs', r.data.programme?.kpis?.needs_achieved >= 2, JSON.stringify(r.data.programme?.kpis));
r = await call(amara, 'GET', '/dashboard');
check('EEM-Dashboard mit Journey', r.data.journey?.step === 'implementation');

r = await call(amara, 'GET', '/communities');
check('Communities gelistet', r.data.communities.length === 6);
const eco = r.data.communities.find((c) => c.slug === 'ecosystem-builders');
r = await call(amara, 'POST', `/communities/${eco.id}/posts`, { body: 'hi' });
check('Nicht-Mitglied kann nicht posten', r.status === 403);
await call(amara, 'POST', `/communities/${eco.id}/join`);
r = await call(amara, 'POST', `/communities/${eco.id}/posts`, { body: 'Hallo zusammen' });
check('Mitglied kann posten', r.status === 201);
r = await call(amara, 'POST', `/communities/${eco.id}/sessions`, { title: 'x', starts_at: '2026-12-01T10:00' });
check('Mitglied kann keine Session ansetzen', r.status === 403);
r = await call(admin, 'POST', `/communities/${eco.id}/sessions`, { title: 'Kickoff', starts_at: '2026-12-01T10:00' });
check('Moderation setzt Session an', r.status === 201);
r = await call(amara, 'GET', `/communities/suggest?tagIds=${T('financing')}`);
check('Community-Vorschlag zu Tag', r.data.communities.some((c) => c.slug === 'access-to-finance'));

console.log(fails ? `\n${fails} Fehler` : '\nAlle Tests bestanden');
process.exit(fails ? 1 : 0);
