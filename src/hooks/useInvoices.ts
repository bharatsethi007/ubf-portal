import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Invoice } from '../types/invoice'

const INVOICE_SELECT =
  'invoice_no, doctype, module, job_unique, doc_date, date_due, amt_local, balance, tax_amount, currency'

function computeOutstanding(invoices: Invoice[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const inv of invoices) {
    const bal = inv.balance ?? 0
    if (bal <= 0) continue
    const cur = inv.currency ?? '—'
    totals[cur] = (totals[cur] ?? 0) + bal
  }
  return totals
}

export function useShipmentInvoices(jobUnique: number | null) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (jobUnique == null) {
      setInvoices([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(INVOICE_SELECT)
        .eq('job_unique', jobUnique)
        .order('doc_date', { ascending: false })

      if (cancelled) return

      if (error) {
        setInvoices([])
      } else {
        setInvoices((data as Invoice[]) ?? [])
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [jobUnique])

  return { invoices, loading }
}

export function useCustomerInvoices(accountId: string | null) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [outstandingByCurrency, setOutstandingByCurrency] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!accountId) {
      setInvoices([])
      setOutstandingByCurrency({})
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(INVOICE_SELECT)
        .eq('account_id', accountId)
        .order('doc_date', { ascending: false })

      if (cancelled) return

      if (error) {
        setInvoices([])
        setOutstandingByCurrency({})
      } else {
        const rows = (data as Invoice[]) ?? []
        setInvoices(rows)
        setOutstandingByCurrency(computeOutstanding(rows))
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [accountId])

  return { invoices, outstandingByCurrency, loading }
}
