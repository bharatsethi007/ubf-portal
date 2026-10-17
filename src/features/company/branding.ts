import { supabase } from '../../supabase'

/** What documents print about us: company (legal, tax, bank) + branch (address, phone, email). */
export type Brand = {
  company: string
  branch: string | null
  legal_name: string
  trading_name: string
  address: string          // multi-line, \n separated
  phone: string
  email: string
  sales_email: string
  tax_label: string
  tax_number: string
  website: string
  terms_url: string
  customs_code: string
  currency: string
  remit_to: string
  bank_name: string
  bank_swift: string
  bank_accounts: string[]
  payment_notes: string[]
  invoice_queries: string
  invoice_terms: string
}

/** NZ / AKL as printed before multi-company. Used only if the lookup fails. */
export const NZ_BRAND: Brand = {
  company: 'NZ', branch: 'AKL',
  legal_name: 'UB Freight Limited', trading_name: 'UB Freight Ltd',
  address: '173 Montgomerie Road\nAirport Oaks, Auckland 2022, New Zealand',
  phone: '+64 9 966 3850', email: 'info@ubfreight.com', sales_email: 'salessupport.nz@ubfreight.com',
  tax_label: 'GST', tax_number: '79-129-984', website: 'ubfreight.com',
  terms_url: 'https://www.ubfreight.com/terms-and-conditions/', customs_code: 'CCA 13592F', currency: 'NZD',
  remit_to: 'UB FREIGHT LIMITED, 173 MONTGOMERIE ROAD, AIRPORT OAKS, AUCKLAND, NEW ZEALAND',
  bank_name: 'ASB', bank_swift: 'ASBBNZ2A',
  bank_accounts: [
    'NZD payments to 123-062-0702589-00', 'USD payments to 26227915-(USD)-39',
    'AUD payments to 26963830-(AUD)-26', 'EUR payments to 26931548-(EUR)-27',
  ],
  payment_notes: [
    'Payments with credit card will incur a surcharge of 3%.',
    'NZ Customs levies are to be paid upfront. MPI charges will follow, if applicable.',
  ],
  invoice_queries: 'All queries must be raised within 7 days of receipt of this invoice.',
  invoice_terms:
    "All business transacted is subject to the Company's Standard Trading Conditions of Contract, a copy of which is available upon request, " +
    "and which, in certain circumstances, exclude the Company's liability and include certain indemnities which benefit the Company. E & O E.",
}

const cache = new Map<string, Promise<Brand>>()

/** Brand for a record's company + branch. Omit both for the signed-in user's company and branch. */
export function getBranding(company?: string | null, branch?: string | null): Promise<Brand> {
  const key = `${company ?? ''}|${branch ?? ''}`
  let p = cache.get(key)
  if (!p) {
    p = (async () => {
      const { data, error } = await supabase.rpc('get_branding', { p_company: company ?? null, p_branch: branch ?? null })
      if (error || !data) return NZ_BRAND
      // Server returns every field (blank when not set). Never fill one company's gaps with NZ details.
      return data as Brand
    })().catch(() => NZ_BRAND)
    cache.set(key, p)
  }
  return p
}

export const addressLines = (b: Brand) => b.address.split('\n').map((l) => l.trim()).filter(Boolean)
