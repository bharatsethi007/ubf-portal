import { type ReactNode, useMemo } from 'react'
import { NAVY, ORANGE, C, cf, nf, Card, KpiRail, Th, Td } from './reportsUi'

export type NewVsExistingRow = {
  sales_manager: string | null
  is_unassigned: boolean
  new_accounts: number
  new_jobs: number
  new_revenue: number
  new_gp: number
  existing_accounts: number
  existing_jobs: number
  existing_revenue: number
  existing_gp: number
  total_gp: number
  new_gp_pct: number | null
}

const COL_SPAN = 9
export const NVE_UNASSIGNED_KEY = '__unassigned__'
const num = (v: any) => Number(v || 0)

export function nveRepKey(row: NewVsExistingRow): string {
  return row.is_unassigned ? NVE_UNASSIGNED_KEY : (row.sales_manager ?? NVE_UNASSIGNED_KEY)
}

function SplitBar({ newGp, existingGp, totalGp }: { newGp: number; existingGp: number; totalGp: number }) {
  const total = num(totalGp)
  if (total <= 0) {
    return <div style={{ width: 140, height: 8, background: C.line, borderRadius: 4 }} />
  }
  const newPct = (Math.max(0, num(newGp)) / total) * 100
  const existPct = (Math.max(0, num(existingGp)) / total) * 100
  return (
    <div style={{ width: 140, height: 8, display: 'flex', borderRadius: 4, overflow: 'hidden', background: C.line }}>
      {newPct > 0 ? <div style={{ width: `${newPct}%`, background: ORANGE }} /> : null}
      {existPct > 0 ? <div style={{ width: `${existPct}%`, background: NAVY }} /> : null}
    </div>
  )
}

function NveCells({ row, muted }: { row: NewVsExistingRow; muted?: boolean }) {
  return (
    <>
      <Td right muted={muted}>{nf.format(num(row.new_accounts))}</Td>
      <Td right muted={muted}>
        <span style={{ color: muted ? C.mut : ORANGE }}>{cf.format(num(row.new_gp))}</span>
      </Td>
      <Td right muted={muted}>{nf.format(num(row.existing_accounts))}</Td>
      <Td right muted={muted}>
        <span style={{ color: muted ? C.mut : NAVY }}>{cf.format(num(row.existing_gp))}</span>
      </Td>
      <Td right strong={!muted} muted={muted}>{cf.format(num(row.total_gp))}</Td>
      <Td right muted={muted}>{row.new_gp_pct != null ? `${num(row.new_gp_pct).toFixed(1)}%` : '—'}</Td>
      <Td right muted={muted}>
        <SplitBar newGp={row.new_gp} existingGp={row.existing_gp} totalGp={row.total_gp} />
      </Td>
    </>
  )
}

function NveTableRow({
  row,
  rankLabel,
  muted,
  expanded,
  onToggle,
  drillDown,
}: {
  row: NewVsExistingRow
  rankLabel: string | number
  muted?: boolean
  expanded: boolean
  onToggle: () => void
  drillDown?: ReactNode
}) {
  const managerLabel = row.is_unassigned ? 'Unassigned' : (row.sales_manager?.trim() || '—')
  return (
    <>
      <tr
        className={`sales-rep-row${expanded ? ' sales-rep-row--open' : ''}`}
        onClick={onToggle}
        style={{
          borderTop: row.is_unassigned ? `2px solid ${C.border}` : `1px solid ${C.line}`,
          cursor: 'pointer',
          opacity: muted ? 0.6 : 1,
        }}
      >
        <Td muted>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span
              aria-hidden
              style={{
                display: 'inline-block', fontSize: 11, color: C.mut, lineHeight: 1,
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            >
              ›
            </span>
            {rankLabel}
          </span>
        </Td>
        <Td strong={!muted} muted={muted}>{managerLabel}</Td>
        <NveCells row={row} muted={muted} />
      </tr>
      {expanded && drillDown ? (
        <tr>
          <td colSpan={COL_SPAN} style={{ padding: 0 }}>{drillDown}</td>
        </tr>
      ) : null}
    </>
  )
}

type Props = {
  rows: NewVsExistingRow[]
  loading: boolean
  expandedRep: string | null
  onToggleRep: (row: NewVsExistingRow) => void
  drillDownFor: (row: NewVsExistingRow) => ReactNode
}

export function NewVsExistingView({ rows, loading, expandedRep, onToggleRep, drillDownFor }: Props) {
  const ranked = useMemo(() => rows.filter((r) => !r.is_unassigned), [rows])
  const unassigned = useMemo(() => rows.find((r) => r.is_unassigned), [rows])

  const totals = useMemo(() => {
    const newGp = ranked.reduce((s, r) => s + num(r.new_gp), 0)
    const existingGp = ranked.reduce((s, r) => s + num(r.existing_gp), 0)
    const totalGp = ranked.reduce((s, r) => s + num(r.total_gp), 0)
    const hunters = ranked.filter((r) => num(r.new_accounts) > 0).length
    return {
      newGp,
      existingGp,
      pctNew: totalGp ? (newGp / totalGp) * 100 : 0,
      hunters,
    }
  }, [ranked])

  return (
    <>
      <KpiRail
        items={[
          { label: 'Total new GP', value: cf.format(totals.newGp), accent: ORANGE },
          { label: 'Total existing GP', value: cf.format(totals.existingGp), accent: NAVY },
          { label: 'Blended % new', value: `${totals.pctNew.toFixed(1)}%` },
          { label: 'Reps landing new business', value: nf.format(totals.hunters), accent: NAVY },
        ]}
      />

      <Card pad={0}>
        <div style={{ padding: '16px 18px 0' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>New vs existing GP</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 40 }} /><col /><col style={{ width: 72 }} /><col style={{ width: 88 }} />
            <col style={{ width: 88 }} /><col style={{ width: 88 }} /><col style={{ width: 88 }} />
            <col style={{ width: 64 }} /><col style={{ width: 156 }} />
          </colgroup>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Sales manager</Th>
              <Th right>New accts</Th>
              <Th right>New GP</Th>
              <Th right>Existing accts</Th>
              <Th right>Existing GP</Th>
              <Th right>Total GP</Th>
              <Th right>% new</Th>
              <Th right>Split</Th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row, i) => {
              const key = nveRepKey(row)
              return (
                <NveTableRow
                  key={key}
                  row={row}
                  rankLabel={i + 1}
                  expanded={expandedRep === key}
                  onToggle={() => onToggleRep(row)}
                  drillDown={drillDownFor(row)}
                />
              )
            })}
            {!loading && ranked.length === 0 && !unassigned && (
              <tr>
                <td colSpan={COL_SPAN} style={{ padding: '24px 12px', textAlign: 'center', color: C.mut, fontSize: 12.5 }}>
                  No sales data for this period.
                </td>
              </tr>
            )}
            {unassigned && (
              <NveTableRow
                key={NVE_UNASSIGNED_KEY}
                row={unassigned}
                rankLabel="—"
                muted
                expanded={expandedRep === NVE_UNASSIGNED_KEY}
                onToggle={() => onToggleRep(unassigned)}
                drillDown={drillDownFor(unassigned)}
              />
            )}
          </tbody>
        </table>
        <p style={{ margin: 0, padding: '12px 18px 16px', fontSize: 11.5, color: C.mut, lineHeight: 1.45 }}>
          New = account&apos;s first-ever job falls in the selected period. First-job dates come from raw shipment dates, so new-account counts are an upper bound.
        </p>
      </Card>
    </>
  )
}
