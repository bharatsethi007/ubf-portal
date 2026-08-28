import { supabase } from '@/supabase'

export type ActivityRow = {
  id: number
  event_code: string
  from_status: string | null
  to_status: string | null
  note: string | null
  created_at: string
  actor: string | null
  meta: Record<string, unknown> | null
  actor_label: string | null
}

export async function fetchConsignmentActivity(id: string): Promise<ActivityRow[]> {
  const { data, error } = await supabase.from('tms_events')
    .select('id,event_code,from_status,to_status,note,created_at,actor,meta')
    .eq('consignment_id', id).order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as Omit<ActivityRow, 'actor_label'>[]

  const ids = [...new Set(rows.map((r) => r.actor).filter(Boolean))] as string[]
  const staffMap: Record<string, string> = {}
  if (ids.length) {
    const { data: su } = await supabase.from('staff_users').select('user_id,email,initials').in('user_id', ids)
    for (const s of (su ?? []) as { user_id: string; email: string | null; initials: string | null }[]) {
      staffMap[s.user_id] = s.email || s.initials || ''
    }
  }

  return rows.map((r) => ({
    ...r,
    actor_label: (r.meta?.staff_email as string | undefined) || (r.actor ? staffMap[r.actor] : null) || null,
  }))
}

export function activityLabel(r: ActivityRow): string {
  switch (r.event_code) {
    case 'TMS_CREATED': return r.meta?.source === 'email' ? 'Added from email' : 'Created'
    case 'TMS_ALLOCATED': return 'Cartage allocated'
    case 'TMS_UNASSIGNED': return 'Unassigned'
    case 'TMS_ONBOARD': return 'Collected — on truck'
    case 'TMS_DELIVERED': return 'Delivered'
    case 'TMS_FAILED': return 'Delivery failed'
    case 'TMS_POD': return 'Proof of delivery'
    case 'TMS_STATUS': return r.to_status ? `Status → ${r.to_status}` : 'Status changed'
    default: return r.event_code
  }
}
