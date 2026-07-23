import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabase'
import { toast } from 'sonner'
import { createBookingNote, fetchBookingNotes, type BookingNote } from './bookingNotesApi'

export function useBookingNotes(bookingId: string | undefined) {
  const [notes, setNotes] = useState<BookingNote[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!bookingId) {
      setNotes([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const rows = await fetchBookingNotes(bookingId)
      setNotes(rows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load notes')
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    void reload()
  }, [reload])

  const addNote = useCallback(async (body: string) => {
    if (!bookingId) return
    const trimmed = body.trim()
    if (!trimmed) return
    const { data: auth } = await supabase.auth.getUser()
    const authorId = auth.user?.id ?? null
    try {
      const row = await createBookingNote(bookingId, trimmed, authorId)
      setNotes((prev) => [row, ...prev])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save note')
    }
  }, [bookingId])

  return { notes, loading, addNote, reload }
}
