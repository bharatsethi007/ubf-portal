import { useCallback, useEffect, useMemo, useState } from 'react'
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
  weight_kg: number | null
  volume_m3: number | null
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

export type AnalyticsMonth = { month: string; sea: number; air: number; kg: number; cbm: number; spend: number }
export type AnalyticsLane = { origin: string; destination: string; mode: string; n: number; kg: number; transit_days: number | null; sched_days: number | null }
export type Analytics = {
  months: AnalyticsMonth[]
  lanes: AnalyticsLane[]
  totals: { shipments: number; kg: number; cbm: number; spend: number; containers: number; teu: number }
  ontime: { n: number; on_time: number }
}

const SHIP_COLS = `job_unique, job_no, house_bill, shipment_no, mode, direction, origin, destination,
  vessel_flight, etd, eta, departed, arrived, doc_date, consignee_name, shipper_name, customer_ref,
  goods_desc, load_type, weight_kg, volume_m3, status, stage, is_active`

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export function usePortalHome() {
  const [pool, setPool] = useState<HomeShipment[]>([])
  const [invoices, setInvoices] = useState<HomeInvoice[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [w, i, a] = await Promise.all([
      supabase.from('portal_shipments').select(SHIP_COLS).gte('doc_date', isoDaysAgo(150))
        .order('doc_date', { ascending: false }).limit(1000),
      supabase.from('portal_invoices').select('invoice_no, job_unique, doc_date, date_due, balance, currency')
        .gt('balance', 0).order('doc_date', { ascending: false }).limit(500),
      supabase.rpc('portal_analytics'),
    ])
    if (w.error || i.error) setError('Some data could not load. Refresh to try again.')
    setPool((w.data ?? []) as HomeShipment[])
    setInvoices((i.data ?? []) as HomeInvoice[])
    setAnalytics((a.data ?? null) as Analytics | null)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const active = useMemo(() => pool.filter((s) => s.is_active), [pool])

  return { pool, active, invoices, analytics, loading, error, reload: load }
}
