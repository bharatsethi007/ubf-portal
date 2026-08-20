import type { CSSProperties } from 'react'
import { BadgeCheck } from 'lucide-react'
import type { AgentReciprocityRow } from './agentReciprocityApi'
import { BLUE, C, Td, cf, nf } from './reportsUi'

export type SortKey =
  | 'name'
  | 'imp_jobs'
  | 'exp_jobs'
  | 'balance'
  | 'imp_revenue'
  | 'exp_revenue'
  | 'gp'
  | 'total_jobs'

export type SortDir = 'asc' | 'desc'

export const DEFAULT_SORT: { key: SortKey; dir: SortDir } = { key: 'total_jobs', dir: 'desc' }

const pillStyle: CSSProperties = {
  display: 'inline-block',
  fontSize: 10,
  fontWeight: 600,
  padding: '2px 6px',
  borderRadius: 6,
  background: C.chip,
  color: C.ink2,
  lineHeight: 1.3,
}

function parseNetworks(raw: string | null): string[] {
  if (!raw?.trim()) return []
  return raw.split(/[,;|/]+/).map((s) => s.trim()).filter(Boolean)
}

function gpTotal(row: AgentReciprocityRow): number {
  return row.imp_gp + row.exp_gp
}

export function sortRows(rows: AgentReciprocityRow[], key: SortKey, dir: SortDir): AgentReciprocityRow[] {
  const mul = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (key === 'name') {
      return mul * (a.name || a.code).localeCompare(b.name || b.code, undefined, { sensitivity: 'base' })
    }
    if (key === 'gp') return mul * (gpTotal(a) - gpTotal(b))
    return mul * ((a[key] as number) - (b[key] as number))
  })
}

function balanceColor(balance: number): string {
  if (balance <= -5) return C.red
  if (balance >= 5) return C.green
  return C.ink
}

export function SortTh({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  right,
}: {
  label: string
  column: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  right?: boolean
}) {
  const active = sortKey === column
  const arrow = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
  return (
    <th
      style={{
        textAlign: right ? 'right' : 'left',
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        color: active ? C.ink : C.mut,
        padding: '14px 12px 10px',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={() => onSort(column)}
    >
      {label}{arrow}
    </th>
  )
}

function NameCell({ row }: { row: AgentReciprocityRow }) {
  const networks = parseNetworks(row.networks)
  return (
    <Td strong>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name || row.code}</span>
          {row.trusted && (
            <span title="Trusted agent" style={{ color: BLUE, display: 'inline-flex', flexShrink: 0 }}>
              <BadgeCheck size={15} strokeWidth={2.2} />
            </span>
          )}
        </div>
        {networks.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {networks.map((code) => (
              <span key={code} style={pillStyle}>{code}</span>
            ))}
          </div>
        )}
        {row.country && (
          <span style={{ fontSize: 11, color: C.mut, fontWeight: 450 }}>{row.country}</span>
        )}
      </div>
    </Td>
  )
}

function JobsCell({ total, sea, air }: { total: number; sea: number; air: number }) {
  return (
    <Td right strong>
      <div>{nf.format(total)}</div>
      <div style={{ fontSize: 10.5, color: C.mut, fontWeight: 450, marginTop: 2 }}>
        sea {nf.format(sea)} · air {nf.format(air)}
      </div>
    </Td>
  )
}

export function AgentReciprocityTable({
  rows,
  loading,
  sortKey,
  sortDir,
  onSort,
}: {
  rows: AgentReciprocityRow[]
  loading: boolean
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
}) {
  function toggleSort(key: SortKey) {
    onSort(key)
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <colgroup>
        <col /><col style={{ width: 88 }} /><col style={{ width: 88 }} /><col style={{ width: 72 }} />
        <col style={{ width: 96 }} /><col style={{ width: 96 }} /><col style={{ width: 88 }} />
      </colgroup>
      <thead>
        <tr>
          <SortTh label="Name" column="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
          <SortTh label="Import jobs" column="imp_jobs" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} right />
          <SortTh label="Export jobs" column="exp_jobs" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} right />
          <SortTh label="Balance" column="balance" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} right />
          <SortTh label="Import rev" column="imp_revenue" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} right />
          <SortTh label="Export rev" column="exp_revenue" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} right />
          <SortTh label="GP" column="gp" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} right />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.code} style={{ borderTop: `1px solid ${C.line}` }}>
            <NameCell row={row} />
            <JobsCell total={row.imp_jobs} sea={row.imp_sea} air={row.imp_air} />
            <JobsCell total={row.exp_jobs} sea={row.exp_sea} air={row.exp_air} />
            <Td right strong>
              <span style={{ color: balanceColor(row.balance) }}>
                {row.balance > 0 ? '+' : ''}{nf.format(row.balance)}
              </span>
            </Td>
            <Td right>{cf.format(row.imp_revenue)}</Td>
            <Td right>{cf.format(row.exp_revenue)}</Td>
            <Td right strong>{cf.format(gpTotal(row))}</Td>
          </tr>
        ))}
        {!loading && rows.length === 0 && (
          <tr>
            <td colSpan={7} style={{ padding: '24px 12px', textAlign: 'center', color: C.mut, fontSize: 12.5 }}>
              No agents in this band.
            </td>
          </tr>
        )}
        {loading && (
          <tr>
            <td colSpan={7} style={{ padding: '24px 12px', textAlign: 'center', color: C.mut, fontSize: 12.5 }}>
              Loading…
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
