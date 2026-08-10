import { useMemo } from 'react'
import type { PortMap } from '@/hooks/usePorts'
import { resolvePortCountryCode } from '@/features/portal/dashboard/portalPortDisplay'
import { NAVY, ORANGE, C, cf, nf, Th, Td, Seg } from './reportsUi'

export type NveDetailRow = {
  dimension: 'account' | 'lane'
  is_new: boolean
  key_id: string | null
  label: string | null
  origin_code: string | null
  destination_code: string | null
  jobs: number
  revenue: number
  gross_profit: number
  margin: number | null
  last_activity: string | null
}

const ACCOUNT_PREVIEW = 25
const LANE_PREVIEW = 15
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const num = (v: any) => Number(v || 0)

const SIDE_OPTS = [
  { k: 'new', label: 'New' },
  { k: 'existing', label: 'Existing' },
] as const
export type NveSide = (typeof SIDE_OPTS)[number]['k']

function fmtActivity(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function InlineSpinner() {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
        border: `2px solid ${C.line}`, borderTopColor: NAVY,
        animation: 'sales-analytics-spin 0.7s linear infinite',
      }}
    />
  )
}

function PortCode({ code, ports }: { code: string; ports: PortMap }) {
  const mode = code.length === 3 ? 'air' : 'sea'
  const cc = resolvePortCountryCode(code, mode, ports)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      {cc !== 'un' ? (
        <span className={`fi fi-${cc}`} aria-hidden style={{ marginRight: 4, borderRadius: 2 }} />
      ) : null}
      {code}
    </span>
  )
}

function LaneCell({ origin, destination, ports }: { origin: string | null; destination: string | null; ports: PortMap }) {
  const o = origin?.trim() || ''
  const d = destination?.trim() || ''
  if (!o && !d) return <>—</>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      {o ? <PortCode code={o} ports={ports} /> : '—'}
      <span aria-hidden style={{ color: C.mut }}>→</span>
      {d ? <PortCode code={d} ports={ports} /> : '—'}
    </span>
  )
}

type Props = {
  rows: NveDetailRow[]
  loading: boolean
  side: NveSide
  onSideChange: (side: NveSide) => void
  showAll: boolean
  onToggleShowAll: () => void
  ports: PortMap
}

export function NveDetailDrillDown({ rows, loading, side, onSideChange, showAll, onToggleShowAll, ports }: Props) {
  const filtered = useMemo(
    () => rows.filter((r) => (side === 'new' ? r.is_new : !r.is_new)),
    [rows, side],
  )
  const accounts = useMemo(() => filtered.filter((r) => r.dimension === 'account'), [filtered])
  const lanes = useMemo(() => filtered.filter((r) => r.dimension === 'lane').slice(0, LANE_PREVIEW), [filtered])
  const visibleAccounts = showAll ? accounts : accounts.slice(0, ACCOUNT_PREVIEW)

  const summary = useMemo(() => {
    const acctCount = accounts.length
    const gp = accounts.reduce((s, r) => s + num(r.gross_profit), 0)
    return { acctCount, gp }
  }, [accounts])

  const sideWord = side === 'new' ? 'new' : 'existing'

  return (
    <div
      style={{ padding: '10px 16px 12px 28px', background: C.chip, borderTop: `1px solid ${C.line}` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ marginBottom: 10 }}>
        <Seg options={SIDE_OPTS as any} value={side} onChange={(k) => onSideChange(k as NveSide)} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 12, color: C.mut }}>
          <InlineSpinner /> Loading detail…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '6px 4px', fontSize: 12.5, color: C.mut }}>
          No {sideWord} customers in this period.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: C.ink2, marginBottom: 12 }}>
            {nf.format(summary.acctCount)} {sideWord} account{summary.acctCount === 1 ? '' : 's'} · {cf.format(summary.gp)} GP
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8, color: C.ink2 }}>Customers</div>
              {accounts.length === 0 ? (
                <div style={{ fontSize: 12.5, color: C.mut }}>No {sideWord} customers in this period.</div>
              ) : (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <Th>Customer</Th>
                        <Th right>Jobs</Th>
                        <Th right>Revenue</Th>
                        <Th right>Gross profit</Th>
                        <Th right>GM %</Th>
                        <Th right>Last activity</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleAccounts.map((r, i) => (
                        <tr key={r.key_id ?? `${r.label}-${i}`} style={{ borderTop: `1px solid ${C.line}` }}>
                          <Td strong trunc title={r.label || undefined}>{r.label?.trim() || r.key_id || '—'}</Td>
                          <Td right>{nf.format(num(r.jobs))}</Td>
                          <Td right>{cf.format(num(r.revenue))}</Td>
                          <Td right><span style={{ color: ORANGE }}>{cf.format(num(r.gross_profit))}</span></Td>
                          <Td right>{r.margin != null ? `${num(r.margin).toFixed(1)}%` : '—'}</Td>
                          <Td right muted>{fmtActivity(r.last_activity)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {accounts.length > ACCOUNT_PREVIEW && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleShowAll() }}
                      style={{
                        marginTop: 8, border: 'none', background: 'none', padding: 0,
                        fontSize: 12, color: NAVY, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {showAll ? 'Show top 25' : `Show all ${accounts.length}`}
                    </button>
                  )}
                </>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8, color: C.ink2 }}>Top lanes</div>
              {lanes.length === 0 ? (
                <div style={{ fontSize: 12.5, color: C.mut }}>No lanes in this period.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <Th>Lane</Th>
                      <Th right>Jobs</Th>
                      <Th right>Revenue</Th>
                      <Th right>Gross profit</Th>
                      <Th right>GM %</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {lanes.map((r, i) => (
                      <tr key={`${r.origin_code}-${r.destination_code}-${i}`} style={{ borderTop: `1px solid ${C.line}` }}>
                        <Td><LaneCell origin={r.origin_code} destination={r.destination_code} ports={ports} /></Td>
                        <Td right>{nf.format(num(r.jobs))}</Td>
                        <Td right>{cf.format(num(r.revenue))}</Td>
                        <Td right><span style={{ color: ORANGE }}>{cf.format(num(r.gross_profit))}</span></Td>
                        <Td right>{r.margin != null ? `${num(r.margin).toFixed(1)}%` : '—'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
