// Best-effort POD auto-send on completion. Called (fire-and-forget) from the completion
// paths in dispatchApi. Only acts on drop-offs where "Email POD" was requested, and
// never sends twice.
import { toast } from 'sonner'
import { supabase } from '@/supabase'
import { fetchConsignment } from './tmsApi'
import { sendPodDocEmail } from './sendPodEmail'

export async function maybeSendPodOnComplete(consignmentId: string): Promise<void> {
  const d = await fetchConsignment(consignmentId)
  if (!d) return
  const x = d as { order_type?: string; email_pod?: boolean; receiver_email?: string | null; delivered_at?: string | null }
  if (d.order_type !== 'drop-off' || x.email_pod !== true) return
  if (!(x.receiver_email ?? '').trim()) return // no address; staff can send manually from job details

  // dedupe: don't re-send if a POD email already went out successfully
  const { data: prior } = await supabase
    .from('tms_events')
    .select('id')
    .eq('consignment_id', consignmentId)
    .eq('event_code', 'TMS_POD_EMAIL')
    .contains('meta', { email_status: 'sent' })
    .limit(1)
  if (prior && prior.length) return

  // ensure a delivered timestamp exists for the POD (Kanban-drop completion may not set it)
  if (!x.delivered_at) {
    const now = new Date().toISOString()
    await supabase.from('tms_consignments').update({ delivered_at: now }).eq('id', consignmentId)
    ;(d as { delivered_at?: string | null }).delivered_at = now
  }

  try {
    await sendPodDocEmail(d)
    toast.success('Proof of delivery emailed to receiver')
  } catch (e) {
    toast.error(`POD email failed: ${e instanceof Error ? e.message : 'unknown error'}`)
  }
}
