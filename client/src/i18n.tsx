// Leichtes eigenes i18n (Kann-Ziel Mehrsprachigkeit DE/EN) ohne externe Library.
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Locale = 'de' | 'en';

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
}

const Ctx = createContext<I18nCtx>(null as any);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(
    (localStorage.getItem('stars_locale') as Locale) || 'de'
  );
  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem('stars_locale', l);
    document.documentElement.lang = l;
    setLocaleState(l);
  }, []);
  const t = useCallback((key: string) => dict[key]?.[locale] ?? key, [locale]);
  // Waehlt das lokalisierte Feld (z.B. loc(forum, 'title') -> title_de/title_en).
  const loc = useCallback(
    (obj: Record<string, any>, field: string) => obj?.[`${field}_${locale}`] ?? obj?.[field] ?? '',
    [locale]
  );
  return <Ctx.Provider value={{ locale, setLocale, t, loc }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
