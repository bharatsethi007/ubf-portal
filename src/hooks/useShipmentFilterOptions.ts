import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { applyBaseScope } from '../utils/shipmentQuery'
import { useShipmentFilters } from './useShipmentFilters'

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter(Boolean) as string[])].sort()
}

export function useShipmentFilterOptions() {
  const { moduleCode, dateRange, dateBasis, view } = useShipmentFilters()
  const [origins, setOrigins] = useState<string[]>([])
  const [destinations, setDestinations] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    ;(async () => {
      const table = view === 'consols' ? 'v_consols' : 'shipments'
      let query = supabase.from(table).select('origin, destination')
      query = applyBaseScope(query, moduleCode, view, dateBasis, dateRange)
      const { data, error } = await query.limit(5000)

      if (cancelled) return
      if (error) {
        setOrigins([])
        setDestinations([])
      } else {
        const rows = data ?? []
        setOrigins(uniqueSorted(rows.map((r) => r.origin)))
        setDestinations(uniqueSorted(rows.map((r) => r.destination)))
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [moduleCode, dateRange, dateBasis, view])

  return { origins, destinations, loading }
}
