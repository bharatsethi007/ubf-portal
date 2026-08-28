// Orchestrates the pickup documentation email: builds the PDFs (client-side) + the
// approved HTML, then posts to the staff-gated `tms-doc-email` edge function.
import { supabase } from '@/supabase'
import { CARGO_TYPES } from './consignmentFormApi'
import { fetchConsignment, type TmsConsignmentDetail } from './tmsApi'
import { buildPickupAttachments } from './pdf/consignmentPdf'
import { buildDocEmailHtml, type DocEmailInput } from './consignmentEmail'

const CARGO_LABEL: Record<string, string> = Object.fromEntries(CARGO_TYPES.map((c) => [c.code, c.label]))
const cargoLabel = (code: string) => CARGO_LABEL[code] ?? code
const cmToM = (v: number | null) => (v == null ? null : +(v / 100).toFixed(2))
const fmtNZ = (v: unknown) =>
  new Date((v as string) || Date.now()).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })

function toEmailInput(d: TmsConsignmentDetail): DocEmailInput {
  const ref = d.reference ?? undefined
  return {
    consignment_no: d.consignment_no ?? d.id,
    issued_date: fmtNZ((d as { created_at?: string }).created_at),
    sender: {
      company: d.sender_company ?? '',
      address_lines: [d.sender_address ?? ''].filter(Boolean),
      contact: d.sender_contact ?? undefined,
      phone: d.sender_phone ?? undefined,
      reference: ref,
    },
    receiver: {
      company: d.receiver_company ?? '',
      address_lines: [d.receiver_address ?? ''].filter(Boolean),
      contact: d.receiver_contact ?? undefined,
      phone: d.receiver_phone ?? undefined,
      reference: ref,
    },
    cargo: (d.cargo ?? []).map((l) => ({
      qty: l.units ?? 0,
      description: cargoLabel(l.type),
      length_m: cmToM(l.length_cm),
      width_m: cmToM(l.width_cm),
      height_m: cmToM(l.height_cm),
      volume_m3: l.total_cube_m3,
      weight_kg: l.weight_kg,
    })),
    special_instructions: d.delivery_instructions ?? undefined,
  }
}

/** Emails the Consignment Note and/or A4 Labels. Recipients default to the sender (+ any extra
 *  sender emails); pass `recipients` to override (used by the job-details email dialog). Throws on failure. */
export async function sendPickupDocsEmail(
  consignment: string | TmsConsignmentDetail,
  which: { labels: boolean; note: boolean },
  recipients?: { to: string; cc?: string[] },
): Promise<void> {
  if (!which.labels && !which.note) return
  const d = typeof consignment === 'string' ? await fetchConsignment(consignment) : consignment
  if (!d) throw new Error('consignment not found')
  let to: string
  let cc: string[]
  if (recipients) {
    to = (recipients.to ?? '').trim()
    cc = (recipients.cc ?? []).map((e) => (e ?? '').trim()).filter(Boolean)
  } else {
    to = (d.sender_email ?? '').trim()
    const extra = (d as { sender_additional_emails?: string[] }).sender_additional_emails
    cc = (Array.isArray(extra) ? extra : []).map((e) => (e ?? '').trim()).filter(Boolean)
  }
  if (!to) throw new Error('no recipient email address')

  const attachments = await buildPickupAttachments(d, which)
  const html = buildDocEmailHtml(toEmailInput(d))
  const subject = `Freight documentation \u2014 UB Freight consignment ${d.consignment_no ?? d.id}`

  const { data, error } = await supabase.functions.invoke('tms-doc-email', {
    body: { consignment_id: d.id, to, cc, subject, html, attachments },
  })
  if (error) throw error
  const status = (data as { email_status?: string; detail?: string } | null)
  if (!status || status.email_status !== 'sent') throw new Error(status?.detail || 'email failed to send')
}
