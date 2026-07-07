import { useCallback, useEffect, useState } from 'react'
import { loadPortalShipmentBundle } from './portalShipmentApi'
import type { PortalShipmentBundle } from './portalShipmentDetailTypes'

export function usePortalShipment(jobNo: string | undefined) {
  const [data, setData] = useState<PortalShipmentBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!jobNo) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const bundle = await loadPortalShipmentBundle(jobNo)
      setData(bundle)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shipment')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [jobNo])

  useEffect(() => { refresh() }, [refresh])

  return { data, loading, error, refresh }
}
