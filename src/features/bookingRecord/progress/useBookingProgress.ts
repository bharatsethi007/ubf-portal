import { useCallback, useEffect, useState } from 'react'
import { fetchBookingProgress, type BookingProgress } from './progressApi'

/** Loads booking_progress; re-loads when `refreshKey` changes (record saves, tracking refresh). */
export function useBookingProgress(bookingId: string | null | undefined, refreshKey?: unknown) {
  const [progress, setProgress] = useState<BookingProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const load = useCallback(async () => {
    if (!bookingId) { setProgress(null); return }
    setLoading(true)
    try { setProgress(await fetchBookingProgress(bookingId)) } catch { setProgress(null) } finally { setLoading(false) }
  }, [bookingId])
  useEffect(() => { void load() }, [load, refreshKey])
  return { progress, loading, reload: load }
}
