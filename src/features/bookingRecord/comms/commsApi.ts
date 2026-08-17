import { supabase } from '@/supabase'
import type { BookingComm, NewCommInput, ComplaintStatus } from './commsTypes'

const SELECT = `
  id, booking_id, occurred_at, activity_type, direction, category, sentiment,
  contact_name, subject, body, created_by, author_initials,
  complaint_type, complaint_severity, complaint_status, created_at,
  staff_users ( email, initials )
`

type CommRow = {
  id: string
  booking_id: string
  occurred_at: string
  activity_type: BookingComm['activity_type']
  direction: BookingComm['direction']
  category: BookingComm['category']
  sentiment: BookingComm['sentiment']
  contact_name: string | null
  subject: string | null
  body: string
  created_by: string | null
  author_initials: string | null
  complaint_type: BookingComm['complaint_type']
  complaint_severity: BookingComm['complaint_severity']
  complaint_status: BookingComm['complaint_status']
  created_at: string
  staff_users: { email: string; initials: string | null } | null
}

function mapComm(row: CommRow): BookingComm {
  return {
    id: row.id,
    booking_id: row.booking_id,
    occurred_at: row.occurred_at,
    activity_type: row.activity_type,
    direction: row.direction,
    category: row.category,
    sentiment: row.sentiment,
    contact_name: row.contact_name,
    subject: row.subject,
    body: row.body,
    created_by: row.created_by,
    author_email: row.staff_users?.email ?? null,
    author_initials: row.staff_users?.initials ?? row.author_initials ?? null,
    complaint_type: row.complaint_type,
    complaint_severity: row.complaint_severity,
    complaint_status: row.complaint_status,
    created_at: row.created_at,
  }
}

export async function fetchBookingComms(bookingId: string): Promise<BookingComm[]> {
  const { data, error } = await supabase
    .from('booking_comms')
    .select(SELECT)
    .eq('booking_id', bookingId)
    .order('occurred_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as CommRow[]).map(mapComm)
}

export async function createBookingComm(
  bookingId: string,
  input: NewCommInput,
  authorId: string | null,
  authorInitials: string | null,
): Promise<BookingComm> {
  const isComplaint = input.category === 'complaint'
  const payload = {
    booking_id: bookingId,
    activity_type: input.activity_type,
    direction: input.direction,
    category: input.category,
    sentiment: input.sentiment,
    contact_name: input.contact_name,
    subject: input.subject,
    body: input.body,
    occurred_at: input.occurred_at ?? new Date().toISOString(),
    created_by: authorId,
    author_initials: authorInitials,
    complaint_type: isComplaint ? input.complaint_type ?? null : null,
    complaint_severity: isComplaint ? input.complaint_severity ?? null : null,
    complaint_status: isComplaint ? (input.complaint_status ?? 'open') : null,
  }
  const { data, error } = await supabase
    .from('booking_comms')
    .insert(payload)
    .select(SELECT)
    .single()
  if (error) throw error
  if (!data) throw new Error('Failed to log comm')
  return mapComm(data as unknown as CommRow)
}

export async function deleteBookingComm(id: string): Promise<void> {
  const { error } = await supabase.from('booking_comms').delete().eq('id', id)
  if (error) throw error
}

export async function updateComplaintStatus(id: string, status: ComplaintStatus): Promise<void> {
  const { error } = await supabase.from('booking_comms').update({ complaint_status: status }).eq('id', id)
  if (error) throw error
}

export async function createMentionTasks(
  bookingId: string,
  commId: string,
  title: string,
  userIds: string[],
  createdBy: string | null,
): Promise<number> {
  if (!userIds.length) return 0
  const rows = userIds.map((uid) => ({
    booking_id: bookingId,
    title,
    assigned_to: uid,
    created_by: createdBy,
    source_comm_id: commId,
    is_default: false,
    sort_order: 999,
  }))
  const { error } = await supabase.from('booking_tasks').insert(rows)
  if (error) throw error
  return rows.length
}
