import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { refreshPortConnect } from '@/features/bookingRecord/tracking/portconnectSubscriptionApi'
import { fetchImportSeaBoardRow } from './importSeaApi'
import { portConnectRefreshIneligibleReason } from './importSeaBoardUtils'
import {
  diffImportSeaBoardRow,
  formatBoardRowChangeList,
  type ImportSeaBoardCellKey,
} from './importSeaRowDiff'
import type { ImportSeaRow } from './types'

const REFRESH_COOLDOWN_MS = 60_000

export function useImportSeaRowRefresh(
  replaceRow: (row: ImportSeaRow) => void,
) {
  const lastRefreshAt = useRef<Map<string, number>>(new Map())
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(() => new Set())
  const [flashingCells, setFlashingCells] = useState<Map<string, Set<ImportSeaBoardCellKey>>>(
    () => new Map(),
  )

  const flashRowCells = useCallback((rowId: string, keys: ImportSeaBoardCellKey[]) => {
    if (!keys.length) return
    setFlashingCells((prev) => {
      const next = new Map(prev)
      next.set(rowId, new Set(keys))
      return next
    })
    window.setTimeout(() => {
      setFlashingCells((prev) => {
        const next = new Map(prev)
        next.delete(rowId)
        return next
      })
    }, 2000)
  }, [])

  const refreshCooldownSec = useCallback((rowId: string): number => {
    const last = lastRefreshAt.current.get(rowId)
    if (!last) return 0
    const remaining = REFRESH_COOLDOWN_MS - (Date.now() - last)
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0
  }, [])

  const refreshRow = useCallback(async (row: ImportSeaRow) => {
    const ineligible = portConnectRefreshIneligibleReason(row)
    if (ineligible) return

    const cooldown = refreshCooldownSec(row.id)
    if (cooldown > 0) {
      toast.error(`Wait ${cooldown}s before refreshing again`)
      return
    }

    lastRefreshAt.current.set(row.id, Date.now())
    setRefreshingIds((prev) => new Set(prev).add(row.id))

    try {
      await refreshPortConnect(row.id)
      const updated = await fetchImportSeaBoardRow(row.id)
      if (!updated) throw new Error('Booking not found after refresh')

      const changed = diffImportSeaBoardRow(row, updated)
      replaceRow(updated)
      flashRowCells(row.id, changed)

      const ref = updated.booking_ref?.trim() || row.booking_ref?.trim() || 'Booking'
      if (changed.length) {
        toast.success(`${ref}: updated ${formatBoardRowChangeList(changed)}`)
      } else {
        toast.success(`${ref}: no PortConnect field changes`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
    }
  }, [flashRowCells, refreshCooldownSec, replaceRow])

  const isRefreshing = useCallback(
    (rowId: string) => refreshingIds.has(rowId),
    [refreshingIds],
  )

  const isFlashing = useCallback(
    (rowId: string, key: ImportSeaBoardCellKey) => flashingCells.get(rowId)?.has(key) ?? false,
    [flashingCells],
  )

  return { refreshRow, isRefreshing, isFlashing, refreshCooldownSec }
}
