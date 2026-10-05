import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  cancelCustomerTask, fetchContainerDates, fetchCustomerTasks, pushCustomerTasks, reopenCustomerTask,
  type ContainerDates, type CustomerTask, type PushTaskInput,
} from './customerTasksApi'

// Supabase errors are plain objects, not Error instances.
const errText = (e: unknown, fallback: string) =>
  (typeof e === 'object' && e && 'message' in e && typeof (e as { message: unknown }).message === 'string')
    ? (e as { message: string }).message : fallback

export function useCustomerTasks(bookingId: string) {
  const [tasks, setTasks] = useState<CustomerTask[]>([])
  const [dates, setDates] = useState<ContainerDates[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const [t, d] = await Promise.all([fetchCustomerTasks(bookingId), fetchContainerDates(bookingId)])
      setTasks(t)
      setDates(d)
    } catch (e) {
      toast.error(errText(e, 'Could not load customer tasks'))
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => { void reload() }, [reload])

  const push = useCallback(async (input: Omit<PushTaskInput, 'bookingId'>) => {
    try {
      await pushCustomerTasks({ ...input, bookingId })
      toast.success(input.containerNos.length > 1 ? `${input.containerNos.length} tasks sent to customer` : 'Task sent to customer')
      await reload()
      return true
    } catch (e) {
      toast.error(errText(e, 'Could not send task'))
      return false
    }
  }, [bookingId, reload])

  const cancel = useCallback(async (id: string) => {
    try { await cancelCustomerTask(id); await reload() }
    catch (e) { toast.error(errText(e, 'Could not cancel task')) }
  }, [reload])

  const reopen = useCallback(async (id: string) => {
    try { await reopenCustomerTask(id); await reload() }
    catch (e) { toast.error(errText(e, 'Could not reopen task')) }
  }, [reload])

  return { tasks, dates, loading, reload, push, cancel, reopen }
}
