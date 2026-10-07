// Einstiegspunkt der verschickbaren Einzeldatei-Demo (stars-Prototyp-Demo.html).
// Unterschiede zu main.tsx (Prototyp):
//   1. Das Demo-Backend (mockApi) wird VOR dem Rendern installiert.
//   2. HashRouter statt BrowserRouter – noetig, damit die Navigation auch beim
//      Oeffnen per Doppelklick (file://) funktioniert.
//   3. Kein Service Worker (unter file:// nicht registrierbar).
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { I18nProvider } from './i18n';
import { AuthProvider } from './auth';
import { installMockApi } from './demo/mockApi';
import './index.css';
import './demo/demo.css';

// Manche Browser blockieren localStorage beim Oeffnen per file:// oder im
// privaten Modus. Damit die Demo trotzdem laeuft, wird in diesem Fall ein
// Ersatz im Arbeitsspeicher bereitgestellt (Aenderungen sind dann fluechtig).
try {
  localStorage.setItem('__stars_probe', '1');
  localStorage.removeItem('__stars_probe');
} catch {
  const mem = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => { mem.set(k, String(v)); },
      removeItem: (k: string) => { mem.delete(k); },
      clear: () => mem.clear(),
      key: (i: number) => [...mem.keys()][i] ?? null,
      get length() { return mem.size; },
    },
  });
}

(window as any).__STARS_DEMO__ = true;
installMockApi();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <AuthProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </AuthProvider>
    </I18nProvider>
  </React.StrictMode>
);

// Kleiner Hinweis-Chip: kennzeichnet die Demo und erlaubt das Zuruecksetzen der
// lokal gespeicherten Demo-Daten.
const chip = document.createElement('div');
chip.className = 'demo-chip';
chip.innerHTML = '<span>Demo – lokale Daten</span><button type="button">Zurücksetzen</button>';
chip.querySelector('button')!.addEventListener('click', () => {
  if (confirm('Alle in dieser Demo vorgenommenen Änderungen verwerfen und die Ausgangsdaten wiederherstellen?')) {
    (window as any).starsDemoReset();
  }
});
document.body.appendChild(chip);
