import { buildDeliveryEmail, buildEmptyPickupEmail, type CartageMailCtx } from '../form/cartageMail'
import { buildTemplate, type TemplateKey } from '../progress/messageTemplates'
import { fetchCustomerContacts, type BookingProgress } from '../progress/progressApi'
import type { EmailPurpose } from './emailApi'

export type ComposerKind = 'delivery' | 'empty' | 'customer' | 'blank'
export type ComposerPreset = { purpose: EmailPurpose; subject: string; html: string; to: string[]; contactKind?: string }
export type ComposerOpen = { kind: ComposerKind; template?: TemplateKey }
export type PresetDeps = CartageMailCtx & { progress: BookingProgress | null; containers: string[] }
export type Signature = { name: string; title: string | null; phone: string | null }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Plain lines → HTML paragraphs. "Label: value" lines get a bold label so truckers can scan them. */
export function linesToHtml(lines: string[]): string {
  return lines.map((l) => {
    if (!l.trim()) return '<p></p>'
    const m = /^([A-Z][A-Za-z /]{1,24}):\s(.+)$/.exec(l)
    return m ? `<p><strong>${esc(m[1])}:</strong> ${esc(m[2])}</p>` : `<p>${esc(l)}</p>`
  }).join('')
}

export function signatureHtml(s: Signature, mailbox: string | null): string {
  const bits = [
    `<p>Kind regards,</p>`,
    `<p><strong>${esc(s.name)}</strong>${s.title ? `<br>${esc(s.title)}` : ''}</p>`,
    `<p>UB Freight Ltd${s.phone ? `<br>${esc(s.phone)}` : ''}${mailbox ? `<br>${esc(mailbox)}` : ''}</p>`,
  ]
  return `<p></p>${bits.join('')}`
}

export async function buildPreset(open: ComposerOpen, d: PresetDeps): Promise<ComposerPreset> {
  if (open.kind === 'delivery') {
    const m = await buildDeliveryEmail(d)
    return { purpose: 'delivery', subject: m.subject, html: linesToHtml(m.lines), to: [], contactKind: 'trucker' }
  }
  if (open.kind === 'empty') {
    const m = await buildEmptyPickupEmail(d)
    return { purpose: 'empty', subject: m.subject, html: linesToHtml(m.lines), to: [], contactKind: 'trucker' }
  }
  if (open.kind === 'customer' && d.progress) {
    const contacts = await fetchCustomerContacts(d.booking.id).catch(() => null)
    const first = contacts?.emails[0]
    const firstName = (first?.name || contacts?.customer_name || '').trim().split(/\s+/)[0] || 'there'
    const vessel = d.progress.milestones.find((m) => m.key === 'arrived')?.note ?? null
    const t = buildTemplate(open.template ?? 'status', { p: d.progress, firstName, containers: d.containers, vessel })
    return { purpose: 'customer', subject: t.subject, html: linesToHtml(t.body.split('\n')), to: first ? [first.email] : [], contactKind: 'customer' }
  }
  const ref = d.booking.booking_ref ?? ''
  return { purpose: 'general', subject: ref, html: '<p>Hi there,</p><p></p>', to: [] }
}
