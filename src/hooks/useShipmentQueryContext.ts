import { useMemo } from 'react'
import type { ShipmentQueryContext } from '../utils/shipmentQuery'
import { useShipmentFilters } from './useShipmentFilters'

export function useShipmentQueryContext(): ShipmentQueryContext {
  const { moduleCode, dateRange, dateBasis, activePort, view, debouncedFilters } = useShipmentFilters()

  return useMemo(
    () => ({
      module: moduleCode,
      dateRange,
      dateBasis,
      port: activePort,
      view,
      filters: debouncedFilters,
    }),
    [moduleCode, dateRange, dateBasis, activePort, view, debouncedFilters],
  )
}
