import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  fetchAgentReciprocity,
  RECIPROCITY_BANDS,
  type AgentReciprocityRow,
  type ReciprocityTabBand,
} from './agentReciprocityApi'
import {
  AgentReciprocityTable,
  DEFAULT_SORT,
  sortRows,
  type SortDir,
  type SortKey,
} from './agentReciprocityColumns'
import { C, Card, FONT, KpiRail, NAVY, ORANGE, cf, nf } from './reportsUi'

const SECTIONS: { band: ReciprocityTabBand; title: string; defaultOpen: boolean }[] = [
  { band: 'third_party', title: 'Third-party agents', defaultOpen: true },
  { band: 'own_office', title: 'Own overseas offices', defaultOpen: false },
  { band: 'self', title: 'Self / house', defaultOpen: false },
]

function sum(rows: AgentReciprocityRow[], pick: (r: AgentReciprocityRow) => number): number {
  return rows.reduce((s, r) => s + pick(r), 0)
}

function BandSection({
  title,
  rows,
  loading,
  open,
  onToggle,
  sortKey,
  sortDir,
  onSort,
}: {
  title: string
  rows: AgentReciprocityRow[]
  loading: boolean
  open: boolean
  onToggle: () => void
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
}) {
  return (
    <Card pad={0}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '16px 18px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: FONT,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{title}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.mut }}>
          {nf.format(rows.length)} agents
          <ChevronDown
            size={16}
            style={{ transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </span>
      </button>
      {open && (
        <AgentReciprocityTable
          rows={rows}
          loading={loading}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
        />
      )}
    </Card>
  )
}

export default function AgentReciprocityTab() {
  const [rows, setRows] = useState<AgentReciprocityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [openBands, setOpenBands] = useState<Record<ReciprocityTabBand, boolean>>({
    third_party: true,
    own_office: false,
    self: false,
  })
  const [sort, setSort] = useState(DEFAULT_SORT)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchAgentReciprocity()
        if (!cancelled) setRows(data)
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Failed to load agent reciprocity')
          setRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const byBand = useMemo(() => {
    const map: Record<ReciprocityTabBand, AgentReciprocityRow[]> = {
      third_party: [],
      own_office: [],
      self: [],
    }
    for (const row of rows) {
      if (RECIPROCITY_BANDS.includes(row.band as ReciprocityTabBand)) {
        map[row.band as ReciprocityTabBand].push(row)
      }
    }
    for (const band of RECIPROCITY_BANDS) {
      map[band] = sortRows(map[band], sort.key, sort.dir)
    }
    return map
  }, [rows, sort])

  const thirdParty = byBand.third_party

  const kpis = useMemo(() => {
    const impJobs = sum(thirdParty, (r) => r.imp_jobs)
    const expJobs = sum(thirdParty, (r) => r.exp_jobs)
    const impRev = sum(thirdParty, (r) => r.imp_revenue)
    const expRev = sum(thirdParty, (r) => r.exp_revenue)
    return { impJobs, expJobs, impRev, expRev, net: expJobs - impJobs }
  }, [thirdParty])

  function handleSort(key: SortKey) {
    setSort((prev) => (
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' }
    ))
  }

  return (
    <div style={{ fontFamily: FONT, color: C.ink, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {err && <Card style={{ color: C.red, fontSize: 13 }}>Failed to load report: {err}</Card>}

      <KpiRail
        items={[
          {
            label: 'Import jobs',
            value: nf.format(kpis.impJobs),
            accent: NAVY,
            sub: 'Third-party agents only',
          },
          {
            label: 'Export jobs',
            value: nf.format(kpis.expJobs),
            accent: NAVY,
            sub: 'Third-party agents only',
          },
          { label: 'Import revenue', value: cf.format(kpis.impRev) },
          { label: 'Export revenue', value: cf.format(kpis.expRev) },
          {
            label: 'Net reciprocity',
            value: `${kpis.net > 0 ? '+' : ''}${nf.format(kpis.net)} jobs`,
            accent: ORANGE,
            sub: 'Export − import jobs',
          },
        ]}
      />

      {SECTIONS.map(({ band, title, defaultOpen }) => (
        <BandSection
          key={band}
          title={title}
          rows={byBand[band]}
          loading={loading}
          open={openBands[band] ?? defaultOpen}
          onToggle={() => setOpenBands((prev) => ({ ...prev, [band]: !prev[band] }))}
          sortKey={sort.key}
          sortDir={sort.dir}
          onSort={handleSort}
        />
      ))}
    </div>
  )
}
