import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  fetchBookingTrackingEvents,
  fetchBookingTrackingSettings,
  fetchContainerTrackingRows,
  fetchLastPortConnectRefresh,
  upsertBookingTrackingSettings,
} from './bookingTrackingApi'
import {
  refreshPortConnect,
  subscribePortConnect,
  unsubscribePortConnect,
} from './portconnectSubscriptionApi'
import type {
  BookingTrackingEvent,
  BookingTrackingPatch,
  BookingTrackingSettings,
  ContainerTrackingRow,
} from './trackingTypes'

const REFRESH_COOLDOWN_MS = 60_000

function refreshToastSummary(summary: {
  containers_found: number
  fields_changed: number
  events_written: number
  containers_not_recognised: string[]
}): string {
  const parts = [
    `${summary.containers_found} container${summary.containers_found === 1 ? '' : 's'} synced`,
    `${summary.events_written} event${summary.events_written === 1 ? '' : 's'}`,
  ]
  if (summary.fields_changed) {
    parts.push(`${summary.fields_changed} field change${summary.fields_changed === 1 ? '' : 's'}`)
  }
  if (summary.containers_not_recognised.length) {
    parts.push(`not found: ${summary.containers_not_recognised.join(', ')}`)
  }
  return parts.join(' · ')
}

export function useBookingTracking(
  bookingId: string | undefined,
  containerNumbers: string[],
) {
  const [settings, setSettings] = useState<BookingTrackingSettings | null>(null)
  const [containers, setContainers] = useState<ContainerTrackingRow[]>([])
  const [events, setEvents] = useState<BookingTrackingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [portConnectBusy, setPortConnectBusy] = useState(false)
  const [refreshBusy, setRefreshBusy] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)
  const lastRefreshAttempt = useRef(0)

  const reload = useCallback(async () => {
    if (!bookingId) {
      setSettings(null)
      setContainers([])
      setEvents([])
      setLastRefreshedAt(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [nextSettings, nextContainers, nextEvents, lastRefresh] = await Promise.all([
        fetchBookingTrackingSettings(bookingId),
        fetchContainerTrackingRows(bookingId),
        fetchBookingTrackingEvents(bookingId),
        fetchLastPortConnectRefresh(bookingId),
      ])
      setSettings(nextSettings)
      setContainers(nextContainers)
      setEvents(nextEvents)
      setLastRefreshedAt(lastRefresh)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load tracking')
      setSettings(null)
      setContainers([])
      setEvents([])
      setLastRefreshedAt(null)
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    void reload()
  }, [reload])

  const patchSettings = useCallback(async (patch: BookingTrackingPatch) => {
    if (!bookingId || !settings) return
    const snapshot = settings
    setSettings({ ...settings, ...patch })
    try {
      const saved = await upsertBookingTrackingSettings(bookingId, patch)
      setSettings(saved)
    } catch (err) {
      setSettings(snapshot)
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
  }, [bookingId, settings])

  const subscribe = useCallback(async () => {
    if (!bookingId) return
    if (!containerNumbers.length) {
      toast.error('Add a container number before enabling PortConnect')
      return
    }
    setPortConnectBusy(true)
    try {
      await subscribePortConnect(bookingId, containerNumbers)
      toast.success('PortConnect tracking enabled')
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enable failed')
    } finally {
      setPortConnectBusy(false)
    }
  }, [bookingId, containerNumbers, reload])

  const unsubscribe = useCallback(async () => {
    if (!bookingId) return
    setPortConnectBusy(true)
    try {
      await unsubscribePortConnect(bookingId)
      toast.success('PortConnect tracking disabled')
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Disable failed')
    } finally {
      setPortConnectBusy(false)
    }
  }, [bookingId, reload])

  const refreshPortConnectData = useCallback(async () => {
    if (!bookingId) return
    const now = Date.now()
    if (now - lastRefreshAttempt.current < REFRESH_COOLDOWN_MS) {
      const waitSec = Math.ceil((REFRESH_COOLDOWN_MS - (now - lastRefreshAttempt.current)) / 1000)
      toast.error(`Wait ${waitSec}s before refreshing again`)
      return
    }
    lastRefreshAttempt.current = now
    setRefreshBusy(true)
    try {
      const summary = await refreshPortConnect(bookingId)
      setLastRefreshedAt(summary.last_refreshed_at)
      toast.success(refreshToastSummary(summary))
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshBusy(false)
    }
  }, [bookingId, reload])

  return {
    settings,
    containers,
    events,
    loading,
    portConnectBusy,
    refreshBusy,
    lastRefreshedAt,
    patchSettings,
    subscribePortConnect: subscribe,
    unsubscribePortConnect: unsubscribe,
    refreshPortConnect: refreshPortConnectData,
    reload,
  }
}
