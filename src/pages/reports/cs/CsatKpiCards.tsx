import { nf } from '../reportsUi'
import type { CsatSummary } from './csatApi'

const NAVY_COLOR = '#0A2472'

function csatColor(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return 'var(--color-ink)'
  if (pct >= 80) return '#1F8A4C'
  if (pct >= 60) return '#B4791F'
  return '#B23B3B'
}

function fmtPct(v: number | null | undefined, loading: boolean): string {
  if (loading) return '…'
  if (v == null || Number.isNaN(v)) return '—'
  return `${Number(v).toFixed(1)}%`
}

function fmtNum(v: number | null | undefined, loading: boolean, digits = 1): string {
  if (loading) return '…'
  if (v == null || Number.isNaN(v)) return '—'
  return Number(v).toFixed(digits)
}

type Props = { summary: CsatSummary | null; loading: boolean }

export default function CsatKpiCards({ summary, loading }: Props) {
  const s = summary
  const csatPct = s?.csat_pct ?? null
  const csatAccent = csatColor(csatPct)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
      <div className="card quotes-page__card" style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 8 }}>CSAT %</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: loading ? 'var(--muted-foreground)' : csatAccent, letterSpacing: '-0.02em' }}>
          {fmtPct(csatPct, loading)}
        </div>
      </div>
      {[
        { label: 'Avg score /5', value: fmtNum(s?.avg_score, loading) },
        { label: 'Responses', value: loading ? '…' : nf.format(s?.responses ?? 0) },
        { label: 'Response rate', value: fmtPct(s?.response_rate, loading) },
        { label: 'Dissatisfied', value: loading ? '…' : nf.format(s?.dissatisfied ?? 0) },
        { label: 'Accounts rated', value: loading ? '…' : nf.format(s?.distinct_accounts ?? 0) },
      ].map((k) => (
        <div key={k.label} className="card quotes-page__card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ width: 2, height: 11, background: NAVY_COLOR, borderRadius: 2 }} />
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{k.label}</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: NAVY_COLOR }}>{k.value}</div>
        </div>
      ))}
    </div>
  )
}

export { csatColor, fmtPct, fmtNum }
