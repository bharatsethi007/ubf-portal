import { useMemo } from 'react'
import type { PortMap } from '@/hooks/usePorts'
import { resolvePortCountryCode } from '@/features/portal/dashboard/portalPortDisplay'
import { NAVY, ORANGE, C, cf, nf, Th, Td, Seg } from './reportsUi'

export type AccountRow = {
  customer_account_id: string
  customer_name: string
  jobs: number
  revenue: number
  gross_profit: number
  margin: number | null
  last_activity: string | null
}

export type MixRow = {
  dimension: 'segment' | 'lane'
  label: string | null
  origin_code: string | null
  destination_code: string | null
  jobs: number
  revenue: number
  gross_profit: number
  margin: number | null
}

const ACCOUNT_PREVIEW = 25
const LANE_PREVIEW = 15
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const num = (v: any) => Number(v || 0)

const DRILL_VIEWS = [
  { k: 'accounts', label: 'Accounts' },
  { k: 'mix', label: 'Mix' },
] as const
export type DrillView = (typeof DRILL_VIEWS)[number]['k']

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

function GpShareBar({ share }: { share: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      <div style={{ flex: 1, maxWidth: 72, height: 4, background: C.line, borderRadius: 2 }}>
        <div style={{ width: `${Math.min(100, Math.max(0, share))}%`, height: '100%', background: NAVY, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color: C.mut, whiteSpace: 'nowrap', minWidth: 32, textAlign: 'right' }}>
        {share.toFixed(0)}%
      </span>
    </div>
  )
}

function AccountsPanel({
  accounts,
  loading,
  showAll,
  onToggleShowAll,
}: {
  accounts: AccountRow[]
  loading: boolean
  showAll: boolean
  onToggleShowAll: () => void
}) {
  const visible = showAll ? accounts : accounts.slice(0, ACCOUNT_PREVIEW)
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 12, color: C.mut }}>
        <InlineSpinner /> Loading accounts…
      </div>
    )
  }
  if (accounts.length === 0) {
    return <div style={{ padding: '6px 4px', fontSize: 12.5, color: C.mut }}>No accounts in this period.</div>
  }
  return (
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
          {visible.map((a) => (
            <tr key={a.customer_account_id} style={{ borderTop: `1px solid ${C.line}` }}>
              <Td strong trunc title={a.customer_name}>{a.customer_name?.trim() || a.customer_account_id}</Td>
              <Td right>{nf.format(num(a.jobs))}</Td>
              <Td right>{cf.format(num(a.revenue))}</Td>
              <Td right><span style={{ color: ORANGE }}>{cf.format(num(a.gross_profit))}</span></Td>
              <Td right>{a.margin != null ? `${num(a.margin).toFixed(1)}%` : '—'}</Td>
              <Td right muted>{fmtActivity(a.last_activity)}</Td>
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
          {showAll ? 'Show top 25' : `Show all ${accounts.length} accounts`}
        </button>
      )}
    </>
  )
}

function MixPanel({ rows, loading, ports }: { rows: MixRow[]; loading: boolean; ports: PortMap }) {
  const segments = useMemo(() => rows.filter((r) => r.dimension === 'segment'), [rows])
  const lanes = useMemo(() => rows.filter((r) => r.dimension === 'lane').slice(0, LANE_PREVIEW), [rows])
  const segmentGpTotal = useMemo(
    () => segments.reduce((s, r) => s + num(r.gross_profit), 0),
    [segments],
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 12, color: C.mut }}>
        <InlineSpinner /> Loading mix…
      </div>
    )
  }
  if (rows.length === 0) {
    return <div style={{ padding: '6px 4px', fontSize: 12.5, color: C.mut }}>No mix data for this period.</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8, color: C.ink2 }}>By segment</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Th>Segment</Th>
              <Th right>Jobs</Th>
              <Th right>Revenue</Th>
              <Th right>Gross profit</Th>
              <Th right>GM %</Th>
              <Th right>% of GP</Th>
            </tr>
          </thead>
          <tbody>
            {segments.map((r, i) => {
              const share = segmentGpTotal ? (num(r.gross_profit) / segmentGpTotal) * 100 : 0
              return (
                <tr key={`${r.label}-${i}`} style={{ borderTop: `1px solid ${C.line}` }}>
                  <Td strong>{r.label?.trim() || '—'}</Td>
                  <Td right>{nf.format(num(r.jobs))}</Td>
                  <Td right>{cf.format(num(r.revenue))}</Td>
                  <Td right><span style={{ color: ORANGE }}>{cf.format(num(r.gross_profit))}</span></Td>
                  <Td right>{r.margin != null ? `${num(r.margin).toFixed(1)}%` : '—'}</Td>
                  <Td right><GpShareBar share={share} /></Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8, color: C.ink2 }}>Top lanes</div>
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
      </div>
    </div>
  )
}

type Props = {
  view: DrillView
  onViewChange: (view: DrillView) => void
  accounts: AccountRow[]
  accountsLoading: boolean
  showAll: boolean
  onToggleShowAll: () => void
  mixRows: MixRow[]
  mixLoading: boolean
  ports: PortMap
}

export function RepDrillDown({
  view,
  onViewChange,
  accounts,
  accountsLoading,
  showAll,
  onToggleShowAll,
  mixRows,
  mixLoading,
  ports,
}: Props) {
  return (
    <div
      style={{ padding: '10px 16px 12px 28px', background: C.chip, borderTop: `1px solid ${C.line}` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ marginBottom: 10 }}>
        <Seg options={DRILL_VIEWS as any} value={view} onChange={(k) => onViewChange(k as DrillView)} />
      </div>
      {view === 'accounts' ? (
        <AccountsPanel
          accounts={accounts}
          loading={accountsLoading}
          showAll={showAll}
          onToggleShowAll={onToggleShowAll}
        />
      ) : (
        <MixPanel rows={mixRows} loading={mixLoading} ports={ports} />
      )}
    </div>
  )
}
