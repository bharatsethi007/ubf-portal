import { supabase } from '@/supabase'
import type { NewVsExistingRow } from '../salesAnalyticsNewVsExisting'
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

type Period = SalesExportOptions['period']

export type SalesReportData = {
  meta: {
    periodLabel: '3M' | '6M' | '12M'
    preparedFor: string
    generatedAt: Date
    periodSlug: Period
    scoped: boolean
  }
  kpis: { revenue: number; grossProfit: number; blendedMargin: number; activeReps: number }
  leaderboard: LeaderboardRow[]
  newVsExisting?: NewVsExistingRow[]
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

export async function buildSalesReportData(opts: SalesExportOptions): Promise<SalesReportData> {
  const { from, to } = rangeFor(opts.period)
  const scoped = opts.repScope !== 'all'

  const { data: lbData, error: lbError } = await supabase.rpc('report_sales_leaderboard', { p_from: from, p_to: to })
  if (lbError) throw lbError

  let leaderboard = sortLeaderboard((lbData ?? []) as LeaderboardRow[])
  const rawLeaderboard = (lbData ?? []) as LeaderboardRow[]
  let newVsExisting: NewVsExistingRow[] | undefined

  if (opts.sections.newVsExisting) {
    const { data: nveData, error: nveError } = await supabase.rpc('report_sales_new_vs_existing', { p_from: from, p_to: to })
    if (nveError) throw nveError
    newVsExisting = (nveData ?? []) as NewVsExistingRow[]
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
    },
    kpis: computeKpis(scoped ? leaderboard : rawLeaderboard),
    leaderboard,
    ...(newVsExisting ? { newVsExisting } : {}),
  }
}
