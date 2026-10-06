// Deterministic quick replies: read the last inbound message + linked booking facts. No AI, instant.
import type { InboxDetail, InboxShipment } from './inboxApi'

export type Suggestion = { key: string; label: string; text: string }

function firstName(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  if (!n || n.includes('@') || /\b(ltd|limited|trading|co)\b/i.test(n)) return ''
  return n.split(/\s+/)[0]
}

const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' }) : null)

function pickShipment(det: InboxDetail, text: string): InboxShipment | undefined {
  const ref = text.toUpperCase().match(/UBF-[A-Z]{2}-\d{2}-\d{3,4}/)?.[0]
  return det.shipments.find((s) => s.booking_ref === ref) ?? det.shipments.find((s) => s.focus) ?? det.shipments[0]
}

export function buildSuggestions(det: InboxDetail, who: string): Suggestion[] {
  const lastIn = [...det.messages].reverse().find((m) => m.kind === 'message' && m.direction === 'in')
  const msg = (lastIn?.body ?? '').toLowerCase()
  const hi = firstName(who) ? `Hi ${firstName(who)}, ` : 'Hi, '
  const s = pickShipment(det, lastIn?.body ?? '')
  const ref = s?.booking_ref ?? 'your shipment'
  const out: Suggestion[] = []

  if (!det.account && !det.contact?.contact_type) {
    out.push({ key: 'who', label: 'Ask for details', text: `${hi}thanks for your message. Could you share your company name and booking or container number so we can help?` })
    out.push({ key: 'call', label: 'Will call', text: `${hi}thanks for getting in touch. One of our team will call you shortly.` })
    return out
  }

  if (/\b(eta|arriv|when|where|status|update|track)/.test(msg) && s) {
    const when = d(s.eta)
    out.push({ key: 'eta', label: 'ETA update', text: when
      ? `${hi}${ref} is due ${when}.${s.next_action ? ` Next step on our side: ${s.next_action.toLowerCase()}.` : ''} We'll keep you posted.`
      : `${hi}we're checking the latest on ${ref} and will update you shortly.` })
  }
  if (/\b(deliver|truck|cartage|pick ?up|collect)/.test(msg)) {
    out.push({ key: 'del', label: 'Delivery', text: `${hi}we're booking delivery for ${ref} now and will confirm the date and time shortly.` })
  }
  if (/\b(invoice|bill|charge|cost|price|pay)/.test(msg)) {
    out.push({ key: 'inv', label: 'Invoice', text: `${hi}thanks, we're checking the charges on ${ref} and will come back to you today.` })
  }
  if (/\b(doc|invoice copy|packing|bl\b|bill of lading|telex|swb)/.test(msg)) {
    out.push({ key: 'doc', label: 'Docs', text: `${hi}please send the commercial invoice and packing list for ${ref} when ready.` })
  }
  if (s?.last_free_day && !out.some((o) => o.key === 'eta')) {
    out.push({ key: 'lfd', label: 'Free days', text: `${hi}heads up, last free day for ${ref} is ${d(s.last_free_day)}. Let us know your delivery window.` })
  }
  out.push({ key: 'ack', label: 'On it', text: `${hi}thanks, we're on it and will come back to you shortly.` })
  out.push({ key: 'done', label: 'Done', text: `${hi}all sorted. Let us know if you need anything else.` })
  return out.slice(0, 5)
}
