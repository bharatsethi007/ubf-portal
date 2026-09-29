import { supabase } from '../../supabase'

export type StaffThread = {
  id: string; subject: string; status: 'open' | 'closed'; account_id: string; customer: string | null; module: string | null
  job_unique: number | null; booking_id: string | null; last_message_at: string; last_sender: 'customer' | 'staff' | null
  last_preview: string | null; unread: number
}
export type StaffMessage = { id: number; kind: 'customer' | 'staff'; name: string | null; body: string; at: string }
export type StaffThreadDetail = Omit<StaffThread, 'last_message_at' | 'last_sender' | 'last_preview' | 'unread'> & { messages: StaffMessage[] }

const clean = (m: string) => m.replace(/^.*?:\s*/, '') || 'Something went wrong'

export async function listStaffThreads(status: 'open' | 'closed' | 'all'): Promise<StaffThread[]> {
  const { data, error } = await supabase.rpc('staff_threads_list', { p_status: status })
  if (error) throw new Error(clean(error.message))
  return (data ?? []) as StaffThread[]
}

export async function getStaffThread(id: string): Promise<StaffThreadDetail | null> {
  const { data, error } = await supabase.rpc('staff_thread_get', { p_thread: id })
  if (error) throw new Error(clean(error.message))
  return (data ?? null) as StaffThreadDetail | null
}

export async function staffReply(id: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('staff_message_send', { p_thread: id, p_body: body })
  if (error) throw new Error(clean(error.message))
}

export async function setThreadStatus(id: string, status: 'open' | 'closed'): Promise<void> {
  const { error } = await supabase.rpc('staff_thread_set_status', { p_thread: id, p_status: status })
  if (error) throw new Error(clean(error.message))
}

/** Open conversations whose last message is from the customer: the console badge. */
export async function waitingTotal(): Promise<number> {
  const { data, error } = await supabase.rpc('staff_threads_waiting')
  return error ? 0 : Number(data ?? 0)
}

export const TEAM: Record<string, string> = { IS: 'Import Sea', ES: 'Export Sea', IA: 'Import Air', EA: 'Export Air' }

export function when(iso: string): string {
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
}
