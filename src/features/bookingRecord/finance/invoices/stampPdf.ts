import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { BookingMeta, CreditorInvoice, InvoiceEvent } from './creditorInvoicesApi'

const GREEN = rgb(0.05, 0.5, 0.25)
const RED = rgb(0.78, 0.1, 0.1)
const INK = rgb(0.1, 0.12, 0.16)
const MUTED = rgb(0.4, 0.45, 0.5)

// Standard fonts are WinAnsi only. Strip anything outside Latin-1.
const safe = (s: string) => s.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\xFF]/g, '')

export function nzDateTime(iso: string | Date): string {
  return new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}
export function nzDate(iso: string): string {
  return new Intl.DateTimeFormat('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${iso}T00:00:00`))
}

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const out: string[] = []
  let line = ''
  for (const w of safe(text).split(/\s+/)) {
    const t = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(t, size) > max && line) { out.push(line); line = w } else line = t
  }
  if (line) out.push(line)
  return out
}

async function loadSource(bytes: Uint8Array, mime: string | null): Promise<PDFDocument> {
  if (!mime || mime === 'application/pdf') return PDFDocument.load(bytes, { ignoreEncryption: true })
  const doc = await PDFDocument.create()
  const img = /png/i.test(mime) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
  const page = doc.addPage([595.28, 841.89])
  const s = Math.min((595.28 - 40) / img.width, (841.89 - 40) / img.height, 1)
  page.drawImage(img, { x: (595.28 - img.width * s) / 2, y: 841.89 - 20 - img.height * s, width: img.width * s, height: img.height * s })
  return doc
}

function drawStamp(page: PDFPage, bold: PDFFont, reg: PDFFont, inv: CreditorInvoice, meta: BookingMeta) {
  const W = 220, pad = 8
  const color = inv.urgent ? RED : GREEN
  const rows: { t: string; f: PDFFont; s: number; c: ReturnType<typeof rgb> }[] = [
    { t: 'APPROVED', f: bold, s: 14, c: color },
  ]
  if (inv.urgent) rows.push({ t: 'URGENT', f: bold, s: 12, c: RED })
  rows.push(
    { t: `By: ${inv.approved_by_name ?? '-'}`, f: reg, s: 8.5, c: INK },
    { t: `On: ${inv.approved_at ? nzDateTime(inv.approved_at) : '-'} NZT`, f: reg, s: 8.5, c: INK },
    { t: `Pay by: ${inv.pay_by ? nzDate(inv.pay_by) : '-'}`, f: bold, s: 9.5, c: inv.urgent ? RED : INK },
    { t: `Job: ${meta.booking_ref ?? '-'}`, f: reg, s: 8.5, c: INK },
  )
  if (inv.approval_comment) for (const l of wrap(`Comment: ${inv.approval_comment}`, reg, 8.5, W - pad * 2).slice(0, 5)) rows.push({ t: l, f: reg, s: 8.5, c: INK })
  if (inv.version > 1) rows.push({ t: `Version ${inv.version}. Changes on last page.`, f: reg, s: 7.5, c: MUTED })

  const H = rows.reduce((h, r) => h + r.s + 3, pad * 2)
  const { width, height } = page.getSize()
  const x = width - W - 18, y = height - H - 18
  page.drawRectangle({ x, y, width: W, height: H, color: rgb(1, 1, 1), opacity: 0.93, borderColor: color, borderWidth: 1.6 })
  let cy = y + H - pad
  for (const r of rows) { cy -= r.s; page.drawText(safe(r.t), { x: x + pad, y: cy, size: r.s, font: r.f, color: r.c }); cy -= 3 }
}

const ACTION_LABEL: Record<string, string> = {
  received: 'Received', read: 'Read by AI', approved: 'Approved', modified: 'Modified', disputed: 'Disputed',
  reopened: 'Reopened', stamped: 'Stamped', sent: 'Sent to accounts',
}

function detailText(e: InvoiceEvent): string {
  const d = e.detail ?? {}
  if (e.action === 'modified') {
    return Object.entries(d).map(([k, v]) => {
      const c = v as { from: unknown; to: unknown }
      return `${k.replace(/_/g, ' ')}: ${c?.from ?? '-'} -> ${c?.to ?? '-'}`
    }).join('; ')
  }
  if (e.action === 'approved') return `pay by ${d.pay_by ?? '-'}${d.urgent ? ', urgent' : ''}${d.comment ? `, "${d.comment}"` : ''}`
  if (e.action === 'disputed') return String(d.reason ?? '')
  if (e.action === 'sent') return String(d.to ?? '')
  return ''
}

function drawHistory(doc: PDFDocument, bold: PDFFont, reg: PDFFont, inv: CreditorInvoice, meta: BookingMeta, events: InvoiceEvent[]) {
  let page = doc.addPage([595.28, 841.89])
  let y = 800
  page.drawText('Change history', { x: 40, y, size: 16, font: bold, color: INK })
  y -= 18
  page.drawText(safe(`${inv.vendor_name ?? ''} ${inv.invoice_no ?? ''} | Job ${meta.booking_ref ?? ''} | Version ${inv.version}`), { x: 40, y, size: 9, font: reg, color: MUTED })
  y -= 24
  for (const e of events.filter((ev) => ev.action !== 'read' && ev.action !== 'stamped')) {
    const head = `${nzDateTime(e.created_at)}  ${ACTION_LABEL[e.action] ?? e.action}  ${e.actor_name ?? ''}`
    const lines = wrap(detailText(e), reg, 9, 500)
    if (y - 14 - lines.length * 12 < 40) { page = doc.addPage([595.28, 841.89]); y = 800 }
    page.drawText(safe(head), { x: 40, y, size: 9.5, font: bold, color: INK }); y -= 13
    for (const l of lines) { page.drawText(l, { x: 52, y, size: 9, font: reg, color: INK }); y -= 12 }
    y -= 6
  }
}

export async function stampInvoice(src: Uint8Array, mime: string | null, inv: CreditorInvoice, meta: BookingMeta, events: InvoiceEvent[]): Promise<Uint8Array> {
  const doc = await loadSource(src, mime)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const reg = await doc.embedFont(StandardFonts.Helvetica)
  const first = doc.getPage(0)
  drawStamp(first, bold, reg, inv, meta)
  if (events.some((e) => e.action === 'modified')) drawHistory(doc, bold, reg, inv, meta, events)
  doc.setTitle(safe(`Approved ${inv.vendor_name ?? ''} ${inv.invoice_no ?? ''}`))
  return doc.save()
}
