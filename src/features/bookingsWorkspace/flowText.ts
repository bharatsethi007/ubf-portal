import type { ImportSeaRow } from '@/features/importSea/types'
import type { BookingFlow, FlowStage, FlowUrgency } from './useBookingFlow'

export const STAGES: { key: FlowStage; label: string }[] = [
  { key: 'request', label: 'Request' },
  { key: 'booked', label: 'Booked' },
  { key: 'in_transit', label: 'Transit' },
  { key: 'arrived', label: 'At port' },
  { key: 'invoicing', label: 'Invoice' },
  { key: 'closed', label: 'Closed' },
]

export function stageIndex(stage: FlowStage | undefined): number {
  return STAGES.findIndex((s) => s.key === stage)
}

/** dd/mm from an ISO date or timestamp. */
export function ddmm(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value.includes('T') ? value : `${value}T12:00:00`)
  if (Number.isNaN(d.getTime())) return value
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

/** "3h late", "2d late", "due today", "due in 2d". */
export function dueLabel(flow: BookingFlow | undefined): string {
  if (!flow?.action_due || !flow.next_action) return ''
  if (flow.urgency === 'blocked') return 'on hold'
  const ms = new Date(flow.action_due).getTime() - Date.now()
  const hours = Math.round(Math.abs(ms) / 3_600_000)
  const span = hours < 24 ? `${Math.max(1, hours)}h` : `${Math.round(hours / 24)}d`
  if (flow.urgency === 'overdue') return `${span} late`
  if (flow.urgency === 'today') return 'due today'
  return `due in ${span}`
}

export function urgencyTone(u: FlowUrgency | undefined): 'red' | 'amber' | 'blue' | 'green' | 'grey' {
  if (u === 'overdue' || u === 'blocked') return 'red'
  if (u === 'today') return 'amber'
  if (u === 'soon') return 'blue'
  if (u === 'ok') return 'grey'
  return 'green'
}

/** Plain-English reason behind the next action, built from board + flow facts. */
export function whyText(flow: BookingFlow | undefined, row: ImportSeaRow | undefined): string {
  if (!flow?.next_action) return 'Nothing waiting. Job on track.'
  const a = flow.next_action
  const eta = ddmm(flow.eta)
  if (a === 'Review portal request') return 'Customer submitted this in the portal. Confirm or decline.'
  if (a === 'Complete email draft') return 'Draft created from an email. Check fields and submit.'
  if (a === 'Submit draft') return 'Manual draft not submitted yet.'
  if (a.startsWith('Resolve hold')) return row?.hold_reason?.trim() || 'Booking is on hold.'
  if (a === 'Link ERP job') return `Job ${row?.job_no ?? ''} typed but not matched to a CyberFreight job.`
  if (a === 'Key into CyberFreight') return 'No ERP job yet. Key it in, then link it here.'
  if (a === 'Get SWB / telex release') return `ETA ${eta}. No seaway bill or telex on hand.`
  if (a === 'Chase customs / MPI clearance') return `ETA ${eta}. Customs or MPI not released.`
  if (a === 'Chase line release') return `ETA ${eta}. Shipping line has not released.`
  if (a === 'Confirm arrival') return `ETA ${eta} passed. No arrival recorded.`
  if (a === 'Book cartage') {
    const lfd = flow.last_free_day ? ` LFD ${ddmm(flow.last_free_day)}.` : ''
    return `ETA ${eta}. Cleared, no truck booked.${lfd}`
  }
  if (a === 'Deliver') return `Truck booked. Deliver before LFD ${ddmm(flow.last_free_day)}.`
  if (a === 'Book pickup') return `ETD ${ddmm(flow.etd)}. No pickup booked.`
  if (a === 'Return empty') return `Delivered ${ddmm(flow.delivered)}. Empty still out.`
  if (a === 'Approve invoice') return 'Job delivered. Invoice not approved.'
  if (a === 'Send invoice') return 'Invoice approved. Not sent to customer.'
  return ''
}
