// Email builder for TMS consignment documentation (pickup: Labels + Consignment Note).
// Pure function, no deps — safe for browser or edge. Returns a full HTML email string.
// Design approved 28 Aug 2026: navy header + reversed logo, orange accent, manifest, compact steps.

const NAVY = '#0A2472'
const ORANGE = '#f5880d'
// Hosted reversed (white-letter) logo on transparent bg. Commit ub-logo-email.png to src/assets/
// (the existing ub-logo-light.png is unusable — it has the transparency checkerboard baked in).
// For production stability this can later move to the ubf-rate GitHub Pages repo or a Supabase
// public bucket — just update this one constant.
export const LOGO_URL = 'https://raw.githubusercontent.com/bharatsethi007/ubf-portal/main/src/assets/ub-logo-email.png'

export type EmailParty = {
  company: string
  address_lines: string[]
  contact?: string
  phone?: string
  reference?: string
}
export type EmailCargoLine = {
  qty: number
  description: string
  length_m?: number | null
  width_m?: number | null
  height_m?: number | null
  volume_m3?: number | null
  weight_kg?: number | null
}
export type DocEmailInput = {
  consignment_no: string
  issued_date: string        // preformatted, e.g. "28 Aug 2026"
  sender: EmailParty
  receiver: EmailParty
  cargo: EmailCargoLine[]
  special_instructions?: string
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const n2 = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? '' : v.toFixed(2))
const kg = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? '' : String(Math.round(v)))

function partyBox(label: string, p: EmailParty): string {
  const addr = p.address_lines.filter(Boolean).map(esc).join('<br>')
  const meta: string[] = []
  if (p.contact) meta.push(`Contact: ${esc(p.contact)}`)
  if (p.phone) meta.push(`Phone: ${esc(p.phone)}`)
  const ref = p.reference
    ? `<div style="font-size:12px; color:${NAVY}; font-weight:600; padding-top:8px;">Reference: ${esc(p.reference)}</div>`
    : ''
  return `
    <div style="background-color:${NAVY}; color:#ffffff; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:7px 14px;">${esc(label)}</div>
    <div style="padding:14px 14px 16px 14px;">
      <div style="font-size:14px; font-weight:700; color:#1c2233; padding-bottom:6px;">${esc(p.company)}</div>
      <div style="font-size:13px; line-height:20px; color:#3a4252;">${addr}</div>
      ${meta.length ? `<div style="font-size:12px; line-height:19px; color:#6b7280; padding-top:8px;">${meta.join('<br>')}</div>` : ''}
      ${ref}
    </div>`
}

function manifestRows(cargo: EmailCargoLine[]): string {
  const td = 'border-top:1px solid #eceef1; font-size:13px; padding:8px 8px; text-align:right; color:#6b7280;'
  return cargo.map((c) => `
    <tr>
      <td style="border-top:1px solid #eceef1; font-size:13px; color:#3a4252; padding:8px 10px; text-align:center;">${esc(c.qty)}</td>
      <td style="border-top:1px solid #eceef1; font-size:13px; color:#1c2233; font-weight:600; padding:8px 10px;">${esc(c.description)}</td>
      <td style="${td}">${n2(c.length_m)}</td>
      <td style="${td}">${n2(c.width_m)}</td>
      <td style="${td}">${n2(c.height_m)}</td>
      <td style="${td}">${n2(c.volume_m3)}</td>
      <td style="border-top:1px solid #eceef1; font-size:13px; color:#3a4252; padding:8px 10px 8px 8px; text-align:right;">${kg(c.weight_kg)}</td>
    </tr>`).join('')
}

export function buildDocEmailHtml(input: DocEmailInput): string {
  const totQty = input.cargo.reduce((t, c) => t + (Number(c.qty) || 0), 0)
  const totVol = input.cargo.reduce((t, c) => t + (Number(c.volume_m3) || 0), 0)
  const totKg = input.cargo.reduce((t, c) => t + (Number(c.weight_kg) || 0), 0)
  const hth = `background-color:${NAVY}; color:#ffffff; font-size:11px; font-weight:700; padding:9px 8px; text-align:right;`
  const steps = [
    'Print both attached documents.',
    'Check the sender and receiver addresses, item count, and descriptions are correct.',
    'Attach a label to each item securely; take care the adhesive will not damage the goods.',
    'Hand the consignment note &mdash; and any Dangerous Goods declaration &mdash; to the driver at collection.',
  ]
  const special = input.special_instructions?.trim()
    ? `
          <tr>
            <td class="px" style="padding:22px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #ecd9a6; border-left:4px solid #c9a227; background-color:#fdf8ec;">
                <tr><td style="padding:12px 16px;">
                  <div style="font-size:10px; font-weight:700; letter-spacing:1.5px; color:#8a6d00; text-transform:uppercase; padding-bottom:4px;">Special Instructions</div>
                  <div style="font-size:13px; line-height:20px; color:#5c4b12;">${esc(input.special_instructions)}</div>
                </td></tr>
              </table>
            </td>
          </tr>` : ''

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Freight documentation &mdash; UB Freight consignment ${esc(input.consignment_no)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    html, body { margin:0 !important; padding:0 !important; width:100% !important; }
    * { -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; border-collapse:collapse; }
    img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    body, table, td { font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; }
    @media only screen and (max-width:620px) {
      .container { width:100% !important; }
      .px { padding-left:22px !important; padding-right:22px !important; }
      .stack { display:block !important; width:100% !important; box-sizing:border-box !important; }
      .stack-gap { height:12px !important; line-height:12px !important; }
      .num { font-size:22px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#eceef1;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#eceef1; opacity:0;">Consignment ${esc(input.consignment_no)} &mdash; print the attached note &amp; labels, check the details, and hand the note to the driver at collection.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eceef1;">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#ffffff; border:1px solid #dcdfe4;">
        <tr><td style="background-color:${NAVY}; padding:18px 32px;">
          <img src="${LOGO_URL}" width="120" alt="UB Freight" style="display:block; width:120px; max-width:120px; height:auto; border:0;">
        </td></tr>
        <tr><td style="height:3px; background-color:${ORANGE}; font-size:0; line-height:0;">&nbsp;</td></tr>

        <tr><td class="px" style="padding:28px 32px 0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="left" valign="bottom">
              <div style="font-size:11px; font-weight:600; letter-spacing:1.5px; color:#8a93a6; text-transform:uppercase;">Consignment</div>
              <div class="num" style="font-size:26px; font-weight:700; color:${NAVY}; letter-spacing:0.5px; padding-top:4px;">${esc(input.consignment_no)}</div>
            </td>
            <td align="right" valign="bottom">
              <div style="font-size:11px; font-weight:600; letter-spacing:1.5px; color:#8a93a6; text-transform:uppercase;">Issued</div>
              <div style="font-size:14px; font-weight:600; color:#2b3242; padding-top:6px;">${esc(input.issued_date)}</div>
            </td>
          </tr></table>
        </td></tr>

        <tr><td class="px" style="padding:20px 32px 0 32px; font-size:14px; line-height:22px; color:#3a4252;">
          The freight documentation for this consignment is attached. Please print it, check that the details below are correct, attach the labels to your goods, and hand the consignment note to the driver at collection.
        </td></tr>

        <tr><td class="px" style="padding:18px 32px 0 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle" style="padding:8px 14px; border:1px solid #dcdfe4; background-color:#f6f7f9; font-size:12px; font-weight:600; color:#2b3242;"><span style="color:${NAVY};">PDF</span>&nbsp;&nbsp;Consignment Note</td>
            <td style="width:10px; font-size:0;">&nbsp;</td>
            <td valign="middle" style="padding:8px 14px; border:1px solid #dcdfe4; background-color:#f6f7f9; font-size:12px; font-weight:600; color:#2b3242;"><span style="color:${NAVY};">PDF</span>&nbsp;&nbsp;A4 Labels</td>
          </tr></table>
        </td></tr>

        <tr><td class="px" style="padding:24px 32px 0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td class="stack" valign="top" width="49%" style="width:49%; border:1px solid #dcdfe4;">${partyBox('Sender', input.sender)}</td>
            <td class="stack stack-gap" width="2%" style="width:2%; font-size:0; line-height:0;">&nbsp;</td>
            <td class="stack" valign="top" width="49%" style="width:49%; border:1px solid #dcdfe4;">${partyBox('Receiver', input.receiver)}</td>
          </tr></table>
        </td></tr>

        <tr><td class="px" style="padding:24px 32px 0 32px;">
          <div style="font-size:11px; font-weight:700; letter-spacing:1.5px; color:#8a93a6; text-transform:uppercase; padding-bottom:8px;">Manifest</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dcdfe4;">
            <tr>
              <td style="background-color:${NAVY}; color:#fff; font-size:11px; font-weight:700; padding:9px 10px; text-align:center; width:34px;">QTY</td>
              <td style="background-color:${NAVY}; color:#fff; font-size:11px; font-weight:700; padding:9px 10px; text-align:left;">DESCRIPTION</td>
              <td style="${hth}">L</td><td style="${hth}">W</td><td style="${hth}">H</td><td style="${hth}">V&nbsp;m&sup3;</td>
              <td style="${hth} padding-right:10px;">KG</td>
            </tr>
            ${manifestRows(input.cargo)}
            <tr>
              <td style="border-top:2px solid ${NAVY}; background-color:#f6f7f9; font-size:13px; font-weight:700; color:${NAVY}; padding:9px 10px; text-align:center;">${totQty}</td>
              <td style="border-top:2px solid ${NAVY}; background-color:#f6f7f9; font-size:11px; font-weight:700; letter-spacing:0.5px; color:${NAVY}; text-transform:uppercase; padding:9px 10px;">Total pieces</td>
              <td colspan="3" style="border-top:2px solid ${NAVY}; background-color:#f6f7f9;">&nbsp;</td>
              <td style="border-top:2px solid ${NAVY}; background-color:#f6f7f9; font-size:13px; font-weight:700; color:${NAVY}; padding:9px 8px; text-align:right;">${totVol.toFixed(2)}</td>
              <td style="border-top:2px solid ${NAVY}; background-color:#f6f7f9; font-size:13px; font-weight:700; color:${NAVY}; padding:9px 10px 9px 8px; text-align:right;">${Math.round(totKg)}</td>
            </tr>
          </table>
          <div style="font-size:11px; color:#9099a8; padding-top:6px;">Dimensions in metres. Volume shown per line total.</div>
        </td></tr>
        ${special}

        <tr><td class="px" style="padding:22px 32px 0 32px;">
          <div style="font-size:10px; font-weight:700; letter-spacing:1.5px; color:#8a93a6; text-transform:uppercase; padding-bottom:6px;">What to do with these documents</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${steps.map((s, i) => `<tr><td valign="top" style="width:18px; font-size:11px; font-weight:700; color:${NAVY}; padding:1px 0;">${i + 1}</td><td valign="top" style="font-size:11px; line-height:16px; color:#3a4252; padding:1px 0;">${s}</td></tr>`).join('')}
          </table>
        </td></tr>

        <tr><td class="px" style="padding:26px 32px 0 32px;"><div style="height:1px; background-color:#e6e8ec; font-size:0; line-height:0;">&nbsp;</div></td></tr>
        <tr><td class="px" style="padding:20px 32px 30px 32px;">
          <div style="font-size:13px; font-weight:700; color:${NAVY}; letter-spacing:1px;">UB FREIGHT LTD</div>
          <div style="font-size:12px; line-height:19px; color:#6b7280; padding-top:6px;">173 Montgomerie Road, M&#257;ngere, Auckland 2022<br>Phone 09 966 3850 &nbsp;&middot;&nbsp; ubfreight.com</div>
          <div style="font-size:11px; line-height:17px; color:#a2a9b5; padding-top:16px;">This email and its attachments are intended for the addressee and relate to the consignment referenced above. If you received it in error, please delete it and notify us. This is an automated message &mdash; replies are not monitored.</div>
        </td></tr>
      </table>
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
        <tr><td align="center" style="padding:16px 12px 8px 12px; font-size:11px; color:#9aa1ad;">UB Freight &middot; Pacific trade specialists</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
