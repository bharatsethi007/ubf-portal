// profileUi.tsx — shared presentational primitives (plain CSS, classes in customerProfile.css)
import React from 'react';

export const fmt = {
  int: (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString()),
  num: (n: number | null | undefined, d = 1) =>
    n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: d }),
  date: (d: string | null | undefined) =>
    !d ? '—' : new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }),
  monthLabel: (m: string) => {
    const [y, mm] = m.split('-');
    return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString(undefined, { month: 'short' });
  },
};

export function KpiCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="cp-kpi">
      <div className="cp-kpi-label">{label}</div>
      <div className="cp-kpi-value">{value}</div>
      {sub != null && <div className="cp-kpi-sub">{sub}</div>}
    </div>
  );
}

const STATUS_CLASS: Record<string, string> = {
  'Arrived': 'cp-pill--arrived',
  'Arrived (est.)': 'cp-pill--arrivedest',
  'In transit': 'cp-pill--transit',
  'Booked': 'cp-pill--booked',
  'Scheduled': 'cp-pill--scheduled',
};

export function StatusPill({ status }: { status: string | null }) {
  if (!status) return <span className="cp-muted">—</span>;
  const cls = STATUS_CLASS[status] ?? 'cp-pill--scheduled';
  return <span className={`cp-pill ${cls}`}>{status}</span>;
}

export function ModeIcon({ mode }: { mode: string | null }) {
  if (mode === 'air') return <span title="Air" className="cp-mode-air">✈</span>;
  if (mode === 'sea') return <span title="Sea" className="cp-mode-sea">🚢</span>;
  return <span className="cp-muted">—</span>;
}

export function Lane({ origin, destination }: { origin: string | null; destination: string | null }) {
  return (
    <span className="cp-lane">
      <span>{origin ?? '—'}</span>
      <span className="cp-arrow">→</span>
      <span>{destination ?? '—'}</span>
    </span>
  );
}

export function MiniBars({
  data, valueKey, color = 'cp-bar--indigo',
}: { data: { month: string; count: number; volume_m3: number; weight_kg: number }[]; valueKey: 'count' | 'volume_m3'; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey] as number));
  return (
    <div className="cp-bars">
      {data.map((d) => {
        const v = d[valueKey] as number;
        const h = Math.max(2, Math.round((v / max) * 110));
        return (
          <div key={d.month} className="cp-bar-col">
            <div className="cp-bar-stack">
              <div className={`cp-bar ${color}`} style={{ height: `${h}px` }} />
              <div className="cp-bar-tip">{valueKey === 'count' ? `${v} shp` : `${fmt.num(v)} m³`}</div>
            </div>
            <div className="cp-bar-label">{fmt.monthLabel(d.month)}</div>
          </div>
        );
      })}
    </div>
  );
}

export function SplitBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = Math.max(1, segments.reduce((a, s) => a + s.value, 0));
  return (
    <div>
      <div className="cp-split-track">
        {segments.map((s) => (
          <div key={s.label} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="cp-split-legend">
        {segments.map((s) => (
          <span key={s.label} className="cp-legend-item">
            <span className={`cp-dot ${s.color}`} />
            <span>{s.label}</span>
            <b>{Math.round((s.value / total) * 100)}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Card({ title, action, children, wide }: { title: string; action?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'cp-card cp-card--wide' : 'cp-card'}>
      <div className="cp-card-head">
        <h3 className="cp-card-title">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
