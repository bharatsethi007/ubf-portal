export type Invoice = {
  invoice_no: string
  doctype: string | null
  module: string | null
  job_unique: number | null
  doc_date: string | null
  date_due: string | null
  amt_local: number | null
  balance: number | null
  tax_amount: number | null
  currency: string | null
}

export function invoiceStatus(inv: Invoice): 'Paid' | 'Unpaid' | 'Part-paid' {
  const bal = inv.balance ?? 0
  if (bal <= 0) return 'Paid'
  if (inv.amt_local != null && bal < inv.amt_local) return 'Part-paid'
  return 'Unpaid'
}
