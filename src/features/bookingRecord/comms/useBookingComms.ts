import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabase'
import { toast } from 'sonner'
import { createBookingComm, createMentionTasks, deleteBookingComm, fetchBookingComms, updateComplaintStatus } from './commsApi'
import type { BookingComm, NewCommInput, ComplaintStatus } from './commsTypes'
import { fetchStaffUsers } from '../bookingRecordApi'
import { toMentionStaff, parseMentionedUserIds, type MentionStaff } from './commsMentions'

export function useBookingComms(bookingId: string | undefined) {
  const [comms, setComms] = useState<BookingComm[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentInitials, setCurrentInitials] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mentionStaff, setMentionStaff] = useState<MentionStaff[]>([])

  const reload = useCallback(async () => {
    if (!bookingId) { setComms([]); setLoading(false); return }
    setLoading(true)
    try { setComms(await fetchBookingComms(bookingId)) }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not load comms') }
    setLoading(false)
  }, [bookingId])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id ?? null
      if (cancelled) return
      setCurrentUserId(uid)
      if (!uid) return
      const { data } = await supabase.from('staff_users').select('initials, is_admin').eq('user_id', uid).maybeSingle()
      if (cancelled) return
      setCurrentInitials(data?.initials ?? null)
      setIsAdmin(!!data?.is_admin)
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchStaffUsers().then((rows) => { if (!cancelled) setMentionStaff(toMentionStaff(rows)) })
    return () => { cancelled = true }
  }, [])

  const addComm = useCallback(async (input: NewCommInput): Promise<BookingComm | null> => {
    if (!bookingId) return null
    try {
      const row = await createBookingComm(bookingId, input, currentUserId, currentInitials)
      setComms((prev) => [row, ...prev])
      const ids = parseMentionedUserIds(input.body, mentionStaff)
      if (ids.length) {
        try {
          const n = await createMentionTasks(bookingId, row.id, input.body.trim().slice(0, 200), ids, currentUserId)
          if (n) toast.success(`Notified ${n} teammate${n > 1 ? 's' : ''}`)
        } catch { /* mention task failure is non-fatal */ }
      }
      return row
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not log comm')
      return null
    }
  }, [bookingId, currentUserId, currentInitials, mentionStaff])

  const removeComm = useCallback(async (comm: BookingComm) => {
    setComms((prev) => prev.filter((c) => c.id !== comm.id))
    try { await deleteBookingComm(comm.id) }
    catch (err) {
      setComms((prev) => [comm, ...prev].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)))
      toast.error(err instanceof Error ? err.message : 'Only admins can delete entries')
    }
  }, [])

  const setComplaintStatus = useCallback(async (comm: BookingComm, status: ComplaintStatus) => {
    setComms((prev) => prev.map((c) => (c.id === comm.id ? { ...c, complaint_status: status } : c)))
    try { await updateComplaintStatus(comm.id, status) }
    catch (err) {
      setComms((prev) => prev.map((c) => (c.id === comm.id ? comm : c)))
      toast.error(err instanceof Error ? err.message : 'Could not update status')
    }
  }, [])

  const complaintOpenCount = comms.filter(
    (c) => c.category === 'complaint' && c.complaint_status && !['resolved', 'closed'].includes(c.complaint_status),
  ).length

  return { comms, loading, currentUserId, isAdmin, mentionStaff, complaintOpenCount, reload, addComm, removeComm, setComplaintStatus }
}
