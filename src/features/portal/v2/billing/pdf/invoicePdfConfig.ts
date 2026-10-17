import type { Brand } from '../../../../company/branding'
/** UB Freight details printed on the duplicate invoice PDF. Edit here if bank or company details change. */
export const UBF_COMPANY: InvoiceCompany = {
  name: 'UB Freight Limited',
  address: ['173 Montgomerie Road', 'Airport Oaks, Auckland 2022, New Zealand'],
  phone: '+64 9 966 3850',
  email: 'info@ubfreight.com',
  taxLabel: 'GST',
  gst: '79-129-984',
  remitTo: 'UB FREIGHT LIMITED, 173 MONTGOMERIE ROAD, AIRPORT OAKS, AUCKLAND, NEW ZEALAND',
  bank: 'ASB',
  accounts: [
    'NZD payments to 123-062-0702589-00',
    'USD payments to 26227915-(USD)-39',
    'AUD payments to 26963830-(AUD)-26',
    'EUR payments to 26931548-(EUR)-27',
  ],
  swift: 'ASBBNZ2A',
  paymentNotes: [
    'Payments with credit card will incur a surcharge of 3%.',
    'NZ Customs levies are to be paid upfront. MPI charges will follow, if applicable.',
  ],
  queries: 'All queries must be raised within 7 days of receipt of this invoice.',
  terms:
    "All business transacted is subject to the Company's Standard Trading Conditions of Contract, a copy of which is available upon request, " +
    "and which, in certain circumstances, exclude the Company's liability and include certain indemnities which benefit the Company. E & O E.",
}

export type InvoiceCompany = {
  name: string; address: string[]; phone: string; email: string; taxLabel: string; gst: string
  remitTo: string; bank: string; accounts: string[]; swift: string; paymentNotes: string[]; queries: string; terms: string
}

/** Same block, from the invoice company's branding (Setup > Companies & branches). */
export function invoiceCompanyFromBrand(b: Brand): InvoiceCompany {
  return {
    name: b.legal_name, address: b.address.split('\n').filter(Boolean), phone: b.phone, email: b.email,
    taxLabel: b.tax_label, gst: b.tax_number, remitTo: b.remit_to, bank: b.bank_name, accounts: b.bank_accounts,
    swift: b.bank_swift, paymentNotes: b.payment_notes, queries: b.invoice_queries, terms: b.invoice_terms,
  }
}
