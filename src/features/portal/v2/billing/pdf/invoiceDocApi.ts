import { supabase } from '../../../../../supabase'
import type { InvoiceLine } from '../billingApi'

/** Header, bill-to and shipment block for the duplicate invoice (portal_invoice_document). */
export type InvoiceDoc = {
  invoice_no: string
  doctype: string | null
  doc_date: string
  date_due: string
  currency: string
  total: number
  gst: number
  comment: string | null
  account_id: string | null
  bill_name: string | null
  bill_address: string[] | null
  our_ref: string | null
  customer_ref: string | null
  goods: string | null
  vessel: string | null
  packages: string | null
  origin: string | null
  destination: string | null
  consignee: string | null
  shipper: string | null
  ocean_bill: string | null
  house_bill: string | null
  mode: string | null
  load_type: string | null
  etd: string | null
  eta: string | null
  containers: string[]
}

export async function fetchInvoiceDoc(invoiceNo: string): Promise<InvoiceDoc> {
  const { data, error } = await supabase.rpc('portal_invoice_document', { p_invoice_no: invoiceNo })
  if (error || !data) throw new Error('Invoice could not load.')
  const d = data as InvoiceDoc
  return { ...d, total: Number(d.total) || 0, gst: Number(d.gst) || 0, containers: d.containers ?? [] }
}

/** Builds the duplicate PDF in the browser and saves it. Loads the PDF code only when asked. */
export async function downloadInvoicePdf(invoiceNo: string, lines: InvoiceLine[]): Promise<void> {
  const [doc, mod] = await Promise.all([fetchInvoiceDoc(invoiceNo), import('./renderInvoicePdf')])
  const blob = await mod.renderInvoicePdf(doc, lines)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `UB Freight invoice ${invoiceNo} (copy).pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
