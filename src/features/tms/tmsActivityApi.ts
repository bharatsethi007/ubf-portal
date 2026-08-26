import { supabase } from '@/supabase'

export type ActivityRow = { id: number; event_code: string; from_status: string | null; to_status: string | null; note: string | null; created_at: string }

export async function fetchConsignmentActivity(id: string): Promise<ActivityRow[]> {
  const { data, error } = await supabase.from('tms_events')
    .select('id,event_code,from_status,to_status,note,created_at')
    .eq('consignment_id', id).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ActivityRow[]
}

export function activityLabel(r: ActivityRow): string {
  switch (r.event_code) {
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
