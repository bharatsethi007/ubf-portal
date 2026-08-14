import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabase'
import { toast } from 'sonner'
import {
  createBookingTask,
  deleteBookingTask,
  fetchBookingTasks,
  fetchStaffUsers,
  updateBookingTask,
} from './bookingRecordApi'
import type { BookingTask, StaffUser } from './bookingRecordTypes'

export function useBookingTasks(bookingId: string | undefined) {
  const [tasks, setTasks] = useState<BookingTask[]>([])
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!bookingId) {
      setTasks([])
      setLoading(false)
      return
    }
    setLoading(true)
    const rows = await fetchBookingTasks(bookingId)
    setTasks(rows)
    setLoading(false)
  }, [bookingId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    void fetchStaffUsers().then(setStaff)
  }, [])

  const toggleDone = useCallback(async (task: BookingTask, done: boolean) => {
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id ?? null
    const now = new Date().toISOString()
    const patch = done
      ? { status: 'done' as const, completed_at: now, completed_by: userId }
      : { status: 'open' as const, completed_at: null, completed_by: null }

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, ...patch } : t)),
    )
    try {
      await updateBookingTask(task.id, patch)
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? task : t)),
      )
      toast.error(err instanceof Error ? err.message : 'Task update failed')
    }
  }, [])

  const addTask = useCallback(async (title: string, assignedTo: string | null) => {
    if (!bookingId) return
    const { data: auth } = await supabase.auth.getUser()
    try {
      const row = await createBookingTask(bookingId, title, assignedTo, auth.user?.id ?? null)
      setTasks((prev) => [...prev, row])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add task')
    }
  }, [bookingId])

  const removeTask = useCallback(async (task: BookingTask) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    try {
      await deleteBookingTask(task.id)
    } catch (err) {
      setTasks((prev) => [...prev, task].sort((a, b) => a.sort_order - b.sort_order))
      toast.error(err instanceof Error ? err.message : 'Could not delete task')
    }
  }, [])

  const assignTask = useCallback(async (task: BookingTask, userId: string | null) => {
    const assignee = userId ? staff.find((s) => s.user_id === userId) ?? null : null
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, assigned_to: userId, assignee } : t)),
    )
    try {
      await updateBookingTask(task.id, { assigned_to: userId })
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? task : t)),
      )
      toast.error(err instanceof Error ? err.message : 'Could not assign task')
    }
  }, [staff])

  const doneCount = tasks.filter((t) => t.status === 'done').length

  return {
    tasks,
    staff,
    loading,
    doneCount,
    toggleDone,
    addTask,
    removeTask,
    assignTask,
    reload,
  }
}
