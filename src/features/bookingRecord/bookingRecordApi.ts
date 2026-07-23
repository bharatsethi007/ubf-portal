import { supabase } from '@/supabase'
import { fetchJobDocuments, fetchJobShipment } from '@/features/importSea/jobDetailApi'
import { fetchBookingContainers } from './containers/bookingContainersApi'
import type {
  BookingHistoryRow,
  BookingRecord,
  BookingRecordPatch,
  BookingShipment,
  BookingTask,
  StaffUser,
} from './bookingRecordTypes'

const BOOKING_SELECT = `
  id, booking_ref, job_no, account_id, consignee_account_id, importer_account_id, mode, shipment_id,
  m_eta, m_atf, m_shipping_line, m_discharge_port,
  swb_released, tlx_release_on_hand, doc_handover_at,
  bacc_sent, cleared, truck_booked,
  last_free_day, discharge_date, delivery_date, container_return_date,
  hold_reason, hold_code, handled_by, erp_ref_confirmed_at, field_overrides,
  customers!bookings_account_id_fkey ( name ),
  consignee:customers!bookings_consignee_account_id_fkey ( name ),
  importer:customers!bookings_importer_account_id_fkey ( name )
`

type BookingRow = Omit<BookingRecord, 'customer_name' | 'consignee_name' | 'importer_name'> & {
  customers: { name: string | null } | null
  consignee: { name: string | null } | null
  importer: { name: string | null } | null
}

export async function fetchBookingRecord(id: string): Promise<BookingRecord | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as BookingRow
  const { customers, consignee, importer, ...rest } = row
  return {
    ...rest,
    customer_name: customers?.name ?? null,
    consignee_name: consignee?.name ?? null,
    importer_name: importer?.name ?? null,
  }
}

export async function updateBookingRecord(id: string, patch: BookingRecordPatch): Promise<void> {
  const { error } = await supabase.from('bookings').update(patch).eq('id', id)
  if (error) throw error
}

export const HISTORY_PAGE_SIZE = 50

export async function fetchBookingHistoryPage(
  bookingId: string,
  offset: number,
  limit: number = HISTORY_PAGE_SIZE,
): Promise<BookingHistoryRow[]> {
  const { data, error } = await supabase
    .from('booking_history')
    .select('id, booking_id, field, old_value, new_value, action, actor_id, actor_name, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return (data ?? []) as BookingHistoryRow[]
}

export async function fetchStaffUsers(): Promise<StaffUser[]> {
  const { data, error } = await supabase
    .from('staff_users')
    .select('user_id, email, initials')
    .order('email')
  if (error) throw error
  return (data ?? []) as StaffUser[]
}

export async function fetchBookingTasks(bookingId: string): Promise<BookingTask[]> {
  const { data, error } = await supabase
    .from('booking_tasks')
    .select(`
      id, booking_id, title, is_default, sort_order, status,
      assigned_to, due_date, completed_at, completed_by
    `)
    .eq('booking_id', bookingId)
    .order('sort_order')
  if (error) throw error

  const rows = (data ?? []) as BookingTask[]
  const assigneeIds = [...new Set(rows.map((r) => r.assigned_to).filter(Boolean))] as string[]
  if (assigneeIds.length === 0) return rows

  const { data: staffRows, error: staffError } = await supabase
    .from('staff_users')
    .select('user_id, email, initials')
    .in('user_id', assigneeIds)
  if (staffError) throw staffError

  const staffMap = new Map((staffRows as StaffUser[] | null)?.map((s) => [s.user_id, s]) ?? [])
  return rows.map((row) => ({
    ...row,
    assignee: row.assigned_to ? staffMap.get(row.assigned_to) ?? null : null,
  }))
}

export async function loadBookingRecordBundle(id: string) {
  const booking = await fetchBookingRecord(id)
  if (!booking) return null

  const shipment: BookingShipment | null = booking.shipment_id
    ? await fetchJobShipment(booking.shipment_id)
    : null

  const [containers, documents, tasks] = await Promise.all([
    fetchBookingContainers(id),
    fetchJobDocuments(id),
    fetchBookingTasks(id),
  ])

  return { booking, shipment, containers, documents, tasks }
}

export async function createBookingTask(
  bookingId: string,
  title: string,
  assignedTo: string | null,
  createdBy: string | null,
): Promise<BookingTask> {
  const { data, error } = await supabase
    .from('booking_tasks')
    .insert({
      booking_id: bookingId,
      title,
      assigned_to: assignedTo,
      created_by: createdBy,
      is_default: false,
      sort_order: 999,
    })
    .select(`
      id, booking_id, title, is_default, sort_order, status,
      assigned_to, due_date, completed_at, completed_by
    `)
    .single()
  if (error) throw error
  if (!data) throw new Error('Failed to create task')
  return data as BookingTask
}

export async function updateBookingTask(
  taskId: string,
  patch: Partial<Pick<BookingTask, 'title' | 'status' | 'assigned_to' | 'due_date' | 'completed_at' | 'completed_by'>>,
): Promise<void> {
  const { error } = await supabase.from('booking_tasks').update(patch).eq('id', taskId)
  if (error) throw error
}

export async function deleteBookingTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('booking_tasks').delete().eq('id', taskId)
  if (error) throw error
}
