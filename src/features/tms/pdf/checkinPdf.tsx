import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/supabase'
import { registerConsignmentPdfFonts } from './consignmentPdfShared'
import CheckinSheetPdf, { type CheckinPdfData, type CheckinPdfLine } from './CheckinSheetPdf'

const LOGO = '/ub-logo-pdf.png'
const dateSlug = () => new Date().toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })

const SCREEN_FIELDS: { key: string; label: string }[] = [
  { key: 'known_shipper', label: 'Known shipper' }, { key: 'sufficient_packaging', label: 'Sufficient packaging' },
  { key: 'ipsm_pallet', label: 'ISPM pallet' }, { key: 'statement_of_content', label: 'Statement of content' },
  { key: 'tamper_evident_form', label: 'Tamper-evident form' }, { key: 'booking_docs_attached', label: 'Booking docs / labels' },
  { key: 'damaged', label: 'Damaged' }, { key: 'fragile', label: 'Fragile' },
  { key: 'temperature_controlled', label: 'Temperature controlled' }, { key: 'physically_scanned', label: 'Physically scanned' },
]

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(new Error('read failed')); r.readAsDataURL(blob) })
}

async function resolveReceivedBy(uid: string | null): Promise<string> {
  if (!uid) return ''
  const { data: su } = await supabase.from('staff_users').select('email').eq('user_id', uid).maybeSingle()
  const email = su?.email as string | undefined
  if (!email) return ''
  const { data: c } = await supabase.from('contacts').select('first_name,last_name').eq('email', email).maybeSingle()
  if (c?.first_name) return [c.first_name, c.last_name].filter(Boolean).join(' ')
  return email.split('@')[0]
}

async function loadPdfData(sheetId: string): Promise<{ data: CheckinPdfData; fileName: string } | null> {
  const { data, error } = await supabase.from('tms_checkin_sheets').select('*, lines:tms_checkin_sheet_lines(*)').eq('id', sheetId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const d: any = data
  const lines: CheckinPdfLine[] = (d.lines ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((l: any) => ({
    type: l.type ?? '', units: l.units, weight_kg: l.weight_kg, length_cm: l.length_cm, width_cm: l.width_cm, height_cm: l.height_cm, total_cube_m3: l.total_cube_m3,
  }))
  const scr = (v: any): 'yes' | 'no' | null => (v === 'yes' || v === 'no' ? v : null)
  const screening = SCREEN_FIELDS.map((f) => ({ label: f.label, value: scr(d[f.key]) }))

  let signatureDataUrl: string | null = null
  if (d.received_by_signature_url) {
    const { data: signed } = await supabase.storage.from('checkin').createSignedUrl(d.received_by_signature_url, 600)
    if (signed?.signedUrl) {
      try { signatureDataUrl = await blobToDataUrl(await (await fetch(signed.signedUrl)).blob()) } catch { signatureDataUrl = null }
    }
  }

  const receivedByName = await resolveReceivedBy(d.received_by ?? null)
  const pdfData: CheckinPdfData = {
    sheetNo: d.sheet_no ?? null, checkedInAt: d.checked_in_at ?? null, mode: d.mode ?? null,
    refInput: d.ref_input ?? null, reference: d.reference ?? null,
    shipperCompany: d.shipper_company ?? null, shipperAddress: d.shipper_address ?? null,
    consigneeCompany: d.consignee_company ?? null, port: d.consignee_port_country ?? null, knownCustomer: Boolean(d.known_customer),
    goodsType: d.goods_type ?? 'general', screenAt: d.screen_at ?? null, deliveredByName: d.delivered_by_name ?? null, receivedByName,
    screening, comments: d.comments ?? null, lines, signatureDataUrl,
  }
  const fileName = `Check-in Sheet - ${d.sheet_no ?? d.ref_input ?? 'sheet'} - ${dateSlug()}.pdf`
  return { data: pdfData, fileName }
}

/** Render a check-in sheet to a PDF Blob (browser only). Returns null if the sheet is missing. */
export async function renderCheckinSheetPdf(sheetId: string): Promise<{ blob: Blob; fileName: string } | null> {
  registerConsignmentPdfFonts()
  const loaded = await loadPdfData(sheetId)
  if (!loaded) return null
  const blob = await pdf(<CheckinSheetPdf data={loaded.data} logoUrl={LOGO} />).toBlob()
  return { blob, fileName: loaded.fileName }
}

/** Open the check-in PDF in a new tab. */
export async function openCheckinSheetPdf(sheetId: string): Promise<boolean> {
  const out = await renderCheckinSheetPdf(sheetId)
  if (!out) return false
  window.open(URL.createObjectURL(out.blob), '_blank', 'noopener')
  return true
}
