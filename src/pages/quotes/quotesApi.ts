import { supabase } from '../../supabase'

export type QuoteDraft = {
  shipment_mode: string | null
  shipment_type: string | null
  from_port_code: string | null
  to_port_code: string | null
  incoterms: string | null
  incoterm_place: string | null
  customer_account_id: string | null
  customer_name: string | null
  customer_po: string | null
  shipper: string | null
  consignee: string | null
  movement_type: string | null
  sales_executive_id: string | null
  pricing_executive_id: string | null
  request_received_from: string | null
  product_type: string | null
  project: string | null
  origin_location_type: string | null
  pickup_date: string | null
  pickup_location: string | null
  pickup_postal_code: string | null
  pickup_address: string | null
  dest_location_type: string | null
  delivery_date: string | null
  drop_location: string | null
  drop_postal_code: string | null
  drop_address: string | null
  cargo_value: number | null
  cargo_value_currency: string | null
  need_insurance: boolean
  need_refrigeration: boolean
  is_hazardous: boolean
  hazard_comments: string | null
  stackable: string | null
}

export type QuoteRecord = QuoteDraft & {
  id: string
  quote_no: string | null
  status: string
  created_at: string
}

export function emptyQuoteDraft(): QuoteDraft {
  return {
    shipment_mode: null,
    shipment_type: null,
    from_port_code: null,
    to_port_code: null,
    incoterms: null,
    incoterm_place: null,
    customer_account_id: null,
    customer_name: null,
    customer_po: null,
    shipper: null,
    consignee: null,
    movement_type: null,
    sales_executive_id: null,
    pricing_executive_id: null,
    request_received_from: null,
    product_type: null,
    project: null,
    origin_location_type: null,
    pickup_date: null,
    pickup_location: null,
    pickup_postal_code: null,
    pickup_address: null,
    dest_location_type: null,
    delivery_date: null,
    drop_location: null,
    drop_postal_code: null,
    drop_address: null,
    cargo_value: null,
    cargo_value_currency: 'NZD',
    need_insurance: false,
    need_refrigeration: false,
    is_hazardous: false,
    hazard_comments: null,
    stackable: null,
  }
}

export async function createQuote(draft: QuoteDraft): Promise<{ id: string; quote_no: string | null }> {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('quotes')
    .insert({ ...draft, created_by: auth.user.id })
    .select('id, quote_no')
    .single()

  if (error) throw error
  return data
}

export async function fetchQuote(id: string): Promise<QuoteRecord | null> {
  const { data, error } = await supabase.from('quotes').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as QuoteRecord | null) ?? null
}

export async function updateQuote(id: string, patch: Partial<QuoteDraft>): Promise<void> {
  const { error } = await supabase.from('quotes').update(patch).eq('id', id)
  if (error) throw error
}
