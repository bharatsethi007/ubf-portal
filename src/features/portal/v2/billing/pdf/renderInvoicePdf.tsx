import { Font, pdf } from '@react-pdf/renderer'
import type { InvoiceLine } from '../billingApi'
import type { InvoiceDoc } from './invoiceDocApi'
import InvoicePdf from './InvoicePdf'

let fonts = false
function registerFonts() {
  if (fonts) return
  fonts = true
  Font.register({ family: 'General Sans', fonts: [
    { src: '/fonts/pdf/GeneralSans-400.ttf', fontWeight: 400 },
    { src: '/fonts/pdf/GeneralSans-500.ttf', fontWeight: 500 },
    { src: '/fonts/pdf/GeneralSans-600.ttf', fontWeight: 600 },
    { src: '/fonts/pdf/GeneralSans-700.ttf', fontWeight: 700 },
  ] })
  Font.registerHyphenationCallback((w) => [w])
}

export async function renderInvoicePdf(doc: InvoiceDoc, lines: InvoiceLine[]): Promise<Blob> {
  registerFonts()
  return pdf(<InvoicePdf doc={doc} lines={lines} logo="/ub-logo-pdf.png" />).toBlob()
}
