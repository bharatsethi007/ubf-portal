import { pdf } from '@react-pdf/renderer'
import type { TmsConsignmentDetail } from '../tmsApi'
import { qr, barcode } from '../consignmentDocs'
import { registerConsignmentPdfFonts } from './consignmentPdfShared'
import ConsignmentNotePdf from './ConsignmentNotePdf'
import LabelsPdf from './LabelsPdf'

const LOGO = '/ub-logo-pdf.png'
const refOf = (d: TmsConsignmentDetail) => d.consignment_no ?? d.id
const pieceCount = (d: TmsConsignmentDetail) =>
  Math.max(1, (d.cargo ?? []).reduce((t, l) => t + (l.units ?? 0), 0))

const dateSlug = () => new Date().toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })

export function noteFileName(d: TmsConsignmentDetail) { return `Consignment Note - ${refOf(d)} - ${dateSlug()}.pdf` }
export function labelsFileName(d: TmsConsignmentDetail) { return `A4 Labels - ${refOf(d)} - ${dateSlug()}.pdf` }

/** Render the Consignment Note to a PDF Blob (browser only — uses canvas for barcode). */
export async function renderConsignmentNotePdf(d: TmsConsignmentDetail): Promise<Blob> {
  registerConsignmentPdfFonts()
  const ref = refOf(d)
  const qrUrl = await qr(ref)
  const barcodeUrl = barcode(ref)
  return pdf(<ConsignmentNotePdf d={d} qrUrl={qrUrl} barcodeUrl={barcodeUrl} logoUrl={LOGO} />).toBlob()
}

/** Render the A4 Labels (one page per piece) to a PDF Blob. */
export async function renderLabelsPdf(d: TmsConsignmentDetail): Promise<Blob> {
  registerConsignmentPdfFonts()
  const ref = refOf(d)
  const total = pieceCount(d)
  const barcodeUrl = barcode(ref)
  const pieceQrUrls: string[] = []
  for (let i = 1; i <= total; i++) pieceQrUrls.push(await qr(`${ref}|${i}/${total}`))
  return pdf(<LabelsPdf d={d} pieceQrUrls={pieceQrUrls} barcodeUrl={barcodeUrl} logoUrl={LOGO} />).toBlob()
}

/** base64 (no data: prefix) — for Brevo attachment content. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(new Error('blob read failed'))
    r.readAsDataURL(blob)
  })
}

export type DocAttachment = { name: string; content: string }

/** Build the pickup email attachments (Consignment Note + A4 Labels) as base64 for tms-doc-email. */
export async function buildPickupAttachments(
  d: TmsConsignmentDetail,
  which: { labels: boolean; note: boolean },
): Promise<DocAttachment[]> {
  const out: DocAttachment[] = []
  if (which.note) out.push({ name: noteFileName(d), content: await blobToBase64(await renderConsignmentNotePdf(d)) })
  if (which.labels) out.push({ name: labelsFileName(d), content: await blobToBase64(await renderLabelsPdf(d)) })
  return out
}
