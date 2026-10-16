// Agreement types, offices and pure helpers. No Supabase import, so the PDF can use it anywhere.
export type OfficeCode = 'NZ' | 'FJ' | 'AU'
export const OFFICES: { code: OfficeCode; country: string; detail: string }[] = [
  { code: 'NZ', country: 'New Zealand', detail: 'Head office, 173 Montgomerie Road, Airport Oaks, Auckland 2022' },
  { code: 'FJ', country: 'Fiji', detail: 'Nadi, Lautoka and Suva' },
  { code: 'AU', country: 'Australia', detail: 'Sydney' },
]

export type ContactSet = { operational?: string; commercial?: string; accounts?: string; notices?: string }

export type Agreement = {
  id: string
  ref: string
  agent_id: string
  kind: 'non_exclusive' | 'exclusive'
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'void'
  effective_date: string
  expiry_date: string
  offices: OfficeCode[]
  remind_days: number
  agent_legal_name: string | null
  agent_address: string | null
  agent_company_no: string | null
  agent_territory: string | null
  signatory_name: string | null
  signatory_title: string | null
  signatory_email: string | null
  agent_contacts: ContactSet
  ubf_contacts: ContactSet
  currency: string
  credit_limit: string
  payment_terms: string
  agent_payment_terms: string | null
  profit_share: string
  insurance: string
  agent_insurance: string | null
  special_terms: string | null
  ubf_signer_id: string | null
  ubf_signer_name: string | null
  ubf_signer_title: string | null
  ubf_signed_at: string | null
  sent_at: string | null
  viewed_at: string | null
  signed_at: string | null
  agent_signature: { method?: string; name?: string; title?: string; image_key?: string | null } | null
  signed_pdf_key: string | null
  created_at: string
  updated_at: string
}

export type AgreementPatch = Partial<Omit<Agreement, 'id' | 'ref' | 'agent_id' | 'created_at' | 'updated_at'>>
export type AgreementEvent = { id: number; agreement_id: string; kind: string; detail: Record<string, unknown> | null; actor: string | null; created_at: string }

export function addYears(isoDate: string, years: number): string {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setFullYear(d.getFullYear() + years)
  d.setDate(d.getDate() - 1)
  return toIso(d)
}

export function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Fields the agent must have before sending. Missing ones the agent completes on signing. */
export const REQUIRED: { key: keyof Agreement; label: string }[] = [
  { key: 'agent_legal_name', label: 'Legal entity' },
  { key: 'agent_address', label: 'Registered address' },
  { key: 'agent_company_no', label: 'Company number' },
  { key: 'agent_territory', label: 'Territory' },
  { key: 'signatory_name', label: 'Signatory' },
  { key: 'signatory_title', label: 'Designation' },
  { key: 'signatory_email', label: 'Signatory email' },
]

export function missingFields(a: Agreement): string[] {
  const out = REQUIRED.filter((r) => !String(a[r.key] ?? '').trim()).map((r) => r.label)
  for (const k of ['operational', 'commercial', 'accounts', 'notices'] as const) {
    if (!a.agent_contacts?.[k]?.trim()) out.push(`${k[0].toUpperCase()}${k.slice(1)} contact`)
  }
  return out
}

export function filledCount(a: Agreement): string {
  const total = REQUIRED.length + 4
  return `${total - missingFields(a).length} of ${total}`
}
