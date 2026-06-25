import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Shipment, StatCounts } from '../types/shipment'

const SELECT = `
  job_unique, module, mode, direction, customer_account_id,
  house_bill, master_bill, shipper_name, job_no, shipment_no, origin, destination,
  vessel_flight, etd, eta, departed, arrived, doc_date, status, consol_key,
  goods_desc, pack_qty, pack_type, weight_kg, volume_m3, marks, final_dest,
  customers ( name )
`

function weekAhead(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

export function useShipments() {
  const [rows, setRows] = useState<Shipment[]>([])
  const [stats, setStats] = useState<StatCounts>({
    total: 0,
    notYetDeparted: 0,
    inTransit: 0,
    arrivingIn7Days: 0,
    watchlist: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const today = new Date().toISOString().slice(0, 10)
      const [shipmentsRes, totalRes, pendingRes, transitRes, arrivingRes] = await Promise.all([
        supabase.from('shipments').select(SELECT).order('eta', { ascending: false, nullsFirst: false }).order('job_unique', { ascending: false }).limit(200),
        supabase.from('shipments').select('*', { count: 'exact', head: true }),
        supabase.from('shipments').select('*', { count: 'exact', head: true }).in('status', ['Booked', 'Scheduled']),
        supabase.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'In transit'),
        supabase
          .from('shipments')
          .select('*', { count: 'exact', head: true })
          .gte('eta', today)
          .lte('eta', weekAhead())
          .not('status', 'like', 'Arrived%'),
      ])

      if (cancelled) return

      if (shipmentsRes.error) {
        setError(shipmentsRes.error.message)
        setLoading(false)
        return
      }

      setRows((shipmentsRes.data as Shipment[]) ?? [])
      setStats({
        total: totalRes.count ?? 0,
        notYetDeparted: pendingRes.count ?? 0,
        inTransit: transitRes.count ?? 0,
        arrivingIn7Days: arrivingRes.count ?? 0,
        watchlist: 0,
      })
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return { rows, stats, loading, error }
}

export async function fetchShipment(jobUnique: number): Promise<Shipment | null> {
  const { data, error } = await supabase
    .from('shipments')
    .select(SELECT)
    .eq('job_unique', jobUnique)
    .maybeSingle()

  if (error || !data) return null
  return data as Shipment
}
