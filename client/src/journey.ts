// Fachliche Konstanten der Support Journey (Iteration 2) – Bezeichnungen,
// Unterstuetzungsformate, Rollen und der Fragenkatalog der vier Online-
// Frageboegen. Inhaltlich nach Eberle et al. (2026a), Kap. 5.1–5.3.
import type { Step, Format, SupportRole, CaseType } from './types';
import { lx } from './i18n';

export type L = { de: string; en: string };

export const STEP_ORDER: Step[] = [
  'intake', 'assessment', 'prioritization', 'support_plan', 'matching', 'agreement', 'implementation', 'reassessment',
];

export const STEP_LABEL: Record<Step, L> = {
  intake: { de: 'Aufnahme', en: 'Intake' },
  assessment: { de: 'Assessment', en: 'Assessment' },
  prioritization: { de: 'Priorisierung', en: 'Prioritisation' },
  support_plan: { de: 'Supportplan', en: 'Support plan' },
  matching: { de: 'Matching', en: 'Matching' },
  agreement: { de: 'Vereinbarung', en: 'Agreement' },
  implementation: { de: 'Umsetzung', en: 'Implementation' },
  reassessment: { de: 'Re-Assessment', en: 'Re-assessment' },
  closed: { de: 'Abgeschlossen', en: 'Closed' },
};

// Was in diesem Schritt entsteht (verbindlicher Output nach BCP, Tabelle 8).
export const STEP_OUTPUT: Record<Step, L> = {
  intake: { de: 'Aufnahmeentscheid und geklärte Erwartungen', en: 'Intake decision and clarified expectations' },
  assessment: { de: 'Validiertes EEM-Profil (vier Bereiche)', en: 'Validated EEM profile (four areas)' },
  prioritization: { de: 'Ein bis drei priorisierte Bedarfe mit Erfolgskriterium', en: 'One to three prioritised needs with success criterion' },
  support_plan: { de: 'Supportplan und Matching Brief, vom EEM bestätigt', en: 'Support plan and matching brief, confirmed by the EEM' },
  matching: { de: 'Beidseitig bestätigter Match oder alternative Lösung', en: 'Match confirmed by both sides or alternative solution' },
  agreement: { de: 'Ziel, Rollen, nächste Schritte, Review-Termin', en: 'Goal, roles, next steps, review date' },
  implementation: { de: 'Dokumentierte Fortschritte und offene Punkte', en: 'Documented progress and open issues' },
  reassessment: { de: 'Entscheid: neuer Zyklus oder Abschluss', en: 'Decision: new cycle or closure' },
  closed: { de: 'Abschlussdokumentation', en: 'Closing documentation' },
};

export const FORMATS: { key: Format; label: L; mechanism: 'guidance' | 'skills' | 'access'; hint: L; needsPerson: boolean }[] = [
  { key: 'mentoring', mechanism: 'guidance', needsPerson: true, label: { de: 'Mentoring & Coaching', en: 'Mentoring & Coaching' }, hint: { de: 'Kontinuierliche Begleitung, Reflexion', en: 'Continuous guidance, reflection' } },
  { key: 'skills', mechanism: 'skills', needsPerson: true, label: { de: 'Skills Development', en: 'Skills Development' }, hint: { de: 'Konkrete Kompetenzlücke schliessen', en: 'Close a specific skills gap' } },
  { key: 'education', mechanism: 'skills', needsPerson: false, label: { de: 'Entrepreneurship Education', en: 'Entrepreneurship Education' }, hint: { de: 'Skalierbare Grundlagen (Microlearning)', en: 'Scalable basics (microlearning)' } },
  { key: 'knowledge_sharing', mechanism: 'guidance', needsPerson: false, label: { de: 'Knowledge Sharing', en: 'Knowledge Sharing' }, hint: { de: 'Peer Learning in einer Community', en: 'Peer learning in a community' } },
  { key: 'introductions', mechanism: 'access', needsPerson: true, label: { de: 'Netzwerkzugang / Introductions', en: 'Network access / Introductions' }, hint: { de: 'Gezielter Kontakt, Warm Intro', en: 'Targeted contact, warm intro' } },
  { key: 'partnerships', mechanism: 'access', needsPerson: true, label: { de: 'Partnerships', en: 'Partnerships' }, hint: { de: 'Zugang zu Märkten und Ressourcen', en: 'Access to markets and resources' } },
  { key: 'projects', mechanism: 'skills', needsPerson: true, label: { de: 'Projects', en: 'Projects' }, hint: { de: 'Problemlösung mit klarem Output', en: 'Problem solving with clear output' } },
  { key: 'stage', mechanism: 'access', needsPerson: true, label: { de: 'Stage / Sichtbarkeit', en: 'Stage / Visibility' }, hint: { de: 'Auftritt vor Zielgruppe', en: 'Appearance before target group' } },
];
export const formatLabel = (f: Format) => FORMATS.find((x) => x.key === f)!.label;

export const ROLE_LABEL: Record<SupportRole, L> = {
  lead_mentor: { de: 'Lead Mentor:in', en: 'Lead mentor' },
  expert: { de: 'Fachexpert:in', en: 'Subject expert' },
  connector: { de: 'Connector', en: 'Connector' },
};
export const ROLE_HINT: Record<SupportRole, L> = {
  lead_mentor: { de: 'Begleitet ein Ziel längerfristig, gibt Orientierung', en: 'Guides one goal over time, provides orientation' },
  expert: { de: 'Beantwortet eine klar umrissene fachliche Frage', en: 'Answers a clearly defined expert question' },
  connector: { de: 'Öffnet Zugänge zu Kunden, Partnern, Investoren', en: 'Opens access to customers, partners, investors' },
};

export const CASE_TYPE_LABEL: Record<CaseType, L> = {
  venture_scaler: { de: 'Venture Scaler', en: 'Venture Scaler' },
  ecosystem_builder: { de: 'Ecosystem Builder', en: 'Ecosystem Builder' },
};

export const RATING_LABEL: Record<number, L> = {
  1: { de: 'tief', en: 'low' },
  2: { de: 'mittel', en: 'medium' },
  3: { de: 'hoch', en: 'high' },
};
export const RATING_CRITERIA: { key: 'relevance' | 'urgency' | 'impact' | 'stars_contribution' | 'feasibility'; label: L }[] = [
  { key: 'relevance', label: { de: 'Strategische Relevanz', en: 'Strategic relevance' } },
  { key: 'urgency', label: { de: 'Dringlichkeit', en: 'Urgency' } },
  { key: 'impact', label: { de: 'Erwartete Wirkung', en: 'Expected impact' } },
  { key: 'stars_contribution', label: { de: 'Beitrag von stars', en: 'stars contribution' } },
  { key: 'feasibility', label: { de: 'Umsetzbarkeit', en: 'Feasibility' } },
];

export const PROGRESS_LABEL: Record<string, L> = {
  none: { de: 'kein Fortschritt', en: 'no progress' },
  partial: { de: 'Teilweise erreicht', en: 'partly achieved' },
  achieved: { de: 'Ziel erreicht', en: 'goal achieved' },
};
export const NEXT_STEP_LABEL: Record<string, L> = {
  continue: { de: 'Fortsetzen', en: 'Continue' },
  new_goal: { de: 'Neues Ziel', en: 'New goal' },
  rematch: { de: 'Re-Matching', en: 'Re-match' },
  close: { de: 'Abschliessen', en: 'Close' },
};
export const CLOSE_REASON_LABEL: Record<string, L> = {
  goal_achieved: { de: 'Ziel erreicht', en: 'Goal achieved' },
  eem_request: { de: 'Wunsch des EEM', en: 'At EEM’s request' },
  no_further_need: { de: 'Kein weiterer Bedarf', en: 'No further need' },
  declined: { de: 'Aufnahme abgelehnt', en: 'Intake declined' },
};

// ---------------------------------------------------------------------------
// Vier Online-Frageboegen (je ca. 10–15 Min., ueberwiegend geschlossen)
// ---------------------------------------------------------------------------
export type Question =
  | { key: string; type: 'text' | 'textarea'; label: L }
  | { key: string; type: 'select' | 'multi'; label: L; options: { value: string; label: L }[] };

const o = (value: string, de: string, en = de) => ({ value, label: { de, en } });

export const QUESTIONNAIRES: { area: 'context' | 'ecosystem' | 'venture' | 'entrepreneur'; title: L; intro: L; questions: Question[] }[] = [
  {
    area: 'context',
    title: { de: 'Context – Rahmenbedingungen', en: 'Context – framework conditions' },
    intro: { de: 'Unter welchen äusseren Bedingungen arbeitest du? Gefragt ist die konkret erlebte Wirkung, keine Länderanalyse.', en: 'Which external conditions do you work under? We ask for the impact you actually experience, not a country analysis.' },
    questions: [
      { key: 'target_markets', type: 'text', label: { de: 'Heimmarkt und Zielmärkte', en: 'Home and target markets' } },
      { key: 'setting', type: 'select', label: { de: 'Umfeld', en: 'Setting' }, options: [o('urban', 'städtisch', 'urban'), o('rural', 'ländlich', 'rural'), o('mixed', 'gemischt', 'mixed')] },
      {
        key: 'conditions', type: 'multi', label: { de: 'Welche Rahmenbedingungen erschweren dein Geschäft spürbar?', en: 'Which conditions noticeably hinder your business?' },
        options: [
          o('regulation', 'Regulierung / Bürokratie', 'Regulation / red tape'), o('infrastructure', 'Infrastruktur', 'Infrastructure'),
          o('energy', 'Energieversorgung', 'Energy supply'), o('capital_access', 'Kapitalzugang', 'Access to capital'),
          o('currency', 'Kapitalverkehrs- / Währungsregeln', 'Capital / currency rules'), o('payment_terms', 'Lange Zahlungsfristen', 'Long payment terms'),
          o('logistics', 'Logistik', 'Logistics'), o('political', 'Politische Unsicherheit', 'Political uncertainty'),
        ],
      },
      { key: 'conditions_note', type: 'textarea', label: { de: 'Wie wirken sich diese Bedingungen konkret aus? (optional)', en: 'How do these conditions affect you concretely? (optional)' } },
    ],
  },
  {
    area: 'ecosystem',
    title: { de: 'Ecosystem – bestehende Unterstützung', en: 'Ecosystem – existing support' },
    intro: { de: 'Welche Unterstützung und Beziehungen bestehen bereits – und wie zugänglich sind sie? So vermeidet stars Doppelspurigkeiten.', en: 'Which support and relationships already exist – and how accessible are they? This helps stars avoid duplication.' },
    questions: [
      {
        key: 'existing_support', type: 'multi', label: { de: 'Was nutzt du bereits?', en: 'What do you already use?' },
        options: [
          o('incubator', 'Inkubator', 'Incubator'), o('accelerator', 'Accelerator'), o('investors', 'Investor:innen', 'Investors'),
          o('government', 'Staatliche Programme', 'Government programmes'), o('ngo_program', 'NGO-Programme', 'NGO programmes'),
          o('university', 'Hochschule', 'University'), o('informal_network', 'Informelles Netzwerk', 'Informal network'),
        ],
      },
      { key: 'access_quality', type: 'select', label: { de: 'Wie gut ist dein Zugang zu passender Unterstützung? (1 = schlecht, 5 = sehr gut)', en: 'How good is your access to suitable support? (1 = poor, 5 = very good)' }, options: ['1', '2', '3', '4', '5'].map((v) => o(v, v)) },
      { key: 'gaps', type: 'textarea', label: { de: 'Wo fehlt dir Zugang am meisten?', en: 'Where do you lack access most?' } },
    ],
  },
  {
    area: 'venture',
    title: { de: 'Venture – Unternehmen', en: 'Venture – company' },
    intro: { de: 'Geschäftsmodell und Entwicklungsstand. Finanzangaben nur als Bandbreite und freiwillig.', en: 'Business model and stage. Financial figures only as ranges and voluntary.' },
    questions: [
      { key: 'sector', type: 'text', label: { de: 'Branche', en: 'Sector' } },
      { key: 'business_model', type: 'textarea', label: { de: 'Geschäftsmodell in zwei Sätzen', en: 'Business model in two sentences' } },
      { key: 'stage', type: 'select', label: { de: 'Entwicklungsphase', en: 'Stage' }, options: [o('idea', 'Idee', 'Idea'), o('early', 'Gründung', 'Founding'), o('market_entry', 'Markteintritt', 'Market entry'), o('growth', 'Wachstum', 'Growth'), o('scaling', 'Skalierung', 'Scaling'), o('established', 'Etabliert', 'Established')] },
      { key: 'employees', type: 'select', label: { de: 'Mitarbeitende', en: 'Employees' }, options: ['1-10', '11-50', '51-200', '200+'].map((v) => o(v, v)) },
      { key: 'revenue', type: 'select', label: { de: 'Jahresumsatz (USD, freiwillig)', en: 'Annual revenue (USD, voluntary)' }, options: [o('<100k', '< 100k'), o('100k-1m', '100k – 1M'), o('1m-5m', '1M – 5M'), o('>5m', '> 5M'), o('na', 'keine Angabe', 'prefer not to say')] },
    ],
  },
  {
    area: 'entrepreneur',
    title: { de: 'Entrepreneur – persönliche Voraussetzungen', en: 'Entrepreneur – personal prerequisites' },
    intro: { de: 'Selbsteinschätzung als Gesprächsgrundlage – keine Bewertung deiner Eignung.', en: 'Self-assessment as a basis for conversation – not an assessment of your suitability.' },
    questions: [
      { key: 'experience', type: 'select', label: { de: 'Unternehmerische Erfahrung (Jahre)', en: 'Entrepreneurial experience (years)' }, options: ['<1', '1-3', '3-5', '5-10', '10+'].map((v) => o(v, v)) },
      { key: 'prior_programs', type: 'select', label: { de: 'Bereits an Förderprogrammen teilgenommen?', en: 'Previously joined support programmes?' }, options: [o('yes', 'ja', 'yes'), o('no', 'nein', 'no')] },
      { key: 'hours_per_month', type: 'select', label: { de: 'Verfügbare Zeit für Begleitung (Std./Monat)', en: 'Time available for support (h/month)' }, options: ['<2', '2-4', '4-8', '8+'].map((v) => o(v, v)) },
      { key: 'languages', type: 'multi', label: { de: 'Arbeitssprachen', en: 'Working languages' }, options: [o('en', 'Englisch', 'English'), o('fr', 'Französisch', 'French'), o('es', 'Spanisch', 'Spanish'), o('pt', 'Portugiesisch', 'Portuguese'), o('ar', 'Arabisch', 'Arabic'), o('de', 'Deutsch', 'German')] },
      { key: 'mode', type: 'select', label: { de: 'Bevorzugte Arbeitsweise', en: 'Preferred working mode' }, options: [o('online', 'online'), o('in_person', 'vor Ort', 'in person'), o('hybrid', 'hybrid')] },
      { key: 'strengths', type: 'textarea', label: { de: 'Deine Stärken und vorhandenen Ressourcen', en: 'Your strengths and existing resources' } },
    ],
  },
];

export function answerLabel(q: Question, v: string | string[] | undefined, _locale?: string): string {
  if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) return '–';
  if (q.type === 'select' || q.type === 'multi') {
    const vals = Array.isArray(v) ? v : [v];
    return vals.map((x) => q.options.find((op) => op.value === x)?.label ? lx(q.options.find((op) => op.value === x)!.label) : x).join(', ');
  }
  return Array.isArray(v) ? v.join(', ') : v;
}
