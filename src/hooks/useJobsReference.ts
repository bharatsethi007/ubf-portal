import { useEffect, useMemo, useState } from 'react'
import { fetchJobsReference, type ReferenceJob } from '../components/bookings/jobsReferenceApi'
import { useDebouncedValue } from './useDebouncedValue'

type Params = {
  shipperAccountId?: string
  consigneeAccountId?: string
  origin?: string
  destination?: string
  module?: string
}

export function useJobsReference({
  shipperAccountId,
  consigneeAccountId,
  origin,
  destination,
  module,
}: Params) {
  const query = useMemo(
    () => ({
      shipperAccountId: shipperAccountId?.trim() ?? '',
      consigneeAccountId: consigneeAccountId?.trim() ?? '',
      origin: origin?.trim() ?? '',
      destination: destination?.trim() ?? '',
      module: module?.trim() ?? '',
    }),
    [shipperAccountId, consigneeAccountId, origin, destination, module],
  )
  const debounced = useDebouncedValue(query, 400)
  const [jobs, setJobs] = useState<ReferenceJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const ready = Boolean(
    (debounced.shipperAccountId || debounced.consigneeAccountId)
    && debounced.origin
    && debounced.destination
    && debounced.module,
  )

  useEffect(() => {
    if (!ready) {
      setJobs([])
      setError('')
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    fetchJobsReference({
      shipperAccountId: debounced.shipperAccountId || null,
      consigneeAccountId: debounced.consigneeAccountId || null,
      origin: debounced.origin || null,
      destination: debounced.destination || null,
      module: debounced.module,
    })
      .then((rows) => { if (!cancelled) setJobs(rows) })
      .catch((err) => {
        if (!cancelled) {
          console.error('[useJobsReference] fetch failed', err)
          setJobs([])
          setError(err instanceof Error ? err.message : 'Failed to load reference jobs')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [debounced, ready])

  return { jobs, loading, error, ready, count: jobs.length }
}
