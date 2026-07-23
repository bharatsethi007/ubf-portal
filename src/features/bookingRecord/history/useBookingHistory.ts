import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { fetchBookingHistoryPage, HISTORY_PAGE_SIZE } from '../bookingRecordApi'
import type { BookingHistoryRow } from '../bookingRecordTypes'
import { matchesHistoryFilter, type HistoryFilter } from './bookingHistoryFormat'

export function useBookingHistory(bookingId: string, refreshKey = 0) {
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const [rows, setRows] = useState<BookingHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const page = await fetchBookingHistoryPage(bookingId, 0, HISTORY_PAGE_SIZE)
        if (cancelled) return
        setRows(page)
        setHasMore(page.length === HISTORY_PAGE_SIZE)
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Failed to load history')
          setRows([])
          setHasMore(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [bookingId, filter, refreshKey])

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesHistoryFilter(row, filter)),
    [rows, filter],
  )

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const page = await fetchBookingHistoryPage(bookingId, rows.length, HISTORY_PAGE_SIZE)
      setRows((prev) => [...prev, ...page])
      setHasMore(page.length === HISTORY_PAGE_SIZE)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load more history')
    } finally {
      setLoadingMore(false)
    }
  }, [bookingId, hasMore, loadingMore, rows.length])

  return {
    filter,
    setFilter,
    rows: filteredRows,
    loading,
    loadingMore,
    hasMore,
    loadMore,
  }
}
