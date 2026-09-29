import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../supabase'

export type HomeShipment = {
  job_unique: number
  job_no: string | null
  house_bill: string | null
  shipment_no: string | null
  mode: string | null
  direction: string | null
  origin: string | null
  destination: string | null
  vessel_flight: string | null
  etd: string | null
  eta: string | null
  departed: string | null
  arrived: string | null
  doc_date: string | null
  consignee_name: string | null
  shipper_name: string | null
  customer_ref: string | null
  goods_desc: string | null
  load_type: string | null
  status: string | null
  stage: number
  is_active: boolean
}

export type HomeInvoice = {
  invoice_no: string | null
  job_unique: number | null
  doc_date: string | null
  date_due: string | null
  balance: number | null
  currency: string | null
}

const SHIP_COLS = `job_unique, job_no, house_bill, shipment_no, mode, direction, origin, destination,
  vessel_flight, etd, eta, departed, arrived, doc_date, consignee_name, shipper_name, customer_ref,
  goods_desc, load_type, status, stage, is_active`

export function usePortalHome() {
  const [active, setActive] = useState<HomeShipment[]>([])
  const [recent, setRecent] = useState<HomeShipment[]>([])
  const [invoices, setInvoices] = useState<HomeInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [a, r, i] = await Promise.all([
      supabase.from('portal_shipments').select(SHIP_COLS).eq('is_active', true)
        .order('doc_date', { ascending: false }).limit(300),
      supabase.from('portal_shipments').select(SHIP_COLS).eq('stage', 3)
        .order('eta', { ascending: false, nullsFirst: false }).limit(8),
      supabase.from('portal_invoices').select('invoice_no, job_unique, doc_date, date_due, balance, currency')
        .gt('balance', 0).order('doc_date', { ascending: false }).limit(200),
    ])
    if (a.error || r.error || i.error) setError('Could not load your shipments. Try again shortly.')
    setActive((a.data ?? []) as HomeShipment[])
    setRecent((r.data ?? []) as HomeShipment[])
    setInvoices((i.data ?? []) as HomeInvoice[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  return { active, recent, invoices, loading, error, reload: load }
}
