import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  completeTask, fetchBookingRefs, fetchContainerDates, fetchOpenTasks, fetchShipmentNos, nzToday,
  type PortalBookingRef, type PortalContainerDates, type PortalTask,
} from './portalActionsApi'

/** Open customer tasks + container dates. Pass bookingId to scope to one booking. */
export function usePortalActions(bookingId?: string | null) {
  const [tasks, setTasks] = useState<PortalTask[]>([])
  const [dates, setDates] = useState<PortalContainerDates[]>([])
  const [refs, setRefs] = useState<Map<string, PortalBookingRef>>(new Map())
  const [shipNos, setShipNos] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const scoped = bookingId ?? undefined
  const skip = bookingId === null

  const load = useCallback(async () => {
    if (skip) { setLoading(false); return }
    try {
      const [t, d] = await Promise.all([fetchOpenTasks(scoped), fetchContainerDates(scoped)])
      const ids = [...new Set(t.map((x) => x.booking_id))]
      setTasks(t)
      setDates(d)
      const r = await fetchBookingRefs(ids)
      setRefs(r)
      const jobs = [...new Set([...r.values()].map((b) => b.shipment_id).filter((x): x is number => x != null))]
      setShipNos(await fetchShipmentNos(jobs))
    } catch {
      // Portal hides the panel when this fails; Home already shows a load error banner.
    } finally {
      setLoading(false)
    }
  }, [scoped, skip])

  useEffect(() => { void load() }, [load])

  const respond = useCallback(async (task: PortalTask, response: Record<string, unknown>) => {
    setBusy(task.id)
    try {
      const r = await completeTask(task.id, response)
      toast.success(r.message)
      await load()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
      return false
    } finally {
      setBusy(null)
    }
  }, [load])

  const sorted = useMemo(() => {
    const today = nzToday()
    const rank = (t: PortalTask) => {
      if (t.due_date && t.due_date < today) return 0
      if (t.due_date === today) return 1
      return 2
    }
    return tasks.filter((t) => t.status === 'open').sort((a, b) =>
      rank(a) - rank(b)
      || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
      || a.created_at.localeCompare(b.created_at))
  }, [tasks])

  const done = useMemo(
    () => tasks.filter((t) => t.status === 'done').sort((a, b) => (b.responded_at ?? b.created_at).localeCompare(a.responded_at ?? a.created_at)),
    [tasks],
  )

  return { tasks: sorted, done, dates, refs, shipNos, loading, busy, respond, reload: load }
}
