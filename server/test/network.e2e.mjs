// End-to-End-Test der Iteration 3 (Netzwerkzugang, Give-back, Feedback) gegen
// eine laufende API. Voraussetzung: frisch befuellte Datenbank (npm run seed)
// und Server auf API_URL (Standard http://localhost:4000/api).
// Ausfuehren: node server/test/network.e2e.mjs
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
const sunita = await login('sunita.rai@example.com');
const martina = await login('martina.brunner@example.com');
const amara = await login('amara.okafor@example.com');
const anna = await login('anna.keller@example.com');
const ravi = await login('ravi.patel@example.com');

// --- Warm Introductions (FA-23) ---------------------------------------------
let r = await call(sunita, 'GET', '/intros');
const intro = r.data.intros.find((i) => i.status === 'requested');
check('EEM sieht eigene offene Intro-Anfrage', !!intro);
r = await call(amara, 'GET', `/intros/${intro.id}`);
check('Fremde sehen die Anfrage nicht', r.status === 404);
r = await call(sunita, 'GET', `/intros/${intro.id}/suggestions`);
check('Vorschlaege nur fuer stars', r.status === 403);
r = await call(admin, 'GET', `/intros/${intro.id}/suggestions`);
const top = r.data.suggestions?.[0];
check('Vorschlaege enthalten Alumni mit Stiftungs-/NGO-Zugang',
  r.data.suggestions?.some((s) => ['Martina Brunner', 'Priya Nair'].includes(s.user.name)), JSON.stringify(top));
const martinaId = r.data.suggestions.find((s) => s.user.name === 'Martina Brunner')?.user.id;
r = await call(admin, 'POST', `/intros/${intro.id}/propose`, { supporter_id: martinaId });
check('Vorschlag ohne Empfehlungsnotiz abgelehnt', r.status === 400);
r = await call(admin, 'POST', `/intros/${intro.id}/propose`, { supporter_id: martinaId, vouch_note: 'stars kennt Sunita seit dem Symposium.' });
check('stars schlaegt Person mit Empfehlung vor', r.data.intro?.status === 'proposed');
r = await call(anna, 'POST', `/intros/${intro.id}/respond`, { accept: true });
check('Nur die vorgeschlagene Person kann antworten', r.status === 404);
r = await call(martina, 'POST', `/intros/${intro.id}/respond`, { accept: true, note: 'Gerne!' });
check('Annahme eroeffnet Konversation', r.data.intro?.status === 'accepted' && !!r.data.conversation_id);
r = await call(sunita, 'GET', '/messages');
check('Konversation ist fuer EEM sichtbar', r.status === 200 && JSON.stringify(r.data).includes('Martina'));
r = await call(admin, 'POST', `/intros/${intro.id}/propose`, { supporter_id: martinaId, vouch_note: 'x' });
check('Angenommene Anfrage kann nicht neu vergeben werden', r.status === 409);
r = await call(amara, 'POST', '/intros', { target_profile: 'Distributor in Ghana' });
check('Anfrage ohne Zweck abgelehnt', r.status === 400);

// --- Veranstaltungen und Foerderplaetze (FA-26) -----------------------------
r = await call(amara, 'GET', '/events');
check('Vier Veranstaltungen', r.data.events?.length === 4);
const bulgaria = r.data.events.find((e) => e.slug === 'bulgaria-2027');
r = await call(amara, 'POST', `/events/${bulgaria.id}/register`, { scholarship: true });
check('Foerderplatz ohne Begruendung abgelehnt', r.status === 400);
r = await call(amara, 'POST', `/events/${bulgaria.id}/register`, { scholarship: true, motivation: 'Kein Sponsoring' });
check('Foerderplatz beantragt', r.data.status === 'requested');
r = await call(amara, 'GET', '/events/registrations');
check('Antraege nur fuer stars einsehbar', r.status === 403);
r = await call(admin, 'POST', `/events/registrations/${bulgaria.id}/${(await call(amara, 'GET', '/auth/me')).data.user.id}/decide`, { status: 'granted' });
check('stars gewaehrt Foerderplatz', r.data.ok === true);
r = await call(amara, 'GET', '/events');
check('Status beim EEM sichtbar', r.data.events.find((e) => e.id === bulgaria.id).my_status === 'granted');

// --- Pitch-&-Learn-Slots (FA-24) -------------------------------------------
r = await call(admin, 'GET', '/communities');
const chapter = r.data.communities.find((c) => c.slug === 'online-alumni-chapter');
r = await call(amara, 'POST', `/communities/${chapter.id}/session-requests`, { title: 'Pitch' });
check('Nicht-Mitglied kann keinen Slot beantragen', r.status === 403);
r = await call(admin, 'GET', `/communities/${chapter.id}`);
const pending = r.data.sessionRequests.find((x) => x.status === 'pending');
check('Moderation sieht offenen Slot-Antrag', !!pending);
r = await call(ravi, 'POST', `/communities/session-requests/${pending.id}/decide`, { approve: true, starts_at: '2027-02-01T15:00' });
check('Antragsteller kann nicht selbst genehmigen', r.status === 403);
r = await call(admin, 'POST', `/communities/session-requests/${pending.id}/decide`, { approve: true, starts_at: '2027-02-01T15:00' });
check('Moderation genehmigt -> Session', !!r.data.session_id);
r = await call(ravi, 'GET', `/communities/${chapter.id}`);
check('Session im Format Pitch & Learn', r.data.sessions.some((s) => s.id === (r.data.sessionRequests[0]?.session_id) && s.format === 'pitch_learn'));

// --- Peer-Expert:innen (FA-27) ---------------------------------------------
r = await call(amara, 'GET', '/mentors');
check('Peer-Expertin im Verzeichnis', r.data.mentors.some((m) => m.name === 'Sunita Rai' && m.offers_peer_support));
check('Amara (ohne Opt-in) nicht im Verzeichnis', !r.data.mentors.some((m) => m.name === 'Amara Okafor'));
await call(amara, 'PATCH', '/auth/me', { offers_peer_support: true });
r = await call(amara, 'GET', '/mentors');
check('Opt-in nimmt Amara ins Verzeichnis auf', r.data.mentors.some((m) => m.name === 'Amara Okafor'));

// --- Feedback (FA-28) -------------------------------------------------------
r = await call(sunita, 'POST', '/feedback', { category: 'nonsense', body: 'x' });
check('Ungueltige Kategorie abgelehnt', r.status === 400);
r = await call(sunita, 'POST', '/feedback', { category: 'idea', area: 'Netzwerk', rating: 4, body: 'Filter nach Land waere hilfreich', page: '/network' });
check('Feedback gespeichert', r.status === 201);
const fbId = r.data.id;
r = await call(amara, 'GET', '/feedback');
check('Andere sehen fremdes Feedback nicht', !r.data.feedback.some((f) => f.id === fbId));
r = await call(sunita, 'PATCH', `/feedback/${fbId}`, { status: 'done' });
check('Nur stars triagiert', r.status === 403);
r = await call(admin, 'PATCH', `/feedback/${fbId}`, { status: 'in_progress', response: 'Danke, kommt in die nächste Iteration.' });
check('Admin antwortet', r.data.feedback?.status === 'in_progress');
r = await call(sunita, 'GET', '/feedback');
check('Antwort fuer Absenderin sichtbar', r.data.feedback.find((f) => f.id === fbId)?.response?.startsWith('Danke'));
r = await call(admin, 'GET', '/dashboard');
check('Dashboard zeigt Netzwerk-Kennzahlen', typeof r.data.network?.feedback_new === 'number');

// --- Freigabe neuer Registrierungen -----------------------------------------
const neu = { email: `neu${Date.now()}@test.ch`, password: 'geheim', name: 'Neu Test', role: 'entrepreneur', signup_note: 'Fellow 2026' };
r = await call(null, 'POST', '/auth/register', neu);
check('Registrierung wartet auf Freigabe', r.status === 202 && r.data.pending === true && !r.data.token);
r = await call(null, 'POST', '/auth/login', { email: neu.email, password: neu.password });
check('Login vor Freigabe gesperrt', r.status === 403 && r.data.code === 'pending');
r = await call(sunita, 'GET', '/users');
check('Nur stars sieht Registrierungen', r.status === 403);
r = await call(admin, 'GET', '/users');
const pendingUser = r.data.users?.find((u) => u.email === neu.email);
check('stars sieht offene Registrierung mit Notiz', pendingUser?.status === 'pending' && pendingUser.signup_note === 'Fellow 2026');
r = await call(admin, 'GET', '/dashboard');
check('Dashboard zaehlt offene Registrierungen', r.data.network?.registrations_pending >= 1);
r = await call(admin, 'POST', `/users/${pendingUser.id}/status`, { status: 'active' });
check('stars gibt frei', r.data.ok === true);
r = await call(null, 'POST', '/auth/login', { email: neu.email, password: neu.password });
const neuToken = r.data.token;
check('Login nach Freigabe', !!neuToken);
r = await call(neuToken, 'GET', '/forums');
check('Freigegebenes Konto sieht Foren', r.data.forums?.length === 5);
await call(admin, 'POST', `/users/${pendingUser.id}/status`, { status: 'rejected' });
r = await call(neuToken, 'GET', '/dashboard');
check('Sperre wirkt sofort auch auf bestehendes Token', r.status === 403);
r = await call(amara, 'GET', '/mentors');
check('Gesperrte Konten nicht im Verzeichnis', !r.data.mentors.some((m) => m.name === 'Neu Test'));

console.log(fails ? `\n${fails} Fehler` : '\nAlle Tests bestanden');
process.exit(fails ? 1 : 0);
