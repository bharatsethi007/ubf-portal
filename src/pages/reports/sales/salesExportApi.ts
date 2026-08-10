import { supabase } from '@/supabase'
import type { NewVsExistingRow } from '../salesAnalyticsNewVsExisting'
import { fetchTradeLanes, fetchVolumeTrend, type TradeLane } from '../reportsApi'
import type { SalesExportOptions } from './SalesExportModal'

export type LeaderboardRow = {
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

export type AccountRow = {
  customer_account_id: string
  customer_name: string | null
  jobs: number
  revenue: number
  gross_profit: number
  open_balance: number
}

export type LaneRow = TradeLane

export type TrendPoint = { month: string; jobs: number }

export type ModeSlice = { label: string; jobs: number }

type Period = SalesExportOptions['period']

export type SalesReportData = {
  meta: {
    periodLabel: '3M' | '6M' | '12M'
    preparedFor: string
    generatedAt: Date
    periodSlug: Period
    scoped: boolean
    scopedRep: string | null
  }
  kpis: { revenue: number; grossProfit: number; blendedMargin: number; activeReps: number }
  leaderboard: LeaderboardRow[]
  newVsExisting?: NewVsExistingRow[]
  accounts?: AccountRow[]
  accountsTotal?: number
  lanes?: LaneRow[]
  volumeTrend?: TrendPoint[]
  modeMix?: ModeSlice[]
  sections: {
    leaderboard: boolean
    newVsExisting: boolean
    topAccounts: boolean
    tradeLanes: boolean
  }
}

const PERIOD_LABELS: Record<Period, '3M' | '6M' | '12M'> = {
  '3m': '3M',
  '6m': '6M',
  '12m': '12M',
}

const num = (v: unknown) => Number(v || 0)
const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate())

function rangeFor(k: Period): { from: string; to: string } {
  const today = new Date()
  const months = k === '3m' ? -3 : k === '6m' ? -6 : -12
  return { from: isoDate(addMonths(today, months)), to: isoDate(today) }
}

function titleCaseMode(mode: string): string {
  if (!mode) return 'Other'
  return mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase()
}

function computeKpis(rows: LeaderboardRow[]) {
  const assigned = rows.filter((r) => !r.is_unassigned)
  const revenue = assigned.reduce((s, r) => s + num(r.revenue), 0)
  const grossProfit = assigned.reduce((s, r) => s + num(r.gross_profit), 0)
  const blendedMargin = revenue ? (grossProfit / revenue) * 100 : 0
  const activeReps = assigned.filter((r) => num(r.jobs) > 0).length
  return { revenue, grossProfit, blendedMargin, activeReps }
}

function sortLeaderboard(rows: LeaderboardRow[]): LeaderboardRow[] {
  const assigned = rows
    .filter((r) => !r.is_unassigned)
    .sort((a, b) => num(b.gross_profit) - num(a.gross_profit))
  const unassigned = rows.filter((r) => r.is_unassigned)
  return [...assigned, ...unassigned]
}

function filterLeaderboardByRep(rows: LeaderboardRow[], rep: string): LeaderboardRow[] {
  return rows.filter((r) => !r.is_unassigned && r.sales_manager?.trim() === rep)
}

function filterNveByRep(rows: NewVsExistingRow[], rep: string): NewVsExistingRow[] {
  return rows.filter((r) => !r.is_unassigned && r.sales_manager?.trim() === rep)
}

function aggregateVolumeTrend(points: Awaited<ReturnType<typeof fetchVolumeTrend>>): TrendPoint[] {
  const byMonth = new Map<string, number>()
  for (const p of points) {
    byMonth.set(p.month, (byMonth.get(p.month) ?? 0) + num(p.jobs))
  }
  return [...byMonth.entries()]
    .map(([month, jobs]) => ({ month, jobs }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

function aggregateModeMix(points: Awaited<ReturnType<typeof fetchVolumeTrend>>): ModeSlice[] {
  const byMode = new Map<string, number>()
  for (const p of points) {
    const label = titleCaseMode(p.mode)
    byMode.set(label, (byMode.get(label) ?? 0) + num(p.jobs))
  }
  return [...byMode.entries()]
    .map(([label, jobs]) => ({ label, jobs }))
    .sort((a, b) => b.jobs - a.jobs)
}

export async function buildSalesReportData(opts: SalesExportOptions): Promise<SalesReportData> {
  const { from, to } = rangeFor(opts.period)
  const scoped = opts.repScope !== 'all'

  const { data: lbData, error: lbError } = await supabase.rpc('report_sales_leaderboard', { p_from: from, p_to: to })
  if (lbError) throw lbError

  let leaderboard = sortLeaderboard((lbData ?? []) as LeaderboardRow[])
  const rawLeaderboard = (lbData ?? []) as LeaderboardRow[]
  let newVsExisting: NewVsExistingRow[] | undefined
  let accounts: AccountRow[] | undefined
  let accountsTotal: number | undefined
  let lanes: LaneRow[] | undefined
  let volumeTrend: TrendPoint[] | undefined
  let modeMix: ModeSlice[] | undefined

  if (opts.sections.newVsExisting) {
    const { data: nveData, error: nveError } = await supabase.rpc('report_sales_new_vs_existing', { p_from: from, p_to: to })
    if (nveError) throw nveError
    newVsExisting = (nveData ?? []) as NewVsExistingRow[]
  }

  if (!scoped && opts.sections.topAccounts) {
    const { data: acctData, error: acctError } = await supabase.rpc('report_cust_list', {
      p_from: from,
      p_to: to,
      p_direction: null,
      p_mode: null,
    })
    if (acctError) throw acctError
    const sorted = ((acctData ?? []) as AccountRow[]).sort((a, b) => num(b.revenue) - num(a.revenue))
    accountsTotal = sorted.length
    accounts = opts.accountLimit === 'all' ? sorted : sorted.slice(0, opts.accountLimit)
  }

  if (!scoped && opts.sections.tradeLanes) {
    const [allLanes, volumeRaw] = await Promise.all([
      fetchTradeLanes(from, to, null, null, 200),
      fetchVolumeTrend(from, to),
    ])
    lanes = [...allLanes].sort((a, b) => num(b.jobs) - num(a.jobs)).slice(0, 15)
    volumeTrend = aggregateVolumeTrend(volumeRaw)
    modeMix = aggregateModeMix(volumeRaw)
  }

  if (scoped) {
    leaderboard = filterLeaderboardByRep(leaderboard, opts.repScope)
    if (newVsExisting) newVsExisting = filterNveByRep(newVsExisting, opts.repScope)
  }

  return {
    meta: {
      periodLabel: PERIOD_LABELS[opts.period],
      preparedFor: opts.preparedFor,
      generatedAt: new Date(),
      periodSlug: opts.period,
      scoped,
      scopedRep: scoped ? opts.repScope : null,
    },
    kpis: computeKpis(scoped ? leaderboard : rawLeaderboard),
    leaderboard,
    sections: opts.sections,
    ...(newVsExisting ? { newVsExisting } : {}),
    ...(accounts ? { accounts, accountsTotal } : {}),
    ...(lanes ? { lanes, volumeTrend, modeMix } : {}),
  }
}
