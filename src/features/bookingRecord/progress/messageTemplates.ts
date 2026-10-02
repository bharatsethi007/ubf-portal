import { dmy, type BookingProgress } from './progressApi'

export type TemplateKey =
  | 'status' | 'release_needed' | 'arrived' | 'cleared' | 'delivery_time'
  | 'delivered' | 'empty_reminder' | 'line_release' | 'delay'
export type MessageTemplate = {
  key: TemplateKey; label: string; kind: 'update' | 'request'
  category: string; title: string; subject: string; body: string
}
type Facts = { p: BookingProgress; firstName: string; containers: string[]; vessel: string | null }

const ref = (f: Facts) => f.p.ref ?? 'your shipment'
const boxes = (f: Facts) => (f.containers.length ? (f.containers.length > 3 ? `${f.containers.length} containers` : f.containers.join(', ')) : 'your cargo')
const hi = (f: Facts) => `Hi ${f.firstName},`

function statusBody(f: Facts): string {
  const ms = f.p.milestones
  const lastDone = [...ms].reverse().find((m) => m.done)
  const next = ms.find((m) => !m.done)
  const lines = [hi(f), '']
  lines.push(`Quick update on ${ref(f)} (${boxes(f)}).`)
  if (lastDone) lines.push(`Latest: ${lastDone.label.toLowerCase()}${lastDone.at ? ` on ${dmy(lastDone.at)}` : ''}.`)
  if (next) lines.push(`Next: ${next.label.toLowerCase()}${next.due ? `, expected by ${dmy(next.due)}` : ''}.`)
  if (f.p.eta && !ms.find((m) => m.key === 'arrived')?.done) lines.push(`Vessel ETA ${dmy(f.p.eta)}.`)
  lines.push('', "We'll keep you posted.")
  return lines.join('\n')
}

const BUILD: Record<TemplateKey, (f: Facts) => Omit<MessageTemplate, 'key'>> = {
  status: (f) => ({ label: 'Status update', kind: 'update', category: 'follow_up',
    title: 'Shipment update', subject: `Update: ${ref(f)}`, body: statusBody(f) }),
  release_needed: (f) => ({ label: 'Ask for release', kind: 'request', category: 'documentation',
    title: 'Release documents needed', subject: `Action needed: release for ${ref(f)}`,
    body: `${hi(f)}\n\nThe vessel carrying ${ref(f)} is due ${dmy(f.p.eta) || 'shortly'}. We don't have the seaway bill or telex release yet.\n\nPlease send it through so we can clear and release your cargo without delay.` }),
  arrived: (f) => ({ label: 'Vessel arrived', kind: 'update', category: 'follow_up',
    title: 'Your cargo has arrived', subject: `Arrived: ${ref(f)}`,
    body: `${hi(f)}\n\n${f.vessel ? `${f.vessel} has` : 'The vessel has'} arrived with ${boxes(f)}. We're now working through customs and biosecurity clearance and will confirm delivery timing shortly.` }),
  cleared: (f) => ({ label: 'Cleared', kind: 'update', category: 'customs',
    title: 'Customs and MPI cleared', subject: `Cleared: ${ref(f)}`,
    body: `${hi(f)}\n\nGood news, ${boxes(f)} for ${ref(f)} is cleared by Customs and MPI. We'll be in touch to confirm delivery.` }),
  delivery_time: (f) => ({ label: 'Ask delivery time', kind: 'request', category: 'delivery',
    title: 'Delivery booking', subject: `Delivery booking: ${ref(f)}`,
    body: `${hi(f)}\n\n${ref(f)} is ready to deliver. Please confirm:\n- Preferred delivery date and time\n- Site contact name and phone\n- Any access needs (forklift, tail lift, restricted hours)${f.p.lfd ? `\n\nLast free day at the port is ${dmy(f.p.lfd)}, so earlier is better.` : ''}` }),
  delivered: (f) => ({ label: 'Delivered', kind: 'update', category: 'delivery',
    title: 'Delivered', subject: `Delivered: ${ref(f)}`,
    body: `${hi(f)}\n\n${boxes(f)} for ${ref(f)} has been delivered${f.p.delivery_date ? ` on ${dmy(f.p.delivery_date)}` : ''}. Thanks for shipping with UB Freight.` }),
  empty_reminder: (f) => ({ label: 'Empty return', kind: 'request', category: 'delivery',
    title: 'Empty container return', subject: `Empty return: ${ref(f)}`,
    body: `${hi(f)}\n\nPlease let us know when ${boxes(f)} is empty so we can return it${f.p.depot ? ` to ${f.p.depot}` : ''}. Detention charges can apply once the free period ends.` }),
  line_release: (f) => ({ label: 'Line release', kind: 'request', category: 'documentation',
    title: 'Shipping line release pending', subject: `Line release: ${ref(f)}`,
    body: `${hi(f)}\n\nThe shipping line hasn't released ${ref(f)} yet. If you're paying the line's charges directly, please arrange payment so the cargo can be released.` }),
  delay: (f) => ({ label: 'Delay notice', kind: 'update', category: 'delay',
    title: 'Revised arrival', subject: `Delay: ${ref(f)}`,
    body: `${hi(f)}\n\nThe arrival of ${ref(f)} has moved${f.p.eta ? ` to ${dmy(f.p.eta)}` : ''}. We'll update you as soon as we have firm timing.` }),
}

export function buildTemplate(key: TemplateKey, f: Facts): MessageTemplate {
  return { key, ...BUILD[key](f) }
}

/** Templates worth offering right now, best first. Keeps the picker short and relevant. */
export function relevantTemplates(p: BookingProgress): TemplateKey[] {
  const done = (k: string) => p.milestones.find((m) => m.key === k)?.done
  const has = (k: string) => p.milestones.some((m) => m.key === k)
  const out: TemplateKey[] = []
  if (has('release') && !done('release')) out.push('release_needed')
  if (has('line') && !done('line') && done('arrived')) out.push('line_release')
  if (done('arrived') && !done('cleared')) out.push('arrived')
  if (done('cleared') && !done('delivered')) out.push('cleared', 'delivery_time')
  if (done('delivered')) out.push('delivered')
  if (has('empty') && done('delivered') && !done('empty')) out.push('empty_reminder')
  out.push('status', 'delay')
  return [...new Set(out)]
}

export type { Facts as TemplateFacts }
