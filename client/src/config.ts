// Laufzeit-Konfiguration fuer die Bereitstellung (Iteration 3).
// Werte koennen beim Build ueber Umgebungsvariablen (VITE_*) gesetzt werden.

// true in der Demo-Variante (Backend laeuft im Browser, Daten nur lokal).
// Als Funktion, weil main.demo.tsx das Flag erst nach dem Laden der Module setzt.
export const isDemo = () => typeof window !== 'undefined' && !!(window as any).__STARS_DEMO__;

// Kontaktadresse des Entwicklungsteams fuer Feedback aus der Demo-Variante.
export const FEEDBACK_EMAIL: string = import.meta.env.VITE_FEEDBACK_EMAIL || '';

// Issue-Tracker des Repositorys (Feedback mit GitHub-Konto).
export const ISSUES_URL: string =
  import.meta.env.VITE_ISSUES_URL || 'https://github.com/giorginiozoa-lgtm/stars-plattform/issues/new';
