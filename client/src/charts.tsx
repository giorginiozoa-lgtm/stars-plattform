// Schlanke Diagramm-Bausteine (SVG/HTML, ohne Chart-Bibliothek) fuer das
// KPI-Dashboard. Gestaltungsregeln: duenne Marken, 4px gerundete Datenenden,
// 2px Linien, dezente Gitterlinien, Legende ab zwei Reihen, Tooltip beim
// Darueberfahren und jederzeit eine Tabellenansicht.
import { useRef, useState, ReactNode } from 'react';
import { trx } from './i18n';

// Kategoriale Reihenfarben in fester Reihenfolge (validierte Referenzpalette).
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
const GRID = '#e6e9ef';
const AXIS = '#6b7280';

export interface TableData { head: string[]; rows: (string | number | null)[][] }

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '–' : v.toLocaleString());

// Achsenmaximum mit vier ganzzahligen, runden Schritten (1/2/3/5 x 10^k).
function niceMax(v: number) {
  const raw = Math.max(1, v) / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 3, 5, 10].map((m) => m * p).find((s) => s >= raw && Number.isInteger(s)) ?? Math.ceil(raw);
  return Math.max(1, step) * 4;
}

export function ChartCard({ title, subtitle, table, children, wide }: { title: string; subtitle?: string; table: TableData; children: ReactNode; wide?: boolean }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div className="card chart-card" style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <div className="flex items-center gap-sm">
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {subtitle && <small className="muted">{subtitle}</small>}
        </div>
        <button className="btn-ghost btn-sm right" onClick={() => setShowTable((s) => !s)} aria-pressed={showTable}>
          {showTable ? trx('Diagramm', 'Chart') : trx('Tabelle', 'Table')}
        </button>
      </div>
      <div className="mt-sm">
        {showTable ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr>{table.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={typeof c === 'number' ? 'num' : ''}>{typeof c === 'number' ? fmt(c) : c ?? '–'}</td>)}</tr>)}</tbody>
            </table>
          </div>
        ) : children}
      </div>
    </div>
  );
}

function Legend({ items }: { items: { name: string; color: string }[] }) {
  if (items.length < 2) return null;
  return (
    <div className="chart-legend">
      {items.map((it) => <span key={it.name}><i style={{ background: it.color }} />{it.name}</span>)}
    </div>
  );
}

interface Series { name: string; values: number[]; color?: string }
const H = 220, PL = 34, PR = 12, PT = 12, PB = 28;
const widthOf = (wide?: boolean) => (wide ? 1150 : 640);

function useTooltip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; i: number } | null>(null);
  function move(e: React.MouseEvent, i: number) {
    const r = ref.current!.getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, i });
  }
  return { ref, tip, move, clear: () => setTip(null) };
}

function Tooltip({ tip, label, lines, width }: { tip: { x: number; y: number }; label: string; lines: { name: string; value: number; color: string }[]; width: number }) {
  const left = Math.min(tip.x + 12, width - 170);
  return (
    <div className="chart-tip" style={{ left: Math.max(0, left), top: Math.max(0, tip.y - 10) }}>
      <b>{label}</b>
      {lines.map((l) => <div key={l.name}><i style={{ background: l.color }} />{l.name}: <b>{fmt(l.value)}</b></div>)}
    </div>
  );
}

function YGrid({ max, w }: { max: number; w: number }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const ih = H - PT - PB;
  return (
    <g>
      {ticks.map((t, i) => {
        const y = PT + ih - (t / max) * ih;
        return (
          <g key={i}>
            <line x1={PL} x2={w - PR} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
            <text x={PL - 6} y={y + 4} textAnchor="end" fontSize={w > 800 ? 14 : 11} fill={AXIS}>{t.toLocaleString()}</text>
          </g>
        );
      })}
    </g>
  );
}

/** Gestapelte Saeulen je Kategorie (z.B. Monat); eine Reihe = einfache Saeulen. */
export function ColumnChart({ labels, series, wide }: { labels: string[]; series: Series[]; wide?: boolean }) {
  const W = widthOf(wide);
  const { ref, tip, move, clear } = useTooltip();
  const s = series.map((x, i) => ({ ...x, color: x.color || SERIES[i] }));
  const totals = labels.map((_, i) => s.reduce((a, x) => a + (x.values[i] || 0), 0));
  const max = niceMax(Math.max(1, ...totals));
  const iw = W - PL - PR, ih = H - PT - PB;
  const band = iw / labels.length;
  const bw = Math.min(24, band * 0.6);
  const step = Math.ceil(labels.length / 12);
  return (
    <div ref={ref} className="chart-wrap" onMouseLeave={clear}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={s.map((x) => x.name).join(', ')}>
        <YGrid max={max} w={W} />
        {labels.map((lab, i) => {
          const x = PL + band * i + (band - bw) / 2;
          let y = PT + ih;
          const segs = s.map((ser, k) => {
            const v = ser.values[i] || 0;
            const h = (v / max) * ih;
            const top = k === s.length - 1 || s.slice(k + 1).every((n) => !(n.values[i] || 0));
            y -= h;
            if (h <= 0) return null;
            const gap = k > 0 ? 2 : 0; // 2px Oberflaechenluecke zwischen Segmenten
            const hh = Math.max(0, h - gap);
            const r = top ? Math.min(4, hh / 2, bw / 2) : 0;
            const d = `M${x},${y + hh} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${y + hh} Z`;
            return <path key={k} d={d} fill={ser.color} />;
          });
          return (
            <g key={i}>
              {segs}
              {i % step === 0 && <text x={PL + band * i + band / 2} y={H - 8} textAnchor="middle" fontSize={W > 800 ? 14 : 11} fill={AXIS}>{lab}</text>}
              <rect x={PL + band * i} y={PT} width={band} height={ih} fill="transparent" onMouseMove={(e) => move(e, i)} />
            </g>
          );
        })}
      </svg>
      <Legend items={s} />
      {tip && <Tooltip tip={tip} width={ref.current?.clientWidth || W} label={labels[tip.i]}
        lines={[...s.map((x) => ({ name: x.name, value: x.values[tip.i] || 0, color: x.color })), ...(s.length > 1 ? [{ name: trx('Total', 'Total'), value: totals[tip.i], color: 'transparent' }] : [])]} />}
    </div>
  );
}

/** Linien je Reihe ueber die Zeit, mit Fadenkreuz-Tooltip. */
export function LineChart({ labels, series, wide }: { labels: string[]; series: Series[]; wide?: boolean }) {
  const W = widthOf(wide);
  const { ref, tip, move, clear } = useTooltip();
  const s = series.map((x, i) => ({ ...x, color: x.color || SERIES[i] }));
  const max = niceMax(Math.max(1, ...s.flatMap((x) => x.values)));
  const iw = W - PL - PR, ih = H - PT - PB;
  const xAt = (i: number) => PL + (labels.length === 1 ? iw / 2 : (iw * i) / (labels.length - 1));
  const yAt = (v: number) => PT + ih - (v / max) * ih;
  const step = Math.ceil(labels.length / 12);
  const band = iw / Math.max(1, labels.length - 1);
  return (
    <div ref={ref} className="chart-wrap" onMouseLeave={clear}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={s.map((x) => x.name).join(', ')}>
        <YGrid max={max} w={W} />
        {labels.map((lab, i) => i % step === 0 && <text key={i} x={xAt(i)} y={H - 8} textAnchor="middle" fontSize={W > 800 ? 14 : 11} fill={AXIS}>{lab}</text>)}
        {tip && <line x1={xAt(tip.i)} x2={xAt(tip.i)} y1={PT} y2={PT + ih} stroke={AXIS} strokeWidth={1} opacity={0.4} />}
        {s.map((ser) => (
          <g key={ser.name}>
            <polyline points={ser.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')} fill="none" stroke={ser.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={xAt(ser.values.length - 1)} cy={yAt(ser.values[ser.values.length - 1] || 0)} r={4} fill={ser.color} stroke="#fff" strokeWidth={2} />
            {tip && <circle cx={xAt(tip.i)} cy={yAt(ser.values[tip.i] || 0)} r={4} fill={ser.color} stroke="#fff" strokeWidth={2} />}
          </g>
        ))}
        {labels.map((_, i) => (
          <rect key={i} x={xAt(i) - band / 2} y={PT} width={band} height={ih} fill="transparent" onMouseMove={(e) => move(e, i)} />
        ))}
      </svg>
      <Legend items={s} />
      {tip && <Tooltip tip={tip} width={ref.current?.clientWidth || W} label={labels[tip.i]}
        lines={s.map((x) => ({ name: x.name, value: x.values[tip.i] || 0, color: x.color }))} />}
    </div>
  );
}

/** Horizontale Balken (Kategorien), Wert am Balkenende. */
export function BarList({ rows, color = SERIES[0] }: { rows: { label: string; value: number; hint?: string }[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="muted">{trx('Noch keine Daten.', 'No data yet.')}</p>;
  return (
    <div className="barlist">
      {rows.map((r, i) => (
        <div key={i} className="barlist-row" title={`${r.label}: ${fmt(r.value)}${r.hint ? ` · ${r.hint}` : ''}`}>
          <span className="barlist-label">{r.label}</span>
          <span className="barlist-track">
            <span className="barlist-bar" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
            <span className="barlist-val">{fmt(r.value)}{r.hint ? <small className="muted"> · {r.hint}</small> : null}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
