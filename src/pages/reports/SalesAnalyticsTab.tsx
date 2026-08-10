import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/supabase'
import { usePorts } from '@/hooks/usePorts'
import { NAVY, ORANGE, C, FONT, cf, nf, Card, KpiRail, Th, Td, Seg } from './reportsUi'
import { RepDrillDown, type AccountRow, type DrillView, type MixRow } from './salesAnalyticsRepDrillDown'
import { NewVsExistingView, type NewVsExistingRow, nveRepKey } from './salesAnalyticsNewVsExisting'
import { NveDetailDrillDown, type NveDetailRow, type NveSide } from './salesAnalyticsNveDrillDown'
import SalesExportModal, { type SalesExportOptions } from './sales/SalesExportModal'
import { buildSalesReportData } from './sales/salesExportApi'

type LeaderboardRow = {
  sales_manager: string | null
  is_unassigned: boolean
  accounts: number
  jobs: number
  revenue: number
  gross_profit: number
  margin: number | null
  avg_gp_job: number | null
  prev_revenue: number | null
  prev_gross_profit: number | null
  prev_margin: number | null
}

const PERIODS = [
  { k: '3m', label: '3M' },
  { k: '6m', label: '6M' },
  { k: '12m', label: '12M' },
] as const
type Period = (typeof PERIODS)[number]['k']

const TOP_VIEWS = [
  { k: 'leaderboard', label: 'Leaderboard' },
  { k: 'newVsExisting', label: 'New vs Existing' },
] as const
type TopView = (typeof TOP_VIEWS)[number]['k']

const COL_SPAN = 9
const UNASSIGNED_KEY = '__unassigned__'

const num = (v: any) => Number(v || 0)
const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate())

function rangeFor(k: Period): { from: string; to: string } {
  const today = new Date()
  const months = k === '3m' ? -3 : k === '6m' ? -6 : -12
  return { from: isoDate(addMonths(today, months)), to: isoDate(today) }
}

function repKey(row: LeaderboardRow): string {
  return row.is_unassigned ? UNASSIGNED_KEY : (row.sales_manager ?? UNASSIGNED_KEY)
}

function gpGrowth(gp: number, prev: number | null): { text: string; color?: string } {
  if (prev == null || prev === 0) return { text: '—' }
  const pct = ((gp - prev) / prev) * 100
  return {
    text: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`,
    color: pct >= 0 ? C.green : C.red,
  }
}

function MetricCells({ row, muted }: { row: LeaderboardRow; muted?: boolean }) {
  const growth = gpGrowth(num(row.gross_profit), row.prev_gross_profit)
  return (
    <>
      <Td right muted={muted}>{nf.format(num(row.accounts))}</Td>
      <Td right muted={muted}>{nf.format(num(row.jobs))}</Td>
      <Td right strong={!muted} muted={muted}>{cf.format(num(row.revenue))}</Td>
      <Td right muted={muted}>
        <span style={{ color: muted ? C.mut : ORANGE }}>{cf.format(num(row.gross_profit))}</span>
      </Td>
      <Td right muted={muted}>{row.margin != null ? `${num(row.margin).toFixed(1)}%` : '—'}</Td>
      <Td right muted={muted}>{row.avg_gp_job != null ? cf.format(num(row.avg_gp_job)) : '—'}</Td>
      <Td right muted={muted}>
        <span style={{ color: growth.color ?? C.mut, fontWeight: growth.color ? 600 : undefined }}>{growth.text}</span>
      </Td>
    </>
  )
}

function RepRow({
  row,
  rankLabel,
  muted,
  expanded,
  onToggle,
  drillDown,
}: {
  row: LeaderboardRow
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
        <MetricCells row={row} muted={muted} />
      </tr>
      {expanded && drillDown ? (
        <tr>
          <td colSpan={COL_SPAN} style={{ padding: 0 }}>{drillDown}</td>
        </tr>
      ) : null}
    </>
  )
}

export default function SalesAnalyticsTab() {
  const [topView, setTopView] = useState<TopView>('leaderboard')
  const [period, setPeriod] = useState<Period>('12m')
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [nveRows, setNveRows] = useState<NewVsExistingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [nveLoading, setNveLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [nveErr, setNveErr] = useState<string | null>(null)
  const [expandedRep, setExpandedRep] = useState<string | null>(null)
  const [accountCache, setAccountCache] = useState<Record<string, AccountRow[]>>({})
  const [mixCache, setMixCache] = useState<Record<string, MixRow[]>>({})
  const [fetchingAccounts, setFetchingAccounts] = useState<string | null>(null)
  const [fetchingMix, setFetchingMix] = useState<string | null>(null)
  const [showAllAccounts, setShowAllAccounts] = useState<Record<string, boolean>>({})
  const [drillView, setDrillView] = useState<Record<string, DrillView>>({})
  const [nveExpandedRep, setNveExpandedRep] = useState<string | null>(null)
  const [nveDetailCache, setNveDetailCache] = useState<Record<string, NveDetailRow[]>>({})
  const [nveFetchingDetail, setNveFetchingDetail] = useState<string | null>(null)
  const [nveDetailSide, setNveDetailSide] = useState<Record<string, NveSide>>({})
  const [nveShowAllCustomers, setNveShowAllCustomers] = useState<Record<string, boolean>>({})
  const [exportOpen, setExportOpen] = useState(false)

  const { ports } = usePorts()
  const { from, to } = useMemo(() => rangeFor(period), [period])

  useEffect(() => {
    setExpandedRep(null)
    setAccountCache({})
    setMixCache({})
    setFetchingAccounts(null)
    setFetchingMix(null)
    setShowAllAccounts({})
    setDrillView({})
    setNveExpandedRep(null)
    setNveDetailCache({})
    setNveFetchingDetail(null)
    setNveDetailSide({})
    setNveShowAllCustomers({})
  }, [period])

  useEffect(() => {
    if (topView === 'newVsExisting') setExpandedRep(null)
    if (topView === 'leaderboard') {
      setNveExpandedRep(null)
      setNveDetailCache({})
      setNveFetchingDetail(null)
      setNveDetailSide({})
      setNveShowAllCustomers({})
    }
  }, [topView])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      const { data, error } = await supabase.rpc('report_sales_leaderboard', { p_from: from, p_to: to })
      if (cancelled) return
      if (error) {
        setErr(error.message)
        setRows([])
      } else {
        setRows((data ?? []) as LeaderboardRow[])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [from, to])

  useEffect(() => {
    if (topView !== 'newVsExisting') return
    let cancelled = false
    ;(async () => {
      setNveLoading(true)
      setNveErr(null)
      const { data, error } = await supabase.rpc('report_sales_new_vs_existing', { p_from: from, p_to: to })
      if (cancelled) return
      if (error) {
        setNveErr(error.message)
        setNveRows([])
      } else {
        setNveRows((data ?? []) as NewVsExistingRow[])
      }
      setNveLoading(false)
    })()
    return () => { cancelled = true }
  }, [topView, from, to])

  const ranked = useMemo(() => rows.filter((r) => !r.is_unassigned), [rows])
  const unassigned = useMemo(() => rows.find((r) => r.is_unassigned), [rows])
  const reps = useMemo(
    () => [...new Set(ranked.map((r) => r.sales_manager?.trim()).filter((s): s is string => Boolean(s)))].sort(),
    [ranked],
  )

  const totals = useMemo(() => {
    const rev = ranked.reduce((s, r) => s + num(r.revenue), 0)
    const gp = ranked.reduce((s, r) => s + num(r.gross_profit), 0)
    return { rev, gp, margin: rev ? (gp / rev) * 100 : 0, reps: ranked.length }
  }, [ranked])

  async function loadAccounts(key: string, p_rep: string | null) {
    if (accountCache[key]) return
    setFetchingAccounts(key)
    const { data, error } = await supabase.rpc('report_sales_rep_accounts', {
      p_rep: p_rep,
      p_from: from,
      p_to: to,
    })
    if (!error) {
      setAccountCache((prev) => ({ ...prev, [key]: (data ?? []) as AccountRow[] }))
    }
    setFetchingAccounts((cur) => (cur === key ? null : cur))
  }

  async function loadMix(key: string, p_rep: string | null) {
    if (mixCache[key]) return
    setFetchingMix(key)
    const { data, error } = await supabase.rpc('report_sales_rep_mix', {
      p_rep: p_rep,
      p_from: from,
      p_to: to,
    })
    if (!error) {
      setMixCache((prev) => ({ ...prev, [key]: (data ?? []) as MixRow[] }))
    }
    setFetchingMix((cur) => (cur === key ? null : cur))
  }

  function toggleRep(row: LeaderboardRow) {
    const key = repKey(row)
    if (expandedRep === key) {
      setExpandedRep(null)
      return
    }
    setExpandedRep(key)
    void loadAccounts(key, row.is_unassigned ? null : row.sales_manager)
  }

  function setViewFor(key: string, view: DrillView, row: LeaderboardRow) {
    setDrillView((prev) => ({ ...prev, [key]: view }))
    if (view === 'mix') {
      void loadMix(key, row.is_unassigned ? null : row.sales_manager)
    }
  }

  function drillDownFor(row: LeaderboardRow) {
    const key = repKey(row)
    const view = drillView[key] ?? 'accounts'
    return (
      <RepDrillDown
        view={view}
        onViewChange={(v) => setViewFor(key, v, row)}
        accounts={accountCache[key] ?? []}
        accountsLoading={fetchingAccounts === key && !accountCache[key]}
        showAll={Boolean(showAllAccounts[key])}
        onToggleShowAll={() => setShowAllAccounts((prev) => ({ ...prev, [key]: !prev[key] }))}
        mixRows={mixCache[key] ?? []}
        mixLoading={fetchingMix === key && !mixCache[key]}
        ports={ports}
      />
    )
  }

  async function loadNveDetail(key: string, p_rep: string | null) {
    if (nveDetailCache[key]) return
    setNveFetchingDetail(key)
    const { data, error } = await supabase.rpc('report_sales_new_vs_existing_detail', {
      p_rep: p_rep,
      p_from: from,
      p_to: to,
    })
    if (!error) {
      setNveDetailCache((prev) => ({ ...prev, [key]: (data ?? []) as NveDetailRow[] }))
    }
    setNveFetchingDetail((cur) => (cur === key ? null : cur))
  }

  function toggleNveRep(row: NewVsExistingRow) {
    const key = nveRepKey(row)
    if (nveExpandedRep === key) {
      setNveExpandedRep(null)
      return
    }
    setNveExpandedRep(key)
    void loadNveDetail(key, row.is_unassigned ? null : row.sales_manager)
  }

  function nveDrillDownFor(row: NewVsExistingRow) {
    const key = nveRepKey(row)
    const side = nveDetailSide[key] ?? 'new'
    return (
      <NveDetailDrillDown
        rows={nveDetailCache[key] ?? []}
        loading={nveFetchingDetail === key && !nveDetailCache[key]}
        side={side}
        onSideChange={(s) => setNveDetailSide((prev) => ({ ...prev, [key]: s }))}
        showAll={Boolean(nveShowAllCustomers[key])}
        onToggleShowAll={() => setNveShowAllCustomers((prev) => ({ ...prev, [key]: !prev[key] }))}
        ports={ports}
      />
    )
  }

  async function handleExport(opts: SalesExportOptions) {
    try {
      const data = await buildSalesReportData(opts)
      const { pdf } = await import('@react-pdf/renderer')
      const { default: SalesReportPdf } = await import('./sales/pdf/SalesReportPdf')
      const blob = await pdf(<SalesReportPdf data={data} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `UBF_Sales_Review_${data.meta.periodSlug}.pdf`,
      })
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF export failed')
    }
  }

  return (
    <div style={{ fontFamily: FONT, color: C.ink, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&display=swap');
        @keyframes sales-analytics-spin { to { transform: rotate(360deg); } }
        .sales-rep-row:hover { background: ${C.chip}; }
        .sales-rep-row--open { background: ${C.navySoft}; }
        .sales-rep-row--open:hover { background: ${C.navySoft}; }
      `}</style>

      <Card style={{ position: 'relative', zIndex: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div className="inline-flex w-fit self-start">
              <Seg options={TOP_VIEWS as any} value={topView} onChange={(k) => setTopView(k as TopView)} />
            </div>
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              style={{
                border: `1px solid ${C.border}`, borderRadius: 9, padding: '6px 14px', fontSize: 12,
                fontWeight: 600, cursor: 'pointer', background: '#fff', color: NAVY,
              }}
            >
              Export PDF
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <Seg options={PERIODS as any} value={period} onChange={(k) => setPeriod(k as Period)} />
            {(topView === 'leaderboard' ? loading : nveLoading) && (
              <span style={{ fontSize: 12, color: C.mut }}>Loading…</span>
            )}
          </div>
        </div>
      </Card>

      {topView === 'leaderboard' && err && <Card style={{ color: C.red, fontSize: 13 }}>Failed to load report: {err}</Card>}
      {topView === 'newVsExisting' && nveErr && <Card style={{ color: C.red, fontSize: 13 }}>Failed to load report: {nveErr}</Card>}

      {topView === 'leaderboard' ? (
        <>
      <KpiRail
        items={[
          { label: 'Total revenue', value: cf.format(totals.rev), accent: NAVY },
          { label: 'Total gross profit', value: cf.format(totals.gp), accent: ORANGE },
          { label: 'Blended margin', value: `${totals.margin.toFixed(1)}%` },
          { label: 'Active reps', value: nf.format(totals.reps), accent: NAVY },
        ]}
      />

      <Card pad={0}>
        <div style={{ padding: '16px 18px 0' }}><span style={{ fontSize: 14, fontWeight: 600 }}>Sales leaderboard</span></div>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 40 }} /><col /><col style={{ width: 72 }} /><col style={{ width: 56 }} />
            <col style={{ width: 96 }} /><col style={{ width: 96 }} /><col style={{ width: 64 }} />
            <col style={{ width: 96 }} /><col style={{ width: 88 }} />
          </colgroup>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Sales manager</Th>
              <Th right>Accounts</Th>
              <Th right>Jobs</Th>
              <Th right>Revenue</Th>
              <Th right>Gross profit</Th>
              <Th right>GM %</Th>
              <Th right>Avg GP/job</Th>
              <Th right>vs prior</Th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row, i) => {
              const key = repKey(row)
              return (
                <RepRow
                  key={key}
                  row={row}
                  rankLabel={i + 1}
                  expanded={expandedRep === key}
                  onToggle={() => toggleRep(row)}
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
              <RepRow
                key={UNASSIGNED_KEY}
                row={unassigned}
                rankLabel="—"
                muted
                expanded={expandedRep === UNASSIGNED_KEY}
                onToggle={() => toggleRep(unassigned)}
                drillDown={drillDownFor(unassigned)}
              />
            )}
          </tbody>
        </table>
        <p style={{ margin: 0, padding: '12px 18px 16px', fontSize: 11.5, color: C.mut, lineHeight: 1.45 }}>
          Gross profit on recent jobs firms up as supplier costs post, so current-period margins may read high versus prior periods.
        </p>
      </Card>
        </>
      ) : (
        <NewVsExistingView
          rows={nveRows}
          loading={nveLoading}
          expandedRep={nveExpandedRep}
          onToggleRep={toggleNveRep}
          drillDownFor={nveDrillDownFor}
        />
      )}
      <SalesExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        currentPeriod={period}
        reps={reps}
        onGenerate={handleExport}
      />
    </div>
  )
}
