import { supabase } from '@/supabase'

// All finance RPCs are SECURITY DEFINER and gated by has_perm('finance','read').

export type PlRow = { month: string; pl_order: number; pl_group: string; pl_line: string; amount: number }
export type PlAccountRow = { account: string; acctname: string; month: string; amount: number }
export type BsRow = { side: string; side_order: number; bs_group: string; account: string | null; acctname: string; amount: number }
export type CfRow = { month: string; cf_section: string; cf_line: string; amount: number }
export type KpiRow = {
  month: string; revenue: number; cost_of_sales: number; gross_profit: number; other_op_income: number
  opex: number; people: number; premises: number; ebit: number; net_profit: number; cash: number
  receivables: number; payables: number; accruals: number; gst: number; duty_payable: number; related_party: number
}
export type AgingRow = {
  accountid: string; name: string | null; terms: string | null; credit_limit: number | null; is_related: boolean
  current_amt: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number; total: number
  unapplied: number; open_items: number; oldest_due: string | null
  avg_days_to_pay: number | null; avg_days_late: number | null; billed_12m: number
}
export type ForecastRow = {
  week_start: string; opening: number; ar_existing: number; ap_existing: number; new_receipts: number
  new_payments: number; payroll: number; overheads: number; tax_gst: number; other: number; net: number; closing: number
}
export type FlagRow = { severity: 'high' | 'medium' | 'low'; code: string; title: string; detail: string; amount: number | null }
export type SyncRow = { table_name: string; rows: number; synced_at: string; last_gl_date: string | null }

const N = (v: unknown) => (v == null ? 0 : Number(v))

function numify<T>(rows: unknown, keys: string[]): T[] {
  return ((rows ?? []) as Record<string, unknown>[]).map((r) => {
    const o: Record<string, unknown> = { ...r }
    for (const k of keys) if (k in o && o[k] != null) o[k] = N(o[k])
    return o as T
  })
}

async function call<T>(fn: string, args: Record<string, unknown>, numKeys: string[]): Promise<T[]> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return numify<T>(data, numKeys)
}

export const fetchPl = (from: string, to: string) =>
  call<PlRow>('fin_pl_monthly', { p_from: from, p_to: to }, ['amount', 'pl_order'])

export const fetchPlAccounts = (from: string, to: string, group: string, line: string) =>
  call<PlAccountRow>('fin_pl_accounts', { p_from: from, p_to: to, p_group: group, p_line: line }, ['amount'])

export const fetchBalanceSheet = (asAt: string) =>
  call<BsRow>('fin_balance_sheet', { p_as_at: asAt }, ['amount', 'side_order'])

export const fetchCashflow = (from: string, to: string) =>
  call<CfRow>('fin_cashflow_monthly', { p_from: from, p_to: to }, ['amount'])

const KPI_KEYS = ['revenue', 'cost_of_sales', 'gross_profit', 'other_op_income', 'opex', 'people', 'premises',
  'ebit', 'net_profit', 'cash', 'receivables', 'payables', 'accruals', 'gst', 'duty_payable', 'related_party']
export const fetchKpis = (from: string, to: string) => call<KpiRow>('fin_kpi_monthly', { p_from: from, p_to: to }, KPI_KEYS)

export const fetchAging = (kind: 'D' | 'C') =>
  call<AgingRow>('fin_aging', { p_kind: kind }, ['credit_limit', 'current_amt', 'd1_30', 'd31_60', 'd61_90',
    'd90_plus', 'total', 'unapplied', 'open_items', 'avg_days_to_pay', 'avg_days_late', 'billed_12m'])

export const fetchForecast = (weeks = 13) =>
  call<ForecastRow>('fin_cash_forecast', { p_weeks: weeks }, ['opening', 'ar_existing', 'ap_existing',
    'new_receipts', 'new_payments', 'payroll', 'overheads', 'tax_gst', 'other', 'net', 'closing'])

export const fetchFlags = () => call<FlagRow>('fin_flags', {}, ['amount'])
export const fetchSync = () => call<SyncRow>('fin_sync_status', {}, ['rows'])
