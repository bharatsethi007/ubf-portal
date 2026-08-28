// Builds the POD PDF + email and posts to the staff-gated `tms-doc-email` edge function.
// Used by the job-details "Email POD" action and (later) the completion auto-trigger.
import { supabase } from '@/supabase'
import { CARGO_TYPES } from './consignmentFormApi'
import { fetchConsignment, type TmsConsignmentDetail } from './tmsApi'
import { buildPodAttachment } from './pdf/podPdf'
import { buildPodEmailHtml, type PodEmailInput } from './podEmail'
import type { EmailParty } from './emailShared'

const CARGO_LABEL: Record<string, string> = Object.fromEntries(CARGO_TYPES.map((c) => [c.code, c.label]))
const cargoLabel = (code: string) => CARGO_LABEL[code] ?? code
const cmToM = (v: number | null) => (v == null ? null : +(v / 100).toFixed(2))
const fmtDT = (v: unknown) =>
  v ? new Date(v as string).toLocaleString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const party = (company: string | null, address: string | null, contact: string | null, phone: string | null, reference: string | null): EmailParty => ({
  company: company ?? '', address_lines: [address ?? ''].filter(Boolean), contact: contact ?? undefined, phone: phone ?? undefined, reference: reference ?? undefined,
})

function toPodInput(d: TmsConsignmentDetail): PodEmailInput {
  const x = d as { delivered_at?: string; driver1?: { first_name: string; last_name: string } | null }
  const driver = x.driver1 ? `${x.driver1.first_name ?? ''} ${x.driver1.last_name ?? ''}`.trim() : undefined
  return {
    consignment_no: d.consignment_no ?? d.id,
    delivered_date: fmtDT(x.delivered_at),
    driver,
    sender: party(d.sender_company, d.sender_address, d.sender_contact, d.sender_phone, d.reference),
    receiver: party(d.receiver_company, d.receiver_address, d.receiver_contact, d.receiver_phone, d.reference),
    cargo: (d.cargo ?? []).map((l) => ({
      qty: l.units ?? 0, description: cargoLabel(l.type),
      length_m: cmToM(l.length_cm), width_m: cmToM(l.width_cm), height_m: cmToM(l.height_cm),
      volume_m3: l.total_cube_m3, weight_kg: l.weight_kg,
    })),
  }
}

/** Emails the Proof of Delivery. Recipients default to the receiver (+ any extra POD emails);
 *  pass `recipients` to override (used by the manual "Email POD" dialog). Throws on failure. */
export async function sendPodDocEmail(
  consignment: string | TmsConsignmentDetail,
  recipients?: { to: string; cc?: string[] },
): Promise<void> {
  const d = typeof consignment === 'string' ? await fetchConsignment(consignment) : consignment
  if (!d) throw new Error('consignment not found')
  let to: string
  let cc: string[]
  if (recipients) {
    to = (recipients.to ?? '').trim()
    cc = (recipients.cc ?? []).map((e) => (e ?? '').trim()).filter(Boolean)
  } else {
    to = (d.receiver_email ?? '').trim()
    const extra = (d as { receiver_additional_emails?: string[] }).receiver_additional_emails
    cc = (Array.isArray(extra) ? extra : []).map((e) => (e ?? '').trim()).filter(Boolean)
  }
  if (!to) throw new Error('no recipient email address')

  const attachments = await buildPodAttachment(d)
  const html = buildPodEmailHtml(toPodInput(d))
  const subject = `Proof of delivery \u2014 UB Freight consignment ${d.consignment_no ?? d.id}`

  const { data, error } = await supabase.functions.invoke('tms-doc-email', {
    body: { consignment_id: d.id, to, cc, subject, html, attachments, event_code: 'TMS_POD_EMAIL' },
  })
  if (error) throw error
  const status = data as { email_status?: string; detail?: string } | null
  if (!status || status.email_status !== 'sent') throw new Error(status?.detail || 'email failed to send')
}
