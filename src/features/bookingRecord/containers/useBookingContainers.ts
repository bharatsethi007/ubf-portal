import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  deleteBookingContainer,
  fetchBookingContainers,
  resolveContainerConflict,
  upsertBookingContainer,
} from './bookingContainersApi'
import type { BookingContainerRow, ContainerConflictResolution } from './bookingContainerTypes'
import { fetchBookingTrackingSettings } from '../tracking/bookingTrackingApi'
import {
  subscribePortConnect,
  unsubscribePortConnect,
} from '../tracking/portconnectSubscriptionApi'

export type DraftBookingContainer = {
  id: string
  draft: true
  container_no: string
  container_type: string | null
  seal_no: string | null
}

export type ContainerListItem = BookingContainerRow | DraftBookingContainer

export function isDraftContainer(row: ContainerListItem): row is DraftBookingContainer {
  return 'draft' in row && row.draft === true
}

import type { BookingContainerRow } from './bookingContainerTypes'

const EMPTY_CONTAINERS: BookingContainerRow[] = []

export function useBookingContainers(
  bookingId: string,
  initial: BookingContainerRow[] = EMPTY_CONTAINERS,
  onResolved?: () => void,
) {
  const [rows, setRows] = useState<ContainerListItem[]>(initial)
  const [portconnectEnabled, setPortconnectEnabled] = useState(false)
  const [resolveBusy, setResolveBusy] = useState(false)

  useEffect(() => {
    setRows(initial)
  }, [bookingId, initial])

  useEffect(() => {
    void fetchBookingTrackingSettings(bookingId)
      .then((s) => setPortconnectEnabled(Boolean(s?.portconnect_enabled)))
      .catch(() => setPortconnectEnabled(false))
  }, [bookingId])

  const reload = useCallback(async () => {
    const next = await fetchBookingContainers(bookingId)
    setRows(next)
    return next
  }, [bookingId])

  const addDraft = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}`,
        draft: true,
        container_no: '',
        container_type: null,
        seal_no: null,
      },
    ])
  }, [])

  const saveRow = useCallback(async (
    rowId: string,
    payload: { container_no: string; container_type: string | null; seal_no: string | null },
  ) => {
    const normalizedNo = payload.container_no.trim().toUpperCase()
    if (!normalizedNo) {
      setRows((prev) => prev.filter((r) => r.id !== rowId))
      return null
    }

    const existing = rows.find((r) => r.id === rowId)
    const isDraft = !existing || isDraftContainer(existing)
    const prevNo = existing && !isDraftContainer(existing) ? existing.container_no : null

    try {
      const saved = await upsertBookingContainer(bookingId, {
        id: isDraft ? undefined : rowId,
        container_no: normalizedNo,
        container_type: payload.container_type,
        seal_no: payload.seal_no?.trim() || null,
        sort_order: rows.filter((r) => !isDraftContainer(r)).length,
      })

      setRows((prev) => prev.map((r) => (r.id === rowId ? saved : r)))

      if (portconnectEnabled) {
        if (prevNo && prevNo !== normalizedNo) {
          await unsubscribePortConnect(bookingId, prevNo).catch(() => undefined)
        }
        if (!prevNo || prevNo !== normalizedNo) {
          await subscribePortConnect(bookingId, [normalizedNo]).catch(() => undefined)
        }
      }

      return saved
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save container')
      return null
    }
  }, [bookingId, portconnectEnabled, rows])

  const removeRow = useCallback(async (rowId: string) => {
    const row = rows.find((r) => r.id === rowId)
    if (!row) return

    if (isDraftContainer(row)) {
      setRows((prev) => prev.filter((r) => r.id !== rowId))
      return
    }

    if (row.source !== 'manual') return

    try {
      await deleteBookingContainer(rowId)
      setRows((prev) => prev.filter((r) => r.id !== rowId))
      if (portconnectEnabled) {
        await unsubscribePortConnect(bookingId, row.container_no).catch(() => undefined)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove container')
    }
  }, [bookingId, portconnectEnabled, rows])

  const resolveConflict = useCallback(async (
    rowId: string,
    resolution: ContainerConflictResolution,
  ) => {
    setResolveBusy(true)
    try {
      const saved = await resolveContainerConflict(bookingId, rowId, resolution)
      setRows((prev) => prev.map((r) => (r.id === rowId ? saved : r)))
      onResolved?.()
      toast.success('Container conflict resolved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resolve conflict')
    } finally {
      setResolveBusy(false)
    }
  }, [bookingId, onResolved])

  return {
    rows,
    addDraft,
    saveRow,
    removeRow,
    resolveConflict,
    reload,
    portconnectEnabled,
    resolveBusy,
  }
}
