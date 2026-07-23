import { supabase } from '@/supabase'

export type BookingNote = {
  id: string
  booking_id: string
  body: string
  author_id: string | null
  created_at: string
  author_email: string | null
  author_initials: string | null
}

type NoteRow = {
  id: string
  booking_id: string
  body: string
  author_id: string | null
  created_at: string
  staff_users: { email: string; initials: string | null } | null
}

function mapNote(row: NoteRow): BookingNote {
  return {
    id: row.id,
    booking_id: row.booking_id,
    body: row.body,
    author_id: row.author_id,
    created_at: row.created_at,
    author_email: row.staff_users?.email ?? null,
    author_initials: row.staff_users?.initials ?? null,
  }
}

export async function fetchBookingNotes(bookingId: string): Promise<BookingNote[]> {
  const { data, error } = await supabase
    .from('booking_notes')
    .select(`
      id, booking_id, body, author_id, created_at,
      staff_users ( email, initials )
    `)
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as NoteRow[]).map(mapNote)
}

export async function createBookingNote(
  bookingId: string,
  body: string,
  authorId: string | null,
): Promise<BookingNote> {
  const { data, error } = await supabase
    .from('booking_notes')
    .insert({ booking_id: bookingId, body, author_id: authorId })
    .select(`
      id, booking_id, body, author_id, created_at,
      staff_users ( email, initials )
    `)
    .single()
  if (error) throw error
  if (!data) throw new Error('Failed to create note')
  return mapNote(data as NoteRow)
}
