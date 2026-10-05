import { supabase } from '../../../../supabase'

export type TaskKind = 'empty_ready' | 'upload_docs' | 'confirm_delivery' | 'approve' | 'question' | 'todo'

export type PortalTask = {
  id: string
  booking_id: string
  title: string
  kind: TaskKind
  container_no: string | null
  description: string | null
  status: 'open' | 'done' | 'na' | 'cancelled'
  due_date: string | null
  payload: Record<string, unknown>
  response: Record<string, unknown> | null
  responded_at: string | null
  created_at: string
}

export type PortalBookingRef = { id: string; booking_ref: string | null; shipment_id: number | null; customer_ref: string | null }

export type PortalContainerDates = {
  booking_id: string
  booking_ref: string | null
  shipment_id: number | null
  container_no: string
  container_type: string | null
  arrival_on: string | null
  discharged_on: string | null
  available_on: string | null
  port_free_days: number | null
  port_last_free_day: string | null
  port_status: 'collected' | 'unknown' | 'overdue' | 'today' | 'soon' | 'ok'
  gated_out_on: string | null
  gated_out_at: string | null
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

const TASK_COLS = 'id, booking_id, title, kind, container_no, description, status, due_date, payload, response, responded_at, created_at'

/** Open tasks; on a single booking also the completed ones, so customers keep the record. */
export async function fetchOpenTasks(bookingId?: string): Promise<PortalTask[]> {
  let q = supabase.from('booking_tasks').select(TASK_COLS).eq('audience', 'customer')
  q = bookingId ? q.eq('booking_id', bookingId).in('status', ['open', 'done']) : q.eq('status', 'open')
  const { data, error } = await q.order('due_date', { ascending: true, nullsFirst: false }).limit(200)
  if (error) throw error
  return (data ?? []) as PortalTask[]
}

export async function fetchBookingRefs(ids: string[]): Promise<Map<string, PortalBookingRef>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.from('portal_bookings').select('id, booking_ref, shipment_id, customer_ref').in('id', ids)
  if (error) throw error
  return new Map(((data ?? []) as PortalBookingRef[]).map((b) => [b.id, b]))
}

export async function fetchContainerDates(bookingId?: string): Promise<PortalContainerDates[]> {
  let q = supabase.from('portal_container_dates').select('*')
  if (bookingId) q = q.eq('booking_id', bookingId)
  else q = q.is('empty_returned_on', null)
  const { data, error } = await q.order('container_no').limit(500)
  if (error) throw error
  return (data ?? []) as PortalContainerDates[]
}

export async function completeTask(taskId: string, response: Record<string, unknown>): Promise<{ status: 'done' | 'open'; message: string }> {
  const { data, error } = await supabase.rpc('portal_complete_task', { p_task_id: taskId, p_response: response })
  if (error) throw new Error(error.message)
  return data as { status: 'done' | 'open'; message: string }
}

export function nzToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })
}

export function plusDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
}

export function shortDay(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Best delivery day to suggest: day before port LFD if still ahead, else next working day. */
export function suggestDelivery(dates: PortalContainerDates[], today = nzToday()): string {
  const lfds = dates.map((d) => d.port_last_free_day).filter((x): x is string => !!x).sort()
  const target = lfds.length ? plusDays(lfds[0], -1) : plusDays(today, 1)
  const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()
  // Pull a weekend target back to Friday so it stays inside free time.
  let pick = target
  if (dow(pick) === 6) pick = plusDays(pick, -1)
  if (dow(pick) === 0) pick = plusDays(pick, -2)
  if (pick <= today) {
    pick = plusDays(today, 1)
    if (dow(pick) === 6) pick = plusDays(pick, 2)
    if (dow(pick) === 0) pick = plusDays(pick, 1)
  }
  return pick
}

export function responseText(t: PortalTask): string | null {
  const r = t.response
  if (!r) return null
  if (typeof r.auto === 'string') return 'Closed by UB Freight'
  if (r.ready === 'now') return 'Empty ready for pickup'
  if (typeof r.ready_on === 'string') return `Empty ready ${shortDay(r.ready_on)}`
  if (typeof r.date === 'string') return `Delivery ${shortDay(r.date)}${r.window ? `, ${String(r.window).toLowerCase()}` : ''}`
  if (typeof r.approved === 'boolean') return r.approved ? 'Approved' : 'Declined'
  if (typeof r.answer === 'string') return r.answer
  return 'Done'
}

/** "5 Oct, 2:14pm" in NZ time. */
export function dayTime(ts: string | null | undefined): string {
  if (!ts) return ''
  const d = new Date(ts)
  const day = d.toLocaleDateString('en-NZ', { timeZone: 'Pacific/Auckland', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('en-NZ', { timeZone: 'Pacific/Auckland', hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s/g, '').toLowerCase()
  return `${day}, ${time}`
}
