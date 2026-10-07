import { supabase } from '../../supabase'

export type PublicOption = {
  id: string; carrier: string | null; product: string | null; via: string | null
  transit_days: number | null; total: number | null; currency: string | null; valid_till: string | null; status: string
}
export type PublicQuote = {
  error?: string
  quote_no: string; customer_name: string | null; status: string; expires_at: string | null; lost_reason: string | null
  mode: string | null; type: string | null; movement: string | null; incoterms: string | null
  from_code: string | null; to_code: string | null; from_name: string | null; to_name: string | null
  owner_name: string | null; owner_email: string | null; decided: string | null
  options: PublicOption[]
}

// Customer wording -> internal lost reason.
export const DECLINE_REASONS: { label: string; value: string }[] = [
  { label: 'Price is too high', value: 'Price too high' },
  { label: 'Booked with another forwarder', value: 'Lost to competitor' },
  { label: 'Booked direct with the carrier', value: 'Customer booked direct with carrier' },
  { label: 'Transit time is too long', value: 'Transit time too long' },
  { label: 'Schedule does not suit', value: 'Schedule or space not suitable' },
  { label: 'Shipment cancelled or on hold', value: 'Shipment cancelled or on hold' },
  { label: 'Other', value: 'Other' },
]

export async function loadPublicQuote(token: string): Promise<PublicQuote> {
  const { data, error } = await supabase.rpc('quote_public_view', { p_token: token })
  if (error) throw error
  return data as PublicQuote
}

export async function respondPublicQuote(
  token: string, decision: 'accept' | 'decline', opts: { responseId?: string | null; reason?: string | null; note?: string | null },
): Promise<string> {
  const { data, error } = await supabase.rpc('quote_public_respond', {
    p_token: token, p_decision: decision, p_response: opts.responseId ?? null,
    p_reason: opts.reason ?? null, p_note: opts.note ?? null,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export function money(n: number | null, cur: string | null) {
  if (n == null) return ''
  return `${cur ?? 'NZD'} ${Number(n).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function nzDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}
