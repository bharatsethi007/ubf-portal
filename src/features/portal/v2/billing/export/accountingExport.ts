import { fetchInvoiceDetail, type BillInvoice, type InvoiceLine } from '../billingApi'

export type Target = 'xero' | 'myob'

/** What the customer's ledger calls things. Saved in the browser between exports. */
export type ExportSettings = {
  accountCode: string
  taxStandard: string
  taxZero: string
  supplier: string
}

export const DEFAULTS: Record<Target, ExportSettings> = {
  xero: { accountCode: '425', taxStandard: '15% GST on Expenses', taxZero: 'Zero Rated', supplier: 'UB Freight Limited' },
  myob: { accountCode: '6-1100', taxStandard: 'GST', taxZero: 'Z', supplier: 'UB Freight Limited' },
}

const KEY = (t: Target) => `ubf-portal-export-${t}`

export function loadSettings(t: Target): ExportSettings {
  try {
    const raw = window.localStorage.getItem(KEY(t))
    return raw ? { ...DEFAULTS[t], ...(JSON.parse(raw) as Partial<ExportSettings>) } : DEFAULTS[t]
  } catch { return DEFAULTS[t] }
}

export function saveSettings(t: Target, s: ExportSettings): void {
  try { window.localStorage.setItem(KEY(t), JSON.stringify(s)) } catch { /* private mode */ }
}

type Priced = { inv: BillInvoice; lines: { description: string; amount: number; zero: boolean }[] }

/** Charge lines per invoice, fetched a few at a time. Falls back to one summary line when an invoice is not itemised. */
export async function loadLines(rows: BillInvoice[], onProgress: (done: number) => void): Promise<Priced[]> {
  const out: Priced[] = new Array(rows.length)
  let next = 0
  let done = 0
  async function worker() {
    while (next < rows.length) {
      const i = next++
      const inv = rows[i]
      let d: Awaited<ReturnType<typeof fetchInvoiceDetail>> = null
      try { d = await fetchInvoiceDetail(inv.invoice_no) } catch { d = null }
      const net = Math.round((inv.amount - inv.gst) * 100) / 100
      const lines = d && d.itemised && d.lines.length
        ? d.lines.map((l: InvoiceLine) => ({ description: l.description ?? l.code ?? 'Charge', amount: l.amount, zero: (l.gst_code ?? (l.gst_rate > 0 ? 'S' : 'Z')) !== 'S' }))
        : [{ description: `UB Freight charges, invoice ${inv.invoice_no}`, amount: net, zero: inv.gst < 0.005 }]
      out[i] = { inv, lines }
      onProgress(++done)
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, rows.length) }, worker))
  return out
}

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const dmy = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}` }
const money = (n: number) => n.toFixed(2)
const ref = (inv: BillInvoice) => [inv.shipment_no, inv.customer_ref].filter(Boolean).join(' / ')

/** Xero bills import (Business > Bills to pay > Import). Amounts are tax exclusive. */
export function xeroCsv(data: Priced[], s: ExportSettings): string {
  const head = ['*ContactName', 'EmailAddress', 'POAddressLine1', 'POAddressLine2', 'POAddressLine3', 'POAddressLine4', 'POCity', 'PORegion',
    'POPostalCode', 'POCountry', '*InvoiceNumber', '*InvoiceDate', '*DueDate', 'InventoryItemCode', 'Description', '*Quantity', '*UnitAmount',
    'Discount', '*AccountCode', '*TaxType', 'TrackingName1', 'TrackingOption1', 'TrackingName2', 'TrackingOption2', 'Currency']
  const rows = data.flatMap(({ inv, lines }) => lines.map((l, i) => [
    s.supplier, i === 0 ? 'info@ubfreight.com' : '', i === 0 ? '173 Montgomerie Road' : '', i === 0 ? 'Airport Oaks' : '', '', '',
    i === 0 ? 'Auckland' : '', '', i === 0 ? '2022' : '', i === 0 ? 'New Zealand' : '',
    inv.invoice_no, dmy(inv.doc_date), dmy(inv.date_due), '',
    i === 0 && ref(inv) ? `${l.description} (${ref(inv)})` : l.description, '1', money(l.amount), '',
    s.accountCode, l.zero ? s.taxZero : s.taxStandard, '', '', '', '', inv.currency,
  ]))
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}

/** MYOB service purchases import. One row per line, a blank row between bills, amounts tax exclusive. */
export function myobCsv(data: Priced[], s: ExportSettings): string {
  const head = ['Co./Last Name', 'Purchase No.', 'Date', "Supplier's Number", 'Description', 'Account No.', 'Amount', 'Inc-Tax Amount',
    'Tax Code', 'Non-GST Amount', 'GST Amount', 'Journal Memo', 'Currency Code', 'Exchange Rate', 'Promised Date', 'Purchase Status', 'Inclusive']
  const blocks = data.map(({ inv, lines }) => lines.map((l) => {
    const gst = l.zero ? 0 : Math.round(l.amount * 0.15 * 100) / 100
    return [
      s.supplier, '', dmy(inv.doc_date), inv.invoice_no, l.description, s.accountCode, money(l.amount), money(l.amount + gst),
      l.zero ? s.taxZero : s.taxStandard, money(l.zero ? l.amount : 0), money(gst),
      `UB Freight ${inv.invoice_no}${ref(inv) ? ` ${ref(inv)}` : ''}`, inv.currency, inv.currency === 'NZD' ? '1' : '',
      dmy(inv.date_due), 'B', '',
    ].map(cell).join(',')
  }).join('\r\n'))
  return [head.map(cell).join(','), ...blocks].join('\r\n\r\n').replace(/^([^\r]*)\r\n\r\n/, '$1\r\n')
}

/** Plain spreadsheet of one or more invoices, one row per charge line. */
export function linesCsv(data: Priced[]): string {
  const head = ['Invoice', 'Invoice date', 'Due date', 'Shipment', 'Your ref', 'Charge', 'Amount excl GST', 'GST', 'Currency']
  const rows = data.flatMap(({ inv, lines }) => lines.map((l) => [
    inv.invoice_no, dmy(inv.doc_date), dmy(inv.date_due), inv.shipment_no ?? '', inv.customer_ref ?? '', l.description,
    money(l.amount), l.zero ? 'GST free' : money(Math.round(l.amount * 0.15 * 100) / 100), inv.currency,
  ]))
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}
