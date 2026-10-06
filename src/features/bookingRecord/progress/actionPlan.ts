import { dmy, type BookingProgress } from './progressApi'
import type { TemplateKey } from './messageTemplates'
import type { ComposerKind } from '../email/composerPresets'

/** Where an ops CTA takes the user on the record page. */
export type GotoTarget = 'details' | 'tracking' | 'documents' | 'history' | 'portal_request'
export type Cta =
  | { kind: 'goto'; label: string; target: GotoTarget }
  | { kind: 'notify'; label: string; template: TemplateKey }
  | { kind: 'email'; label: string; composer: ComposerKind } // opens the Outlook composer on the record page
export type ActionPlan = {
  title: string; why: string; tone: 'red' | 'amber' | 'blue' | 'green'
  primary: Cta | null
  customer: { template: TemplateKey; label: string } | null // suggested customer touch
}

const toneOf = (u: string | null): ActionPlan['tone'] =>
  u === 'overdue' || u === 'blocked' ? 'red' : u === 'today' ? 'amber' : u === 'soon' ? 'blue' : 'green'

/** Deterministic: next action from the flow engine → plain reason + the one thing to click. */
export function actionPlan(p: BookingProgress): ActionPlan {
  const a = p.next_action ?? ''
  const tone = toneOf(p.urgency)
  const eta = dmy(p.eta), lfd = dmy(p.lfd)
  const plan = (title: string, why: string, primary: Cta | null, customer: ActionPlan['customer'] = null): ActionPlan =>
    ({ title, why, tone, primary, customer })

  if (!a) {
    const left = p.milestones.filter((m) => !m.done)
    if (!left.length) return { title: 'Job complete', why: 'Every milestone is done.', tone: 'green', primary: null, customer: null }
    return { title: 'On track', why: `Waiting on ${left[0].label.toLowerCase()}${left[0].due ? ` (by ${dmy(left[0].due)})` : ''}.`, tone: 'green',
      primary: null, customer: { template: 'status', label: 'Send status update' } }
  }
  if (a === 'Review portal request') return plan(a, 'Customer submitted this in the portal. Confirm or decline.', { kind: 'goto', label: 'Review request', target: 'portal_request' })
  if (a === 'Complete email draft' || a === 'Submit draft') return plan(a, 'Booking is still a draft. Check fields and submit.', { kind: 'goto', label: 'Open details', target: 'details' })
  if (a.startsWith('Resolve hold')) return plan(a, p.hold ? `On hold: ${p.hold}.` : 'Booking is on hold.', { kind: 'goto', label: 'Review hold', target: 'details' },
    { template: 'delay', label: 'Tell customer about the hold' })
  if (a === 'Key into CyberFreight' || a === 'Link ERP job') return plan(a, 'No CyberFreight job linked yet. Key it in, then link it here.', { kind: 'goto', label: 'Link ERP job', target: 'details' })
  if (a === 'Get SWB / telex release') return plan(a, `ETA ${eta}. No seaway bill or telex on hand.`,
    { kind: 'notify', label: 'Ask customer for release', template: 'release_needed' })
  if (a === 'Chase customs / MPI clearance') return plan(a, `ETA ${eta}. Customs or MPI not released yet.`,
    { kind: 'goto', label: 'Check clearance', target: 'tracking' }, { template: 'arrived', label: 'Tell customer clearance is underway' })
  if (a === 'Chase line release') return plan(a, `ETA ${eta}. Shipping line has not released.`,
    { kind: 'notify', label: 'Ask customer about line charges', template: 'line_release' })
  if (a === 'Confirm arrival') return plan(a, `ETA ${eta} passed. No arrival recorded.`, { kind: 'goto', label: 'Check tracking', target: 'tracking' },
    { template: 'delay', label: 'Warn customer of delay' })
  if (a === 'Book cartage') return plan(a, `Cleared, no truck booked.${p.lfd ? ` Last free day ${lfd}.` : ''}`,
    { kind: 'email', label: 'Email trucker', composer: 'delivery' }, { template: 'delivery_time', label: 'Ask customer for delivery time' })
  if (a === 'Deliver') return plan(a, `Truck booked. Deliver before last free day ${lfd}.`, { kind: 'goto', label: 'Open cartage', target: 'details' },
    { template: 'status', label: 'Confirm delivery with customer' })
  if (a === 'Book pickup') return plan(a, 'Departure is close and no pickup is booked.', { kind: 'goto', label: 'Book pickup', target: 'details' })
  if (a === 'Return empty') return plan(a, `Delivered. Empty still out${p.depot ? `, returns to ${p.depot}` : ''}.`,
    { kind: 'email', label: 'Book empty pickup', composer: 'empty' }, { template: 'empty_reminder', label: 'Ask customer about empty' })
  if (a === 'Approve invoice') return plan(a, 'Job delivered. Invoice not approved.', { kind: 'goto', label: 'Open invoices', target: 'details' })
  if (a === 'Send invoice') return plan(a, 'Invoice approved. Not sent to customer.', { kind: 'goto', label: 'Open invoices', target: 'details' })
  return plan(a, '', null, { template: 'status', label: 'Send status update' })
}
