import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useShipmentQueryContext } from './useShipmentQueryContext'

export type StatBlock = {
  consols: number
  hbls: number
  weight_kg: number
  volume_m3: number
  customers: number
  teu: number
  hbl_no_etd: number
}

export type ShipmentStats = {
  cur: StatBlock
  prev: StatBlock
  series: Record<'consols' | 'hbls' | 'weight_kg' | 'volume_m3' | 'customers', number[]>
  next7: number
  overdue: number
  days: number
}

/** KPI strip data: same module, date range, basis, port and field filters as the tables. */
export function useShipmentStats() {
  const ctx = useShipmentQueryContext()
  const [data, setData] = useState<ShipmentStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const { data: res, error } = await supabase.rpc('shipments_stats', {
        p_module: ctx.module,
        p_from: ctx.dateRange.from,
        p_to: ctx.dateRange.to,
        p_basis: ctx.dateBasis,
        p_port: ctx.port,
        p_origin: ctx.filters.origin || null,
        p_destination: ctx.filters.destination || null,
        p_vessel: ctx.filters.vesselFlight || null,
      })
      if (cancelled) return
      setData(error ? null : (res as ShipmentStats))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [ctx])

  return { data, loading }
}
