import { supabase } from '@/supabase'

export type CustomerTaskKind = 'empty_ready' | 'upload_docs' | 'confirm_delivery' | 'approve' | 'question' | 'todo'

export type CustomerTask = {
  id: string
  booking_id: string
  title: string
  kind: CustomerTaskKind
  container_no: string | null
  description: string | null
  status: 'open' | 'done' | 'na' | 'cancelled'
  due_date: string | null
  payload: Record<string, unknown>
  response: Record<string, unknown> | null
  responded_at: string | null
  created_at: string
}

export type ContainerDates = {
  container_no: string
  container_type: string | null
  arrival_on: string | null
  discharged_on: string | null
  port_free_days: number | null
  port_last_free_day: string | null
  port_status: 'collected' | 'unknown' | 'overdue' | 'today' | 'soon' | 'ok'
  gated_out_on: string | null
  detention_free_days: number
  last_detention_day: string | null
  detention_is_estimate: boolean
  days_to_detention: number | null
  detention_status: 'returned' | 'unknown' | 'overdue' | 'today' | 'soon' | 'ok'
  planned_delivery_date: string | null
  delivery_window: string | null
  planned_return_date: string | null
  empty_ready_at: string | null
  empty_returned_on: string | null
  return_after_free_time: boolean
}

export const KIND_META: Record<CustomerTaskKind, { label: string; defaultTitle: string; needsContainer: boolean }> = {
  empty_ready: { label: 'Empty ready for pickup', defaultTitle: 'Empty ready for pickup', needsContainer: true },
  confirm_delivery: { label: 'Confirm delivery', defaultTitle: 'Confirm delivery date and time', needsContainer: false },
  upload_docs: { label: 'Upload documents', defaultTitle: 'Upload commercial documents', needsContainer: false },
  approve: { label: 'Approve', defaultTitle: 'Approval needed', needsContainer: false },
  question: { label: 'Question', defaultTitle: 'Question from UB Freight', needsContainer: false },
  todo: { label: 'Action', defaultTitle: 'Action needed', needsContainer: false },
}

export const DOC_OPTIONS = ['Commercial invoice', 'Packing list', 'Bill of lading', 'Certificate of origin', 'Fumigation certificate', 'Other']

const TASK_SELECT = 'id, booking_id, title, kind, container_no, description, status, due_date, payload, response, responded_at, created_at'

export async function fetchCustomerTasks(bookingId: string): Promise<CustomerTask[]> {
  const { data, error } = await supabase
    .from('booking_tasks')
    .select(TASK_SELECT)
    .eq('booking_id', bookingId)
    .eq('audience', 'customer')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CustomerTask[]
}

export async function fetchContainerDates(bookingId: string): Promise<ContainerDates[]> {
  const { data, error } = await supabase
    .from('v_container_dates')
    .select(`container_no, container_type, arrival_on, discharged_on, port_free_days, port_last_free_day, port_status,
      gated_out_on, detention_free_days, last_detention_day, detention_is_estimate, days_to_detention, detention_status,
      planned_delivery_date, delivery_window, planned_return_date, empty_ready_at, empty_returned_on, return_after_free_time`)
    .eq('booking_id', bookingId)
    .order('container_no')
  if (error) throw error
  return (data ?? []) as ContainerDates[]
}

export type PushTaskInput = {
  bookingId: string
  kind: CustomerTaskKind
  title: string
  description: string | null
  containerNos: (string | null)[]
  dueDate: string | null
  payload: Record<string, unknown>
}

export async function pushCustomerTasks(input: PushTaskInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  const rows = input.containerNos.map((c) => ({
    booking_id: input.bookingId,
    audience: 'customer',
    kind: input.kind,
    title: c && !input.title.includes(c) ? `${input.title}: ${c}` : input.title,
    description: input.description,
    container_no: c,
    due_date: input.dueDate,
    payload: input.payload,
    status: 'open',
    is_default: false,
    sort_order: 500,
    created_by: auth.user?.id ?? null,
  }))
  const { error } = await supabase.from('booking_tasks').insert(rows)
  if (error) throw error
}

export async function cancelCustomerTask(id: string): Promise<void> {
  const { error } = await supabase.from('booking_tasks').update({ status: 'cancelled' }).eq('id', id)
  if (error) throw error
}

export async function reopenCustomerTask(id: string): Promise<void> {
  const { error } = await supabase.from('booking_tasks').update({ status: 'open' }).eq('id', id)
  if (error) throw error
}

export function responseSummary(t: CustomerTask): string | null {
  const r = t.response
  if (!r) return null
  if (r.ready === 'now') return 'Empty ready now'
  if (typeof r.ready_on === 'string') return `Ready on ${fmtDay(r.ready_on)}`
  if (typeof r.date === 'string') return `Delivery ${fmtDay(r.date)}${r.window ? ` ${String(r.window)}` : ''}`
  if (typeof r.approved === 'boolean') return r.approved ? 'Approved' : 'Declined'
  if (typeof r.answer === 'string') return r.answer
  return 'Responded'
}

export function fmtDay(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
}
