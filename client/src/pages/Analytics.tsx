// KPI-Dashboard fuer stars (Administration): Kennzahlen eines waehlbaren
// Zeitraums mit Vergleich zum Vorzeitraum, Monatsverlaeufe und Verteilungen;
// jedes Diagramm auch als Tabelle; Export aller Daten als Excel-Datei.
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n, trx, lx, dateLocale } from '../i18n';
import { Spinner } from '../components';
import { ChartCard, ColumnChart, LineChart, BarList, TableData } from '../charts';
import { downloadXlsx, Sheet } from '../xlsx';
import { STEP_LABEL, PROGRESS_LABEL } from '../journey';
import type { Step } from '../types';

type Kpis = Record<string, number | null>;
interface Data {
  months: string[];
  period: { from: string; to: string; prevFrom: string };
  kpis: Kpis;
  prev: Kpis;
  totals: Record<string, number>;
  series: Record<string, number[]>;
  journey: { step: Step; n: number }[];
  needs: { key: string; n: number }[];
  intros: { key: string; n: number }[];
  feedback: { key: string; n: number; avg_rating: number | null }[];
  countries: { key: string; n: number }[];
  communities: { name_de: string; name_en: string; members: number; posts: number }[];
  modules: { title_de: string; title_en: string; started: number; completed: number }[];
}

const L = (de: string, en: string) => ({ de, en });
const KPI_LABEL: Record<string, { de: string; en: string }> = {
  active_users: L('Aktive Nutzer:innen', 'Active users'),
  new_users: L('Neue Registrierungen', 'New registrations'),
  posts: L('Beiträge (Foren & Communities)', 'Posts (forums & communities)'),
  comments: L('Kommentare', 'Comments'),
  messages: L('Nachrichten', 'Messages'),
  matches_confirmed: L('Bestätigte Matches', 'Confirmed matches'),
  intros_made: L('Erfolgte Vorstellungen', 'Introductions made'),
  goals_achieved: L('Erreichte Ziele', 'Goals achieved'),
  modules_completed: L('Abgeschlossene Lernmodule', 'Learning modules completed'),
  sessions_held: L('Community-Sessions', 'Community sessions'),
  feedback: L('Feedback-Meldungen', 'Feedback reports'),
  avg_days_to_match: L('Ø Tage bis zum Match', 'Avg. days to match'),
  avg_rating: L('Ø Bewertung (Feedback, 1–5)', 'Avg. rating (feedback, 1–5)'),
};
const TOTAL_LABEL: Record<string, { de: string; en: string }> = {
  users: L('Aktive Konten', 'Active accounts'),
  entrepreneurs: L('Entrepreneurs', 'Entrepreneurs'),
  mentors: L('Expert:innen', 'Experts'),
  peer_experts: L('Peer-Expert:innen', 'Peer experts'),
  countries: L('Länder', 'Countries'),
  communities: L('Communities', 'Communities'),
  cases_active: L('Aktive Fälle', 'Active cases'),
  pending_registrations: L('Offene Registrierungen', 'Pending registrations'),
};
const STATUS_LABEL: Record<string, { de: string; en: string }> = {
  open: L('offen', 'open'), achieved: L('erreicht', 'achieved'), dropped: L('verworfen', 'dropped'),
  requested: L('angefragt', 'requested'), proposed: L('Person angefragt', 'person asked'), accepted: L('vorgestellt', 'introduced'),
  declined: L('abgelehnt', 'declined'), closed: L('abgeschlossen', 'closed'),
  bug: L('Fehler', 'Bug'), usability: L('Bedienung unklar', 'Usability'), idea: L('Idee / Wunsch', 'Idea / wish'),
  praise: L('Lob', 'Praise'), other: L('Sonstiges', 'Other'),
};
const st = (k: string) => (STATUS_LABEL[k] ? lx(STATUS_LABEL[k]) : PROGRESS_LABEL[k] ? lx(PROGRESS_LABEL[k]) : k);
// Bei diesen Kennzahlen ist ein kleinerer Wert besser.
const LOWER_IS_BETTER = new Set(['avg_days_to_match']);

function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(dateLocale(), { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

function delta(cur: number | null, prev: number | null) {
  if (cur === null || prev === null) return null;
  if (prev === 0) return null; // keine sinnvolle Prozentangabe (Vorzeitraum 0)
  return Math.round(((cur - prev) / prev) * 100);
}

function KpiTile({ k, cur, prev }: { k: string; cur: number | null; prev: number | null }) {
  const d = delta(cur, prev);
  const better = d === null || d === 0 ? null : LOWER_IS_BETTER.has(k) ? d < 0 : d > 0;
  return (
    <div className="kpi">
      <div className="num">{cur === null ? '–' : cur.toLocaleString()}</div>
      <div className="lbl">{lx(KPI_LABEL[k])}</div>
      <small className="muted kpi-delta" title={trx('Vergleich mit dem gleich langen Vorzeitraum', 'Compared with the previous period of equal length')}>
        {d === null
          ? `${trx('Vorzeitraum', 'Previous period')}: ${prev === null ? '–' : prev.toLocaleString()}`
          : `${d > 0 ? '▲' : d < 0 ? '▼' : '■'} ${d > 0 ? '+' : ''}${d}% ${trx('ggü. Vorzeitraum', 'vs. previous period')}${better === null ? '' : better ? ' ✓' : ''}`}
      </small>
    </div>
  );
}

export default function Analytics() {
  const { locale, loc } = useI18n();
  const [months, setMonths] = useState(12);
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    setD(null);
    api.get<Data>(`/analytics?months=${months}`).then(setD);
  }, [months]);

  if (!d) return <Spinner />;
  const labels = d.months.map(monthLabel);
  const kpiKeys = Object.keys(KPI_LABEL);

  const t = {
    reg: { head: [trx('Monat', 'Month'), trx('Entrepreneurs', 'Entrepreneurs'), trx('Expert:innen', 'Experts')], rows: d.months.map((m, i) => [labels[i], d.series.registrations_entrepreneurs[i], d.series.registrations_mentors[i]]) },
    act: { head: [trx('Monat', 'Month'), trx('Beiträge', 'Posts'), trx('Kommentare', 'Comments'), trx('Nachrichten', 'Messages')], rows: d.months.map((m, i) => [labels[i], d.series.posts[i], d.series.comments[i], d.series.messages[i]]) },
    journey: { head: [trx('Schritt', 'Step'), trx('Fälle', 'Cases')], rows: d.journey.map((j) => [lx(STEP_LABEL[j.step]), j.n]) },
    needs: { head: [trx('Status', 'Status'), trx('Bedarfe', 'Needs')], rows: d.needs.map((x) => [st(x.key), x.n]) },
    intros: { head: [trx('Status', 'Status'), trx('Anfragen', 'Requests')], rows: d.intros.map((x) => [st(x.key), x.n]) },
    feedback: { head: [trx('Kategorie', 'Category'), trx('Anzahl', 'Count'), trx('Ø Bewertung', 'Avg. rating')], rows: d.feedback.map((x) => [st(x.key), x.n, x.avg_rating]) },
    countries: { head: [trx('Land', 'Country'), trx('Konten', 'Accounts')], rows: d.countries.map((x) => [x.key, x.n]) },
    communities: { head: [trx('Community', 'Community'), trx('Mitglieder', 'Members'), trx('Beiträge', 'Posts')], rows: d.communities.map((c) => [loc(c, 'name'), c.members, c.posts]) },
    modules: { head: [trx('Lernmodul', 'Learning module'), trx('Begonnen', 'Started'), trx('Abgeschlossen', 'Completed')], rows: d.modules.map((m) => [loc(m, 'title'), m.started, m.completed]) },
  } satisfies Record<string, TableData>;

  function exportExcel() {
    const period = `${d!.period.from.slice(0, 10)} – ${d!.period.to.slice(0, 10)}`;
    const prevPeriod = `${d!.period.prevFrom.slice(0, 10)} – ${d!.period.from.slice(0, 10)}`;
    const sheets: Sheet[] = [
      {
        name: trx('Übersicht', 'Overview'),
        widths: [38, 14, 14, 16],
        rows: [
          [trx('Kennzahl', 'Indicator'), trx('Zeitraum', 'Period'), trx('Vorzeitraum', 'Previous period'), trx('Veränderung %', 'Change %')],
          ...kpiKeys.map((k) => [lx(KPI_LABEL[k]), d!.kpis[k], d!.prev[k], delta(d!.kpis[k], d!.prev[k])]),
          [],
          [trx('Zeitraum', 'Period'), period],
          [trx('Vorzeitraum', 'Previous period'), prevPeriod],
          [trx('Exportiert am', 'Exported on'), new Date().toLocaleString(dateLocale())],
        ],
      },
      { name: trx('Bestand', 'Totals'), widths: [30, 12], rows: [[trx('Kennzahl', 'Indicator'), trx('Wert', 'Value')], ...Object.keys(TOTAL_LABEL).map((k) => [lx(TOTAL_LABEL[k]), d!.totals[k]])] },
      { name: trx('Monatsverlauf', 'Monthly trend'), widths: [12, 16, 14, 12, 14, 14], rows: [
        [trx('Monat', 'Month'), trx('Neue Entrepreneurs', 'New entrepreneurs'), trx('Neue Expert:innen', 'New experts'), trx('Beiträge', 'Posts'), trx('Kommentare', 'Comments'), trx('Nachrichten', 'Messages')],
        ...d!.months.map((m, i) => [m, d!.series.registrations_entrepreneurs[i], d!.series.registrations_mentors[i], d!.series.posts[i], d!.series.comments[i], d!.series.messages[i]]),
      ] },
      { name: 'Support Journey', widths: [24, 10], rows: [t.journey.head, ...t.journey.rows] },
      { name: trx('Bedarfe', 'Needs'), widths: [20, 10], rows: [t.needs.head, ...t.needs.rows] },
      { name: trx('Intro-Anfragen', 'Intro requests'), widths: [20, 10], rows: [t.intros.head, ...t.intros.rows] },
      { name: 'Feedback', widths: [20, 10, 12], rows: [t.feedback.head, ...t.feedback.rows] },
      { name: trx('Länder', 'Countries'), widths: [22, 10], rows: [t.countries.head, ...t.countries.rows] },
      { name: 'Communities', widths: [34, 12, 10], rows: [t.communities.head, ...t.communities.rows] },
      { name: trx('Lernmodule', 'Learning modules'), widths: [40, 10, 14], rows: [t.modules.head, ...t.modules.rows] },
    ];
    downloadXlsx(`stars-KPI-${new Date().toISOString().slice(0, 10)}.xlsx`, sheets);
  }

  return (
    <div key={locale}>
      <div className="page-head flex items-center gap-sm wrap">
        <div>
          <h1>{trx('KPI-Dashboard', 'KPI dashboard')}</h1>
          <p>{trx(
            'Wirkung und Nutzung der Plattform im gewählten Zeitraum, verglichen mit dem gleich langen Vorzeitraum.',
            'Impact and usage of the platform in the selected period, compared with the previous period of equal length.'
          )}</p>
        </div>
        <div className="right flex gap-sm items-center">
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} style={{ width: 'auto' }} aria-label={trx('Zeitraum', 'Period')}>
            {[3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} {trx('Monate', 'months')}</option>)}
          </select>
          <button className="btn-gold" onClick={exportExcel}>⬇ {trx('Excel exportieren', 'Export to Excel')}</button>
        </div>
      </div>

      <div className="grid grid-4">
        {kpiKeys.map((k) => <KpiTile key={k} k={k} cur={d.kpis[k]} prev={d.prev[k]} />)}
      </div>

      <div className="card mt">
        <h3 style={{ marginTop: 0 }}>{trx('Bestand heute', 'Current totals')}</h3>
        <div className="grid grid-4">
          {Object.keys(TOTAL_LABEL).map((k) => (
            <div key={k} className="kpi kpi-sm"><div className="num">{d.totals[k].toLocaleString()}</div><div className="lbl">{lx(TOTAL_LABEL[k])}</div></div>
          ))}
        </div>
      </div>

      <div className="grid grid-2 mt">
        <ChartCard wide title={trx('Neue Registrierungen pro Monat', 'New registrations per month')} subtitle={trx('nach Rolle', 'by role')} table={t.reg}>
          <ColumnChart wide labels={labels} series={[
            { name: trx('Entrepreneurs', 'Entrepreneurs'), values: d.series.registrations_entrepreneurs },
            { name: trx('Expert:innen', 'Experts'), values: d.series.registrations_mentors },
          ]} />
        </ChartCard>
        <ChartCard wide title={trx('Aktivität pro Monat', 'Activity per month')} subtitle={trx('Beiträge, Kommentare und Direktnachrichten', 'Posts, comments and direct messages')} table={t.act}>
          <LineChart wide labels={labels} series={[
            { name: trx('Beiträge', 'Posts'), values: d.series.posts },
            { name: trx('Kommentare', 'Comments'), values: d.series.comments },
            { name: trx('Nachrichten', 'Messages'), values: d.series.messages },
          ]} />
        </ChartCard>
        <ChartCard title={trx('Support Journey: Fälle je Schritt', 'Support Journey: cases per step')} subtitle={trx('aktueller Stand', 'current status')} table={t.journey}>
          <BarList rows={d.journey.map((j) => ({ label: lx(STEP_LABEL[j.step]), value: j.n }))} />
        </ChartCard>
        <ChartCard title={trx('Priorisierte Bedarfe nach Status', 'Prioritised needs by status')} table={t.needs}>
          <BarList rows={d.needs.map((x) => ({ label: st(x.key), value: x.n }))} />
        </ChartCard>
        <ChartCard title={trx('Intro-Anfragen nach Status', 'Intro requests by status')} table={t.intros}>
          <BarList rows={d.intros.map((x) => ({ label: st(x.key), value: x.n }))} />
        </ChartCard>
        <ChartCard title={trx('Feedback nach Kategorie', 'Feedback by category')} subtitle={trx('mit Ø Bewertung', 'with avg. rating')} table={t.feedback}>
          <BarList rows={d.feedback.map((x) => ({ label: st(x.key), value: x.n, hint: x.avg_rating ? `Ø ${x.avg_rating} ★` : undefined }))} />
        </ChartCard>
        <ChartCard title={trx('Konten nach Land', 'Accounts by country')} subtitle={trx('Top 12', 'Top 12')} table={t.countries}>
          <BarList rows={d.countries.map((x) => ({ label: x.key, value: x.n }))} />
        </ChartCard>
        <ChartCard title={trx('Communities: Mitglieder', 'Communities: members')} subtitle={trx('mit Anzahl Beiträge', 'with number of posts')} table={t.communities}>
          <BarList rows={d.communities.map((c) => ({ label: loc(c, 'name'), value: c.members, hint: `${c.posts} ${trx('Beiträge', 'posts')}` }))} />
        </ChartCard>
        <ChartCard wide title={trx('Microlearning: abgeschlossene Module', 'Microlearning: completed modules')} subtitle={trx('mit Anzahl begonnen', 'with number started')} table={t.modules}>
          <BarList rows={d.modules.map((m) => ({ label: loc(m, 'title'), value: m.completed, hint: `${m.started} ${trx('begonnen', 'started')}` }))} />
        </ChartCard>
      </div>
    </div>
  );
}
