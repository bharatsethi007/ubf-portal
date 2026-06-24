import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { MapPortPoint } from '../types/port'
import { buildMapPorts } from '../utils/buildMapPorts'
import { applyShipmentQueryFilters } from '../utils/shipmentQuery'
import { usePorts } from './usePorts'
import { useShipmentQueryContext } from './useShipmentQueryContext'
import { useShipmentFilters } from './useShipmentFilters'

export function useMapPortData() {
  const { view } = useShipmentFilters()
  const queryCtx = useShipmentQueryContext()
  const { ports: portMap, loading: portsLoading } = usePorts()
  const [mapPorts, setMapPorts] = useState<MapPortPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    ;(async () => {
      const table = view === 'consols' ? 'v_consols' : 'shipments'
      let query = supabase.from(table).select('origin, destination')
      query = applyShipmentQueryFilters(query, queryCtx)

      const { data, error } = await query.limit(5000)
      if (cancelled) return

      if (error) {
        setMapPorts([])
        setLoading(false)
        return
      }

      setMapPorts(buildMapPorts(data ?? [], portMap))
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [view, queryCtx, portMap])

  return { mapPorts, loading: loading || portsLoading }
}
