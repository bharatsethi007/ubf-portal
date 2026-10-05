import type React from 'react'

/* ── Formatters ── */
export function fmtBytes(n: number | null | undefined): string {
  const v = Number(n || 0)
  if (v >= 1024 ** 3) return (v / 1024 ** 3).toFixed(2) + ' GB'
  if (v >= 1024 ** 2) return (v / 1024 ** 2).toFixed(1) + ' MB'
  if (v >= 1024) return Math.round(v / 1024) + ' KB'
  return Math.round(v) + ' B'
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export const hoursSince = (iso: string | null | undefined) =>
  iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : Infinity

export function nzTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-NZ', {
    timeZone: 'Pacific/Auckland', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export const ms = (n: number | null | undefined) => (n == null ? '—' : n >= 1000 ? (n / 1000).toFixed(1) + 's' : n + 'ms')

/* ── Status language: ok / warn / bad / idle ── */
export type Tone = 'ok' | 'warn' | 'bad' | 'idle'
export const TONE_LABEL: Record<Tone, string> = { ok: 'Healthy', warn: 'Degraded', bad: 'Down', idle: 'No data' }

export function Dot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  return <span className={`sh-dot sh-dot--${tone}${pulse ? ' sh-dot--pulse' : ''}`} aria-hidden="true" />
}

export function StatusPill({ tone, children }: { tone: Tone; children?: React.ReactNode }) {
  return (
    <span className={`sh-pill sh-pill--${tone}`}>
      <Dot tone={tone} />{children ?? TONE_LABEL[tone]}
    </span>
  )
}

/* Thin hourly bar strip, 24 buckets. Bars grow in on mount. */
export function HourBars({ data, tone = 'ok' }: { data: number[] | null | undefined; tone?: Tone }) {
  const d = data && data.length ? data : Array(24).fill(0)
  const max = Math.max(1, ...d)
  return (
    <div className="sh-bars" aria-hidden="true">
      {d.map((v, i) => (
        <i key={i} className={`sh-bars__b sh-bars__b--${v ? tone : 'idle'}`}
          style={{ height: `${Math.max(8, (v / max) * 100)}%`, animationDelay: `${i * 12}ms` }} />
      ))}
    </div>
  )
}

/* Radial gauge for percentages (DB used, connections). */
export function Gauge({ pct, label, sub, tone }: { pct: number; label: string; sub: string; tone: Tone }) {
  const r = 42, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct))
  return (
    <div className="sh-gauge">
      <svg viewBox="0 0 100 100" width="104" height="104" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line-soft)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" className={`sh-gauge__arc sh-gauge__arc--${tone}`} strokeWidth="9"
          strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 50 50)" />
        <text x="50" y="55" textAnchor="middle" className="sh-gauge__v">{Math.round(p)}%</text>
      </svg>
      <div>
        <div className="sh-gauge__l">{label}</div>
        <div className="sh-gauge__s">{sub}</div>
      </div>
    </div>
  )
}

/* Horizontal share bar for a ranked list. */
export function ShareRow({ label, value, max, right, tone = 'ok', delay = 0 }: {
  label: React.ReactNode; value: number; max: number; right: React.ReactNode; tone?: Tone; delay?: number
}) {
  return (
    <div className="sh-share">
      <div className="sh-share__top"><span className="sh-share__l">{label}</span><span className="tw-num">{right}</span></div>
      <div className="sh-share__track">
        <i className={`sh-share__fill sh-share__fill--${tone}`}
          style={{ width: `${max ? Math.max(1.5, (value / max) * 100) : 0}%`, animationDelay: `${delay}ms` }} />
      </div>
    </div>
  )
}

export function Mono({ children }: { children: React.ReactNode }) {
  return <pre className="sh-mono">{children}</pre>
}
