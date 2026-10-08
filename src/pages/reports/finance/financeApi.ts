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

/* ---------- collections + payment matching ---------- */
export type QueueRow = {
  accountid: string; name: string | null; email: string | null; terms: string | null; credit_limit: number | null
  is_related: boolean; overdue: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number; total: number
  unapplied: number; oldest_days: number; avg_days_late: number | null; stage: 'friendly' | 'firm' | 'final'
  priority: number; last_kind: string | null; last_at: string | null; last_by: string | null
  promise_date: string | null; promise_amount: number | null; promise_broken: boolean
}
export type LedgerInvoice = { number: string; doctype: string; module: string; job_no: number | null; doc_date: string
  datedue: string | null; days_over: number; amount: number; balance: number; currency: string | null }
export type CollectionAction = { id: number; kind: string; body: string | null; promise_date: string | null
  promise_amount: number | null; invoices: string[] | null; email_to: string[] | null; at: string; by: string | null }
export type CustomerLedger = { accountid: string; name: string | null; emails: string[]; best_email: string | null
  invoices: LedgerInvoice[]; unapplied: { receipt_no: number; date: string; ref: string | null; amount: number; balance: number }[]
  actions: CollectionAction[]; mailbox: string | null }
export type MatchRow = { receipt_id: number; receipt_no: number; accountid: string; name: string | null; date1: string
  ref: string | null; amount: number; balance: number; age_days: number; rule: string; confidence: 'high' | 'medium' | 'low' | 'none'
  suggestion: string; invoices: { number: string; balance: number; accountid?: string }[]
  review_status: 'done' | 'ignore' | null; review_note: string | null }

export const fetchQueue = () => call<QueueRow>('fin_collections_queue', {}, ['credit_limit', 'overdue', 'd1_30', 'd31_60',
  'd61_90', 'd90_plus', 'total', 'unapplied', 'oldest_days', 'avg_days_late', 'priority', 'promise_amount'])

export async function fetchLedger(accountid: string): Promise<CustomerLedger> {
  const { data, error } = await supabase.rpc('fin_customer_ledger', { p_accountid: accountid })
  if (error) throw new Error(error.message)
  return data as CustomerLedger
}

export async function logAction(a: { accountid: string; kind: string; body?: string; promise_date?: string | null
  promise_amount?: number | null; invoices?: string[] }) {
  const { error } = await supabase.rpc('fin_collection_log', { p_accountid: a.accountid, p_kind: a.kind, p_body: a.body ?? null,
    p_promise_date: a.promise_date ?? null, p_promise_amount: a.promise_amount ?? null, p_invoices: a.invoices ?? null, p_email_to: null })
  if (error) throw new Error(error.message)
}

export async function sendReminder(b: { accountid: string; to: string[]; cc: string[]; subject: string; text: string; invoices: string[] }) {
  const { data, error } = await supabase.functions.invoke('collections-email-send', { body: b })
  if (error) {
    let msg = error.message
    try { msg = (await (error as { context?: Response }).context?.json())?.error ?? msg } catch { /* keep generic */ }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data as { ok: true; from: string }
}

export const fetchMatches = () => call<MatchRow>('fin_unapplied_matches', {}, ['amount', 'balance', 'age_days', 'receipt_no'])

export async function reviewMatch(receiptId: number, status: 'done' | 'ignore' | 'clear', note?: string) {
  const { error } = await supabase.rpc('fin_match_review', { p_receipt_id: receiptId, p_status: status, p_note: note ?? null })
  if (error) throw new Error(error.message)
}

/* ---------- margin leaks ---------- */
export type LeakCategory = 'not_invoiced' | 'overrun' | 'loss' | 'never_costed' | 'cost_not_billed'
export type LeakRow = { job_no: number; category: LeakCategory; module: string | null; house_bill: string | null
  ref_job: string | null; customer_id: string | null; customer: string | null; suppliers: string | null
  cost_billed: number; cost_booked: number; gap: number; revenue: number; gp: number; margin: number | null
  first_bill: string | null; last_bill: string | null; last_invoice: string | null; days_since: number | null
  review_status: string | null; review_note: string | null }

export const fetchLeaks = () => call<LeakRow>('fin_margin_leaks', {}, ['job_no', 'cost_billed', 'cost_booked', 'gap',
  'revenue', 'gp', 'margin', 'days_since'])

export async function reviewLeak(r: LeakRow, status: 'rebilled' | 'accepted' | 'fixed' | 'ignore' | 'clear', note?: string) {
  const { error } = await supabase.rpc('fin_leak_review', { p_job_no: r.job_no, p_category: r.category, p_status: status,
    p_gap: r.gap, p_note: note ?? null })
  if (error) throw new Error(error.message)
}

/* ---------- customer profitability ---------- */
export type Verdict = 'grow' | 'keep' | 'reprice' | 'tighten terms' | 'too small to serve'
export type CustProfitRow = { accountid: string; name: string | null; sales_rep: string | null; terms: string | null
  is_related: boolean; jobs: number; revenue: number; gp: number; margin: number | null; gp_per_job: number | null
  prev_revenue: number; prev_gp: number; billed: number; disb_billed: number; avg_days_to_pay: number | null
  ar_balance: number; overdue_60: number; serve_cost: number; finance_cost: number; net_contribution: number
  cost_per_job: number; verdict: Verdict }

export const fetchCustomerProfit = (from: string, to: string, rate = 0.09) =>
  call<CustProfitRow>('fin_customer_profit', { p_from: from, p_to: to, p_rate: rate }, ['jobs', 'revenue', 'gp', 'margin',
    'gp_per_job', 'prev_revenue', 'prev_gp', 'billed', 'disb_billed', 'avg_days_to_pay', 'ar_balance', 'overdue_60',
    'serve_cost', 'finance_cost', 'net_contribution', 'cost_per_job'])

/* ---------- customs duty float ---------- */
export type DutyMonth = { month: string; duty: number; recovered: number; avg_fdays: number | null; avg_hdays: number | null; jobs: number }
export type DutyCustomer = { accountid: string; name: string | null; jobs: number; duty: number; recovered: number
  avg_fdays: number | null; avg_hdays: number | null; days_to_pay: number | null; pct_before: number | null
  funding_cost: number; owe_now: number | null; funded_now: number | null }
export type DutyGap = { job_no: number; module: string | null; house_bill: string | null; accountid: string | null; name: string | null
  duty_date: string; duty: number; recovered: number; gap: number; billed: number; reason: 'duplicate' | 'not_billed' | 'short' }
export type DutyFloat = {
  now: { customs_open: number; customs_overdue: number | null; customs_stale: number | null; customs_stale_jobs: number
    next_due_date: string | null; next_due_amount: number | null; clients_owe: number | null; funded_now: number | null; funded_now_jobs: number }
  totals: { jobs: number; duty: number; recovered: number; paid_before_customs: number | null; avg_fdays: number | null
    funding_cost: number; avg_funded: number; avg_held: number; avg_hdays: number | null; held_benefit: number }
  months: DutyMonth[]; customers: DutyCustomer[]; unrecovered: DutyGap[]
}

export async function fetchDutyFloat(from: string, to: string, rate = 0.09): Promise<DutyFloat> {
  const { data, error } = await supabase.rpc('fin_duty_float', { p_from: from, p_to: to, p_rate: rate })
  if (error) throw new Error(error.message)
  return data as DutyFloat
}

/* ---------- month-end close ---------- */
export type CloseStatus = 'pass' | 'warn' | 'fail'
export type CloseCheck = { code: string; area: string; title: string; status: CloseStatus; detail: string; action?: string
  amount?: number | null; count?: number | null; view?: string
  review: { status: 'done' | 'accepted'; note: string | null; by: string | null; at: string } | null }
export type CloseList = { month: string; month_end: string; checks: CloseCheck[]
  signoff: { closed: boolean; note: string | null; by: string | null; at: string } | null }

export async function fetchClose(month: string): Promise<CloseList> {
  const { data, error } = await supabase.rpc('fin_close_checklist', { p_month: month })
  if (error) throw new Error(error.message)
  return data as CloseList
}
export async function reviewClose(month: string, code: string, status: 'open' | 'done' | 'accepted', note?: string) {
  const { error } = await supabase.rpc('fin_close_review', { p_month: month, p_code: code, p_status: status, p_note: note ?? null })
  if (error) throw new Error(error.message)
}
export async function signOffMonth(month: string, close: boolean, note?: string): Promise<CloseList> {
  const { data, error } = await supabase.rpc('fin_close_month', { p_month: month, p_close: close, p_note: note ?? null })
  if (error) throw new Error(error.message)
  return data as CloseList
}
