// One PDF with every supplier's labels, consignment note and check-in sheet, behind an index page.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { fetchConsignment, type TmsConsignmentDetail } from '@/features/tms/tmsApi'
import { checkinSheetIdForConsignment } from '@/features/tms/checkinSheetApi'
import { renderConsignmentNotePdf, renderLabelsPdf } from '@/features/tms/pdf/consignmentPdf'
import { renderCheckinSheetPdf } from '@/features/tms/pdf/checkinPdf'
import { cargoOf, fmtNum, type EaRow } from './eaTypes'
import { supplierOf } from './eaMaster'

export type PackPart = 'labels' | 'note' | 'checkin'
type Entry = { sub: EaRow; tmsNo: string | null; parts: { kind: PackPart; title: string; first: number; pages: number }[]; missing: string[] }

const NAVY = rgb(10 / 255, 36 / 255, 114 / 255)
const GREY = rgb(0.4, 0.43, 0.48)
const TITLE: Record<PackPart, string> = { labels: 'Labels', note: 'Consignment note', checkin: 'Check-in sheet' }
const ascii = (s: string) => s.replace(/[^\x20-\x7E]/g, '')

/** Build the pack. tmsBySub maps sub booking id to its TMS consignment id. */
export async function buildMasterPack(masterRef: string, subs: EaRow[], tmsBySub: Map<string, string>, want: PackPart[] = ['labels', 'note', 'checkin']) {
  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const bold = await out.embedFont(StandardFonts.HelveticaBold)
  const index = out.addPage([595.28, 841.89]) // A4, filled in last once page numbers are known
  const entries: Entry[] = []

  for (const sub of subs) {
    const e: Entry = { sub, tmsNo: null, parts: [], missing: [] }
    entries.push(e)
    const tmsId = tmsBySub.get(sub.id)
    if (!tmsId) { e.missing.push(sub.collection_mode === 'dropoff' ? 'Drop-off, no TMS job' : 'No pickup booked'); continue }
    const d = (await fetchConsignment(tmsId)) as TmsConsignmentDetail | null
    if (!d) { e.missing.push('TMS job not found'); continue }
    e.tmsNo = d.consignment_no ?? null
    const blobs: [PackPart, Blob | null][] = []
    if (want.includes('labels')) blobs.push(['labels', await renderLabelsPdf(d).catch(() => null)])
    if (want.includes('note')) blobs.push(['note', await renderConsignmentNotePdf(d).catch(() => null)])
    if (want.includes('checkin')) {
      const sheetId = await checkinSheetIdForConsignment(tmsId).catch(() => null)
      const sheet = sheetId ? await renderCheckinSheetPdf(sheetId).catch(() => null) : null
      if (!sheet) e.missing.push('Not checked in')
      blobs.push(['checkin', sheet?.blob ?? null])
    }
    for (const [kind, blob] of blobs) {
      if (!blob) continue
      const src = await PDFDocument.load(await blob.arrayBuffer())
      const pages = await out.copyPages(src, src.getPageIndices())
      const first = out.getPageCount() + 1
      pages.forEach((p) => out.addPage(p))
      e.parts.push({ kind, title: TITLE[kind], first, pages: pages.length })
    }
  }

  // Index page
  let y = 790
  const text = (s: string, x: number, size = 9, f = font, color = rgb(0.08, 0.09, 0.1)) => index.drawText(ascii(s), { x, y, size, font: f, color })
  text('UB Freight  ·  Pickup & check-in pack', 40, 9, font, GREY); y -= 22
  text(`Main HAWB ${masterRef}`, 40, 18, bold, NAVY); y -= 18
  text(`${subs.length} supplier${subs.length === 1 ? '' : 's'}  ·  printed ${new Date().toLocaleString('en-NZ', { dateStyle: 'medium', timeStyle: 'short' })}`, 40, 9, font, GREY); y -= 30
  const cols = [40, 210, 300, 370, 440]
  ;['Supplier', 'HAWB', 'TMS job', 'Pcs · Kg', 'Included (page)'].forEach((h, i) => index.drawText(h.toUpperCase(), { x: cols[i], y, size: 7, font: bold, color: GREY }))
  y -= 8
  index.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.6, color: rgb(0.85, 0.87, 0.9) })
  y -= 16
  for (const e of entries) {
    const c = cargoOf(e.sub)
    text(supplierOf(e.sub).slice(0, 34), cols[0], 9, bold)
    text(e.sub.booking_ref, cols[1]); text(e.tmsNo ?? '-', cols[2]); text(`${fmtNum(c.pcs)} · ${fmtNum(c.kg)}`, cols[3])
    const inc = e.parts.map((p) => `${p.title} p${p.first}${p.pages > 1 ? `-${p.first + p.pages - 1}` : ''}`)
    let yy = y
    for (const line of inc.length ? inc : ['-']) { index.drawText(ascii(line), { x: cols[4], y: yy, size: 8.5, font, color: rgb(0.08, 0.09, 0.1) }); yy -= 11 }
    for (const m of e.missing) { index.drawText(ascii(m), { x: cols[4], y: yy, size: 8, font, color: rgb(0.71, 0.28, 0.03) }); yy -= 11 }
    y = Math.min(y - 18, yy - 6)
    index.drawLine({ start: { x: 40, y: y + 8 }, end: { x: 555, y: y + 8 }, thickness: 0.4, color: rgb(0.93, 0.94, 0.95) })
    if (y < 60) break
  }

  const bytes = await out.save()
  return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), fileName: `Pickup & check-in pack ${masterRef}.pdf`, entries }
}
