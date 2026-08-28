import { pdf } from '@react-pdf/renderer'
import type { TmsConsignmentDetail } from '../tmsApi'
import { qr, barcode } from '../consignmentDocs'
import { registerConsignmentPdfFonts } from './consignmentPdfShared'
import { blobToBase64, type DocAttachment } from './consignmentPdf'
import ProofOfDeliveryPdf from './ProofOfDeliveryPdf'

const LOGO = '/ub-logo-pdf.png'
const refOf = (d: TmsConsignmentDetail) => d.consignment_no ?? d.id
const dateSlug = () => new Date().toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
export function podFileName(d: TmsConsignmentDetail) { return `Proof of Delivery - ${refOf(d)} - ${dateSlug()}.pdf` }

/** Render the Proof of Delivery to a PDF Blob (browser only). */
export async function renderPodPdf(d: TmsConsignmentDetail): Promise<Blob> {
  registerConsignmentPdfFonts()
  const ref = refOf(d)
  const qrUrl = await qr(ref)
  const barcodeUrl = barcode(ref)
  return pdf(<ProofOfDeliveryPdf d={d} qrUrl={qrUrl} barcodeUrl={barcodeUrl} logoUrl={LOGO} />).toBlob()
}

export async function buildPodAttachment(d: TmsConsignmentDetail): Promise<DocAttachment[]> {
  return [{ name: podFileName(d), content: await blobToBase64(await renderPodPdf(d)) }]
}
