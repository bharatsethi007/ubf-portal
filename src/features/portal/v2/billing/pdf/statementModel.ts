import { todayIso } from '../../homeModel'

export type StatementItem = {
  invoice_no: string
  doctype: string | null
  doc_date: string
  date_due: string
  our_ref: string | null
  your_ref: string | null
  amount: number
  balance: number
  currency: string
}

export type Statement = { account_id: string; bill_name: string | null; bill_address: string[] | null; items: StatementItem[] }

export const BUCKETS = [
  { key: 'd120', label: '120 Days' },
  { key: 'd90', label: '90 Days' },
  { key: 'd60', label: '60 Days' },
  { key: 'd30', label: '30 Days' },
  { key: 'cur', label: 'Current' },
] as const
export type BucketKey = (typeof BUCKETS)[number]['key']

/** Ages each open item by days since the invoice date, as the ERP statement does: under 30 is current. */
export function ageStatement(items: StatementItem[], asOf = todayIso()) {
  const b: Record<BucketKey, number> = { d120: 0, d90: 0, d60: 0, d30: 0, cur: 0 }
  const end = Date.parse(`${asOf}T00:00:00Z`)
  for (const i of items) {
    const days = Math.round((end - Date.parse(`${i.doc_date.slice(0, 10)}T00:00:00Z`)) / 864e5)
    const k: BucketKey = days >= 120 ? 'd120' : days >= 90 ? 'd90' : days >= 60 ? 'd60' : days >= 30 ? 'd30' : 'cur'
    b[k] += i.balance
  }
  const total = items.reduce((n, i) => n + i.balance, 0)
  const disbursements = items.filter((i) => i.doctype === 'DIS').reduce((n, i) => n + i.balance, 0)
  return { buckets: b, total, overdue: total - b.cur, disbursements }
}
