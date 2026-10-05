import { AtSign, CheckSquare, FileUp, FileText, Inbox, PackageCheck, Truck, type LucideIcon } from 'lucide-react'
import { supabase } from '../../../supabase'

export type StaffNote = {
  id: number
  kind: string
  title: string
  body: string | null
  booking_id: string | null
  link: string | null
  actor_kind: 'system' | 'staff' | 'customer'
  is_team: boolean
  created_at: string
  is_read: boolean
  facts: Record<string, unknown>
}

export const KIND_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  mention: { label: 'Mention', icon: AtSign, color: '#7C3AED' },
  task_assigned: { label: 'Task', icon: CheckSquare, color: '#2563EB' },
  customer_task: { label: 'Customer reply', icon: PackageCheck, color: '#067647' },
  customer_doc: { label: 'Customer document', icon: FileUp, color: '#0A2472' },
  portal_booking: { label: 'Portal booking', icon: Inbox, color: '#B54708' },
  quote_decision: { label: 'Quote', icon: FileText, color: '#F7941D' },
  gated_out: { label: 'Gate out', icon: Truck, color: '#475467' },
}

export const metaFor = (k: string) => KIND_META[k] ?? { label: 'Update', icon: Inbox, color: '#475467' }

export function linkFor(n: Pick<StaffNote, 'link' | 'booking_id'>): string | null {
  if (n.link) return n.link
  if (n.booking_id) return `/bookings/${n.booking_id}`
  return null
}

export async function fetchFeed(limit = 60): Promise<StaffNote[]> {
  const { data, error } = await supabase.rpc('staff_notifications_feed', { p_limit: limit })
  if (error) throw error
  return (data ?? []) as StaffNote[]
}

export async function markRead(ids: number[] | null): Promise<void> {
  const { error } = await supabase.rpc('staff_notifications_mark_read', { p_ids: ids })
  if (error) throw error
}

export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 604800) return `${Math.floor(s / 86400)}d`
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
}
