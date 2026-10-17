import { Font, pdf } from '@react-pdf/renderer'
import type { InvoiceLine } from '../billingApi'
import type { InvoiceDoc } from './invoiceDocApi'
import InvoicePdf from './InvoicePdf'
import StatementPdf from './StatementPdf'
import { invoiceCompanyFromBrand } from './invoicePdfConfig'
import { getBranding } from '../../../../company/branding'
import type { Statement } from './statementModel'

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
  // Portal user: their customer's company. Staff: the company they are working in.
  const company = invoiceCompanyFromBrand(await getBranding())
  return pdf(<InvoicePdf doc={doc} lines={lines} logo="/ub-logo-pdf.png" company={company} />).toBlob()
}

export async function renderStatementPdf(st: Statement, asOf: string): Promise<Blob> {
  registerFonts()
  const company = invoiceCompanyFromBrand(await getBranding())
  return pdf(<StatementPdf st={st} asOf={asOf} logo="/ub-logo-pdf.png" company={company} />).toBlob()
}
