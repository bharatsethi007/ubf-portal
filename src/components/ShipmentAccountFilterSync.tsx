import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useShipmentFilters } from '../hooks/useShipmentFilters'

/** Applies ?account_id= from Customers → Shipments deep link. */
export default function ShipmentAccountFilterSync() {
  const [params] = useSearchParams()
  const { setView, setFilter } = useShipmentFilters()

  useEffect(() => {
    const accountId = params.get('account_id')
    if (!accountId) return
    setView('jobs')
    setFilter('customer', accountId)
  }, [params, setView, setFilter])

  return null
}
