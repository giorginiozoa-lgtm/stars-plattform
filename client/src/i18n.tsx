// Mehrsprachigkeit ohne externe Library.
// Quelltexte stehen im Code auf Deutsch und Englisch (tx(de, en), { de, en },
// Woerterbuch unten). Weitere Sprachen liegen als Uebersetzungskataloge in
// src/locales/<code>.json (Schluessel = englischer Quelltext) und werden erst
// bei Bedarf geladen. Fehlt eine Uebersetzung, erscheint der englische Text.
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type Locale = string;

// Verfuegbare Sprachen (Eigenbezeichnung). dir: Schreibrichtung.
export const LANGUAGES: { code: string; name: string; dir?: 'rtl' }[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'ne', name: 'नेपाली' },
  { code: 'ur', name: 'اردو', dir: 'rtl' },
  { code: 'sw', name: 'Kiswahili' },
  { code: 'am', name: 'አማርኛ' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'zh', name: '中文' },
  { code: 'tr', name: 'Türkçe' },
];
const SUPPORTED = new Set(LANGUAGES.map((l) => l.code));

// Kataloge werden lazy geladen (geringe Bandbreite: nur die gewaehlte Sprache).
const loaders = import.meta.glob<{ default: Record<string, string> }>(['./locales/*.json', '!./locales/_source.json']);
const catalogs: Record<string, Record<string, string>> = {};
async function loadCatalog(code: string) {
  if (code === 'de' || code === 'en' || catalogs[code]) return;
  const load = loaders[`./locales/${code}.json`];
  if (load) catalogs[code] = (await load()).default;
}

// Aktuelle Sprache auf Modulebene, damit auch Hilfsfunktionen ausserhalb von
// Komponenten (lx, trx) uebersetzen koennen; Komponenten rendern ueber den
// Context ohnehin neu, wenn die Sprache wechselt.
let current: Locale = 'en';

/** Uebersetzt einen englischen Quelltext in die aktuelle Sprache (ausser de/en). */
function fromEn(en: string): string {
  return catalogs[current]?.[en] ?? en;
}
/** Waehlt die passende Sprachvariante eines Quelltextpaars. */
export function trx(de: string, en: string): string {
  if (current === 'de') return de;
  if (current === 'en') return en;
  return fromEn(en);
}
/** Wie trx, fuer Objekte der Form { de, en }. */
export function lx(o: { de: string; en: string } | undefined | null): string {
  if (!o) return '';
  return trx(o.de, o.en);
}
/** Locale fuer Datums-/Zahlenformate (Intl). */
export function dateLocale(): string {
  return current === 'de' ? 'de-CH' : current === 'en' ? 'en-GB' : current;
}

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem('stars_locale');
    if (saved && SUPPORTED.has(saved)) return saved;
  } catch { /* ignore */ }
  for (const l of navigator.languages || [navigator.language]) {
    const code = (l || '').slice(0, 2).toLowerCase();
    if (SUPPORTED.has(code)) return code;
  }
  return 'en';
}


const dict: Record<string, { de: string; en: string }> = {
  'app.name': { de: 'stars', en: 'stars' },
  'app.tagline': { de: 'for Leaders of the Next Generation', en: 'for Leaders of the Next Generation' },
  'nav.dashboard': { de: 'Dashboard', en: 'Dashboard' },
  'nav.community': { de: 'Foren', en: 'Forums' },
  'nav.communities': { de: 'Communities', en: 'Communities' },
  'nav.journey': { de: 'Support Journey', en: 'Support Journey' },
  'nav.network': { de: 'Netzwerk & Intros', en: 'Network & intros' },
  'nav.events': { de: 'Veranstaltungen', en: 'Events' },
  'nav.feedback': { de: 'Feedback an Entwickler', en: 'Feedback to developers' },
  'nav.mentoring': { de: 'Expertenfragen', en: 'Expert questions' },
  'nav.mentors': { de: 'Expert:innen', en: 'Experts' },
  'nav.messages': { de: 'Nachrichten', en: 'Messages' },
  'nav.learning': { de: 'Microlearning', en: 'Microlearning' },
  'nav.profile': { de: 'Profil', en: 'Profile' },
  'nav.logout': { de: 'Abmelden', en: 'Log out' },
  'nav.notifications': { de: 'Benachrichtigungen', en: 'Notifications' },

  'auth.login': { de: 'Anmelden', en: 'Log in' },
  'auth.register': { de: 'Registrieren', en: 'Sign up' },
  'auth.email': { de: 'E-Mail', en: 'Email' },
  'auth.password': { de: 'Passwort', en: 'Password' },
  'auth.name': { de: 'Name', en: 'Name' },
  'auth.role': { de: 'Ich bin …', en: 'I am …' },
  'auth.role.entrepreneur': { de: 'Entrepreneur:in', en: 'Entrepreneur' },
  'auth.role.mentor': { de: 'Expert:in / Mentor:in', en: 'Expert / Mentor' },
  'auth.country': { de: 'Land', en: 'Country' },
  'auth.headline': { de: 'Kurzbeschreibung', en: 'Headline' },
  'auth.noAccount': { de: 'Noch kein Konto?', en: 'No account yet?' },
  'auth.hasAccount': { de: 'Bereits registriert?', en: 'Already registered?' },
  'auth.demoHint': { de: 'Demo-Login (Passwort: stars1234):', en: 'Demo login (password: stars1234):' },
  'auth.welcome': { de: 'Willkommen zurück', en: 'Welcome back' },
  'auth.createAccount': { de: 'Konto erstellen', en: 'Create account' },
  'auth.signupNote': { de: 'Dein Bezug zu stars', en: 'Your connection to stars' },
  'auth.signupNoteHint': { de: 'z. B. Fellow 2026, Alumni-Jahrgang, eingeladen von …', en: 'e.g. fellow 2026, alumni class, invited by …' },
  'auth.pendingInfo': { de: 'Danke für deine Registrierung! stars prüft dein Konto und gibt es frei. Danach kannst du dich hier anmelden.', en: 'Thanks for signing up! stars will review and approve your account. You can then log in here.' },
  'nav.registrations': { de: 'Registrierungen', en: 'Registrations' },

  'common.loading': { de: 'Lädt …', en: 'Loading …' },
  'common.save': { de: 'Speichern', en: 'Save' },
  'common.send': { de: 'Senden', en: 'Send' },
  'common.cancel': { de: 'Abbrechen', en: 'Cancel' },
  'common.back': { de: 'Zurück', en: 'Back' },
  'common.search': { de: 'Suchen', en: 'Search' },
  'common.all': { de: 'Alle', en: 'All' },
  'common.optional': { de: 'optional', en: 'optional' },
  'common.empty': { de: 'Noch nichts vorhanden.', en: 'Nothing here yet.' },
  'common.you': { de: 'Du', en: 'You' },

  'dash.title': { de: 'Übersicht', en: 'Overview' },
  'dash.welcome': { de: 'Willkommen', en: 'Welcome' },
  'dash.network': { de: 'Netzwerkentwicklung', en: 'Network growth' },
  'dash.newRegistrations': { de: 'Neuregistrierungen pro Monat', en: 'New sign-ups per month' },
  'dash.quicklinks': { de: 'Schnellzugriff', en: 'Quick links' },

  'community.title': { de: 'Community-Foren', en: 'Community forums' },
  'community.subtitle': { de: 'Themenbezogener Austausch zwischen Entrepreneurs und Expert:innen.', en: 'Topic-based exchange between entrepreneurs and experts.' },
  'community.threads': { de: 'Beiträge', en: 'Threads' },
  'community.newThread': { de: 'Neuer Beitrag', en: 'New thread' },
  'community.threadTitle': { de: 'Titel', en: 'Title' },
  'community.threadBody': { de: 'Dein Beitrag', en: 'Your post' },
  'community.comments': { de: 'Kommentare', en: 'Comments' },
  'community.addComment': { de: 'Antwort schreiben …', en: 'Write a reply …' },
  'community.post': { de: 'Veröffentlichen', en: 'Post' },

  'mentoring.title': { de: 'Expertenfragen', en: 'Expert questions' },
  'mentoring.subtitle': { de: 'Für eine klar umrissene fachliche Frage – wir schlagen passende Fachexpert:innen vor. Für längerfristige Begleitung: Support Journey.', en: 'For a clearly defined expert question – we suggest matching experts. For longer-term guidance: Support Journey.' },
  'mentoring.ask': { de: 'Frage stellen', en: 'Ask a question' },
  'mentoring.myQuestions': { de: 'Fragen', en: 'Questions' },
  'mentoring.qTitle': { de: 'Worum geht es?', en: 'What is it about?' },
  'mentoring.qBody': { de: 'Beschreibe deine Frage', en: 'Describe your question' },
  'mentoring.selectTags': { de: 'Fachgebiete & Markt wählen', en: 'Select domains & market' },
  'mentoring.matches': { de: 'Vorgeschlagene Expert:innen', en: 'Suggested experts' },
  'mentoring.matchScore': { de: 'Passung', en: 'Match' },
  'mentoring.why': { de: 'Weshalb dieser Vorschlag?', en: 'Why this suggestion?' },
  'mentoring.accept': { de: 'Annehmen & Kontakt aufnehmen', en: 'Accept & connect' },
  'mentoring.rematch': { de: 'Neu berechnen', en: 'Recompute' },
  'mentoring.status.open': { de: 'offen', en: 'open' },
  'mentoring.status.matched': { de: 'zugeordnet', en: 'matched' },
  'mentoring.status.resolved': { de: 'verbunden', en: 'connected' },
  'mentoring.coverage': { de: 'Abdeckung', en: 'Coverage' },
  'mentoring.expertise': { de: 'Expertise', en: 'Expertise' },
  'mentoring.market': { de: 'Markt', en: 'Market' },

  'mentors.title': { de: 'Expert:innen-Verzeichnis', en: 'Expert directory' },
  'mentors.subtitle': { de: 'Erfahrene Alumni aus dem stars-Netzwerk.', en: 'Experienced alumni from the stars network.' },
  'mentors.filter': { de: 'Nach Fachgebiet filtern', en: 'Filter by domain' },
  'mentors.message': { de: 'Nachricht senden', en: 'Send message' },
  'mentors.expertise': { de: 'Fachgebiete', en: 'Areas of expertise' },

  'messages.title': { de: 'Nachrichten', en: 'Messages' },
  'messages.empty': { de: 'Noch keine Konversationen.', en: 'No conversations yet.' },
  'messages.placeholder': { de: 'Nachricht schreiben …', en: 'Write a message …' },
  'messages.select': { de: 'Wähle links eine Konversation.', en: 'Select a conversation on the left.' },

  'learning.title': { de: 'Microlearning-Bibliothek', en: 'Microlearning library' },
  'learning.subtitle': { de: 'Kurze Lerneinheiten zu unternehmerischen Kernthemen.', en: 'Short learning units on core entrepreneurial topics.' },
  'learning.min': { de: 'Min.', en: 'min' },
  'learning.start': { de: 'Starten', en: 'Start' },
  'learning.continue': { de: 'Fortsetzen', en: 'Continue' },
  'learning.completed': { de: 'Abgeschlossen', en: 'Completed' },
  'learning.markComplete': { de: 'Als abgeschlossen markieren', en: 'Mark as completed' },
  'learning.level.beginner': { de: 'Einsteiger', en: 'Beginner' },
  'learning.level.intermediate': { de: 'Fortgeschritten', en: 'Intermediate' },
  'learning.level.advanced': { de: 'Experte', en: 'Advanced' },
  'learning.videoNote': { de: 'Videoinhalt (Platzhalter – Content-Produktion ist nicht Teil des MVP).', en: 'Video content (placeholder – content production is out of MVP scope).' },

  'profile.title': { de: 'Mein Profil', en: 'My profile' },
  'profile.expertise': { de: 'Meine Fachgebiete / Interessen', en: 'My domains / interests' },
  'profile.expertiseHint': { de: 'Gewichtung 1–5 bestimmt die Matching-Qualität.', en: 'Weighting 1–5 drives matching quality.' },
  'profile.bio': { de: 'Über mich', en: 'About me' },
  'profile.saved': { de: 'Gespeichert.', en: 'Saved.' },

  'notif.title': { de: 'Benachrichtigungen', en: 'Notifications' },
  'notif.markAll': { de: 'Alle als gelesen', en: 'Mark all read' },
  'notif.empty': { de: 'Keine Benachrichtigungen.', en: 'No notifications.' },

  'role.entrepreneur': { de: 'Entrepreneur:in', en: 'Entrepreneur' },
  'role.mentor': { de: 'Expert:in', en: 'Expert' },
  'role.admin': { de: 'Administration', en: 'Administration' },
};


interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  loc: <T extends Record<string, any>>(obj: T, field: string) => string;
  tx: (de: string, en: string) => string;
  lx: (o: { de: string; en: string } | undefined | null) => string;
}

const Ctx = createContext<I18nCtx>(null as any);

function applyDocument(l: Locale) {
  document.documentElement.lang = l;
  document.documentElement.dir = LANGUAGES.find((x) => x.code === l)?.dir || 'ltr';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const l = initialLocale();
    current = l;
    return l;
  });
  // Zaehler erzwingt ein Neurendern, sobald ein Katalog geladen ist.
  const [, setLoaded] = useState(0);

  useEffect(() => {
    applyDocument(locale);
    loadCatalog(locale).then(() => setLoaded((n) => n + 1));
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    try { localStorage.setItem('stars_locale', l); } catch { /* ignore */ }
    loadCatalog(l).then(() => {
      current = l;
      setLocaleState(l);
    });
  }, []);

  const t = useCallback((key: string) => (dict[key] ? lx(dict[key]) : key), [locale]);
  // Waehlt das lokalisierte Feld (z.B. loc(forum, 'title') -> title_de/title_en);
  // weitere Sprachen uebersetzen die englische Fassung ueber den Katalog.
  const loc = useCallback((obj: Record<string, any>, field: string) => {
    if (!obj) return '';
    const de = obj[`${field}_de`];
    const en = obj[`${field}_en`] ?? obj[field] ?? de ?? '';
    if (de === undefined) return current === 'de' || current === 'en' ? en : fromEn(en);
    return trx(de, en);
  }, [locale]);

  current = locale;
  return <Ctx.Provider value={{ locale, setLocale, t, loc, tx: trx, lx }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
