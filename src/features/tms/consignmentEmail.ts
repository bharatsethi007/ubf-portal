// Pickup documentation email (Labels + Consignment Note). Pure function, no deps.
// Uses the shared chrome in emailShared.ts.
import {
  NAVY, LOGO_URL, type EmailParty, type EmailCargoLine,
  esc, idRow, introRow, attachmentChips, partiesRow, manifestSection, wrapEmailDocument,
} from './emailShared'

export { LOGO_URL }
export type { EmailParty, EmailCargoLine }

export type DocEmailInput = {
  consignment_no: string
  issued_date: string        // preformatted, e.g. "28 Aug 2026"
  sender: EmailParty
  receiver: EmailParty
  cargo: EmailCargoLine[]
  special_instructions?: string
}

export function buildDocEmailHtml(input: DocEmailInput): string {
  const steps = [
    'Print both attached documents.',
    'Check the sender and receiver addresses, item count, and descriptions are correct.',
    'Attach a label to each item securely; take care the adhesive will not damage the goods.',
    'Hand the consignment note &mdash; and any Dangerous Goods declaration &mdash; to the driver at collection.',
  ]
  const special = input.special_instructions?.trim()
    ? `
        <tr><td class="px" style="padding:22px 32px 0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #ecd9a6; border-left:4px solid #c9a227; background-color:#fdf8ec;">
            <tr><td style="padding:12px 16px;">
              <div style="font-size:10px; font-weight:700; letter-spacing:1.5px; color:#8a6d00; text-transform:uppercase; padding-bottom:4px;">Special Instructions</div>
              <div style="font-size:13px; line-height:20px; color:#5c4b12;">${esc(input.special_instructions)}</div>
            </td></tr>
          </table>
        </td></tr>` : ''

  const inner =
    idRow(input.consignment_no, 'Issued', input.issued_date) +
    introRow('The freight documentation for this consignment is attached. Please print it, check that the details below are correct, attach the labels to your goods, and hand the consignment note to the driver at collection.') +
    attachmentChips(['Consignment Note', 'A4 Labels']) +
    partiesRow('Sender', input.sender, 'Receiver', input.receiver) +
    manifestSection(input.cargo) +
    special + `
        <tr><td class="px" style="padding:22px 32px 0 32px;">
          <div style="font-size:10px; font-weight:700; letter-spacing:1.5px; color:#8a93a6; text-transform:uppercase; padding-bottom:6px;">What to do with these documents</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${steps.map((s, i) => `<tr><td valign="top" style="width:18px; font-size:11px; font-weight:700; color:${NAVY}; padding:1px 0;">${i + 1}</td><td valign="top" style="font-size:11px; line-height:16px; color:#3a4252; padding:1px 0;">${s}</td></tr>`).join('')}
          </table>
        </td></tr>`

  return wrapEmailDocument({
    title: `Freight documentation \u2014 UB Freight consignment ${input.consignment_no}`,
    preheader: `Consignment ${input.consignment_no} — print the attached note & labels, check the details, and hand the note to the driver at collection.`,
    innerHtml: inner,
  })
}
