import { supabase } from '../../../../supabase'
import { addDays, todayIso } from '../homeModel'
import type { Invoice } from '../../../../types/invoice'

/** One invoice. `amount`/`due` are in the invoice currency; `*_nzd` are the ledger (NZD) values. */
export type BillInvoice = {
  invoice_no: string
  doctype: string | null
  module: string | null
  job_unique: number | null
  doc_date: string
  date_due: string
  currency: string
  fx: number
  amount: number
  amount_nzd: number
  due: number
  due_nzd: number
  gst: number
  shipment_no: string | null
  customer_ref: string | null
  origin: string | null
  destination: string | null
  mode: string | null
  direction: string | null
  party: string | null
  house_bill: string | null
}

export type InvoiceLine = { code: string | null; description: string | null; amount: number; gst_rate: number; gst: number; gst_code?: string | null }
export type InvoiceDetail = { invoice_no: string; total: number; gst: number; lines: InvoiceLine[]; itemised: boolean }

export async function fetchBilling(months = 24): Promise<BillInvoice[]> {
  const { data, error } = await supabase.rpc('portal_billing', { p_months: months })
  if (error) throw new Error('Invoices could not load. Refresh to try again.')
  return ((data ?? []) as BillInvoice[]).map((i) => ({
    ...i, fx: Number(i.fx) || 1, amount: Number(i.amount) || 0, amount_nzd: Number(i.amount_nzd) || 0,
    due: Number(i.due) || 0, due_nzd: Number(i.due_nzd) || 0, gst: Number(i.gst) || 0,
  }))
}

export async function fetchInvoiceDetail(invoiceNo: string): Promise<InvoiceDetail | null> {
  const { data, error } = await supabase.rpc('portal_invoice_detail', { p_invoice_no: invoiceNo })
  if (error) throw new Error('Charges could not load.')
  return (data ?? null) as InvoiceDetail | null
}

// ---------- model ----------
export const DOCTYPE: Record<string, string> = { FRT: 'Freight', FIN: 'Local charges', DIS: 'Duty & GST' }
export const docLabel = (d: string | null) => (d ? DOCTYPE[d] ?? d : 'Invoice')

export type Status = 'paid' | 'overdue' | 'part' | 'due'
const isPaid = (i: BillInvoice) => Math.abs(i.due_nzd) < 0.01
export function statusOf(i: BillInvoice, today = todayIso()): Status {
  if (isPaid(i)) return 'paid'
  if (i.date_due < today) return 'overdue'
  if (i.due_nzd < i.amount_nzd - 0.01) return 'part'
  return 'due'
}
export const STATUS: Record<Status, { label: string; tone: string }> = {
  paid: { label: 'Paid', tone: 'green' },
  overdue: { label: 'Overdue', tone: 'red' },
  part: { label: 'Part-paid', tone: 'amber' },
  due: { label: 'Due', tone: 'blue' },
}

export function daysLate(i: BillInvoice, today = todayIso()): number {
  return Math.round((Date.parse(`${today}T00:00:00`) - Date.parse(`${i.date_due}T00:00:00`)) / 864e5)
}

export type Tab = 'open' | 'overdue' | 'paid' | 'all'
export function inTab(i: BillInvoice, t: Tab, today = todayIso()): boolean {
  const s = statusOf(i, today)
  return t === 'all' || (t === 'paid' ? s === 'paid' : t === 'overdue' ? s === 'overdue' : s !== 'paid')
}

/** Per-currency sums, largest first: what the customer actually has to pay, in each currency. */
export function byCurrency(rows: BillInvoice[], pick: (i: BillInvoice) => number): { currency: string; amount: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.currency, (m.get(r.currency) ?? 0) + pick(r))
  return [...m].filter(([, v]) => Math.abs(v) >= 0.01).map(([currency, amount]) => ({ currency, amount })).sort((a, b) => b.amount - a.amount)
}

export const AGING = [
  { key: 'current', label: 'Not yet due', tone: '#2563EB' },
  { key: 'd30', label: '1–30 days', tone: '#D97706' },
  { key: 'd60', label: '31–60 days', tone: '#EA580C' },
  { key: 'd90', label: '61–90 days', tone: '#DC2626' },
  { key: 'd90p', label: '90+ days', tone: '#991B1B' },
] as const
export type AgingKey = (typeof AGING)[number]['key']

/** Open balance by days past due, in NZD so buckets add up across currencies. */
export function aging(rows: BillInvoice[], today = todayIso()): Record<AgingKey, number> {
  const out: Record<AgingKey, number> = { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 }
  for (const r of rows) {
    if (isPaid(r)) continue
    const d = daysLate(r, today)
    const k: AgingKey = d <= 0 ? 'current' : d <= 30 ? 'd30' : d <= 60 ? 'd60' : d <= 90 ? 'd90' : 'd90p'
    out[k] += r.due_nzd
  }
  return out
}

export function summary(rows: BillInvoice[], today = todayIso()) {
  const open = rows.filter((r) => !isPaid(r))
  const overdue = open.filter((r) => r.date_due < today)
  const soon = open.filter((r) => r.date_due >= today && r.date_due <= addDays(today, 14))
  const yearAgo = addDays(today, -365)
  const billed = rows.filter((r) => r.doc_date >= yearAgo)
  return {
    openCount: open.length,
    openNzd: open.reduce((n, r) => n + r.due_nzd, 0),
    openByCur: byCurrency(open, (r) => r.due),
    overdueCount: overdue.length,
    overdueNzd: overdue.reduce((n, r) => n + r.due_nzd, 0),
    oldestLate: overdue.reduce((n, r) => Math.max(n, daysLate(r, today)), 0),
    soonCount: soon.length,
    soonNzd: soon.reduce((n, r) => n + r.due_nzd, 0),
    nextDue: open.filter((r) => r.date_due >= today).map((r) => r.date_due).sort()[0] ?? null,
    billedNzd: billed.reduce((n, r) => n + r.amount_nzd, 0),
    billedCount: billed.length,
  }
}

export function searchText(i: BillInvoice): string {
  return [i.invoice_no, i.shipment_no, i.customer_ref, i.house_bill, i.party, docLabel(i.doctype), i.origin, i.destination, i.currency]
    .filter(Boolean).join(' ').toLowerCase()
}

export function money2(n: number, currency = 'NZD'): string {
  try {
    return new Intl.NumberFormat('en-NZ', { style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(n).replace(/ /g, ' ')
  } catch {
    return `${currency} ${n.toFixed(2)}`
  }
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: BillInvoice[], today = todayIso()): string {
  const head = ['Invoice', 'Type', 'Shipment', 'Your ref', 'Supplier / consignee', 'Invoice date', 'Due date', 'Currency', 'Amount', 'GST', 'Balance', 'Status', 'NZD balance']
  const body = rows.map((r) => [r.invoice_no, docLabel(r.doctype), r.shipment_no, r.customer_ref, r.party, r.doc_date, r.date_due, r.currency,
    r.amount.toFixed(2), r.gst.toFixed(2), r.due.toFixed(2), STATUS[statusOf(r, today)].label, r.due_nzd.toFixed(2)])
  return [head, ...body].map((l) => l.map(csvCell).join(',')).join('\n')
}

export function download(name: string, blob: Blob): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** Shipment-page invoice row to the billing shape, so the same drawer can open from a shipment. */
export function toBillInvoice(i: Invoice, ship: { shipment_no?: string | null; customer_ref?: string | null; origin?: string | null; destination?: string | null } = {}): BillInvoice {
  const amountNzd = Number(i.amt_local) || 0
  const amount = Number(i.amt_foreign ?? i.amt_local) || 0
  const fx = amountNzd ? amount / amountNzd : 1
  const docDate = i.doc_date ?? todayIso()
  return {
    invoice_no: i.invoice_no, doctype: i.doctype, module: i.module, job_unique: i.job_unique,
    doc_date: docDate, date_due: i.date_due ?? addDays(docDate, 30), currency: i.currency ?? 'NZD', fx,
    amount, amount_nzd: amountNzd, due: Number(i.amount_due ?? i.balance) || 0, due_nzd: Number(i.balance) || 0,
    gst: Math.round((Number(i.tax_amount) || 0) * fx * 100) / 100,
    shipment_no: ship.shipment_no ?? null, customer_ref: ship.customer_ref ?? null, origin: ship.origin ?? null,
    destination: ship.destination ?? null, mode: null, direction: null, party: null, house_bill: null,
  }
}
