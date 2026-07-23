import { useCallback, useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { loadBookingRecordBundle, updateBookingRecord } from './bookingRecordApi'
import type { BookingRecord, BookingRecordBundle, BookingRecordPatch } from './bookingRecordTypes'

export type BookingRecordLoadError = {
  message: string
  code?: string
}

function toLoadError(err: unknown): BookingRecordLoadError {
  if (err && typeof err === 'object' && 'message' in err) {
    const pg = err as PostgrestError
    return { message: pg.message, code: pg.code }
  }
  return { message: err instanceof Error ? err.message : 'Failed to load booking' }
}

export function useBookingRecord(bookingId: string | undefined) {
  const [bundle, setBundle] = useState<BookingRecordBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<BookingRecordLoadError | null>(null)
  const [historyTick, setHistoryTick] = useState(0)

  const reload = useCallback(async () => {
    if (!bookingId) {
      setBundle(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await loadBookingRecordBundle(bookingId)
      setBundle(data)
    } catch (err) {
      setBundle(null)
      setError(toLoadError(err))
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  const reloadQuiet = useCallback(async () => {
    if (!bookingId) return
    try {
      const data = await loadBookingRecordBundle(bookingId)
      setBundle(data)
    } catch {
      // keep current bundle on background refresh failure
    }
  }, [bookingId])

  useEffect(() => {
    void reload()
  }, [reload])

  const patchBooking = useCallback(async (
    uiPatch: Partial<BookingRecord>,
    dbPatch: BookingRecordPatch,
  ) => {
    if (!bookingId || !bundle) return
    const snapshot = bundle.booking
    setBundle((prev) =>
      prev ? { ...prev, booking: { ...prev.booking, ...uiPatch } } : prev,
    )
    try {
      await updateBookingRecord(bookingId, dbPatch)
      setHistoryTick((t) => t + 1)
    } catch (err) {
      setBundle((prev) =>
        prev ? { ...prev, booking: snapshot } : prev,
      )
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
  }, [bookingId, bundle])

  const bumpHistory = useCallback(() => setHistoryTick((t) => t + 1), [])

  return { bundle, loading, error, reload, reloadQuiet, patchBooking, historyTick, setBundle, bumpHistory }
}
