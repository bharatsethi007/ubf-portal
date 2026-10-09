import { supabase } from '../../supabase'

/** Customs entry (CF CUSTMAIN + TSW-derived fields), from v_customs_entries. */
export type AdviceEntry = {
  id: number
  job_unique: number
  job_kind: 'customs_only' | 'with_freight'
  account_id: string | null
  customer_name: string | null
  importer_code: string | null
  entry_number: string | null
  entry_type: string | null
  style: string | null
  nature: string | null
  vessel_flight: string | null
  port_loading: string | null
  port_discharge: string | null
  eta: string | null
  house_bill: string | null
  master_bill: string | null
  goods_desc: string | null
  packages: number | null
  pack_desc: string | null
  gross_kg: number | null
  cubic_m3: number | null
  supplier: string | null
  payment_method: string | null
  depot: string | null
  atf_code: string | null
  marks: string | null
  duty_total: number | null
  customs_status: string | null
  customs_status_label: string | null
  customs_released_at: string | null
  mpi_status: string | null
  mpi_status_label: string | null
  mpi_bio_cleared_at: string | null
  mpi_food_status: string | null
  mpi_food_status_label: string | null
  mpi_food_cleared_at: string | null
  bacc_number: string | null
  facc_number: string | null
}

export type AdviceResponse = {
  received_at: string
  agency: string | null
  status: string | null
  note: string | null
  statement: string | null
  release_at: string | null
  attachments: { category: string | null; filename: string | null }[] | null
}

export type AdviceCustomer = {
  name: string | null
  address1: string | null
  address2: string | null
  city: string | null
  postcode: string | null
}

export type ClearanceAdviceData = {
  entry: AdviceEntry
  responses: AdviceResponse[]
  labels: Record<string, string>
  customer: AdviceCustomer | null
  bookingRef: string | null
}

export async function fetchClearanceAdvice(bookingId: string, bookingRef: string | null): Promise<ClearanceAdviceData> {
  const { data: link, error: e1 } = await supabase
    .from('v_booking_customs').select('entry_id').eq('booking_id', bookingId).maybeSingle()
  if (e1) throw e1
  if (!link) throw new Error('No CyberFreight customs entry on this booking')

  const { data: entry, error: e2 } = await supabase
    .from('v_customs_entries').select('*').eq('id', link.entry_id).single()
  if (e2) throw e2
  const e = entry as AdviceEntry

  const [resp, codes, cust] = await Promise.all([
    supabase.from('customs_responses')
      .select('received_at, agency, status, note, statement, release_at, attachments')
      .eq('job_unique', e.job_unique).order('received_at').order('line'),
    supabase.from('customs_status_codes').select('code, name'),
    e.account_id
      ? supabase.from('customers').select('name, address1, address2, city, postcode').eq('account_id', e.account_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (resp.error) throw resp.error

  const labels: Record<string, string> = {}
  for (const c of (codes.data ?? []) as { code: string; name: string | null }[]) {
    if (c.name) labels[c.code] = c.name
  }
  return {
    entry: e,
    responses: (resp.data ?? []) as AdviceResponse[],
    labels,
    customer: (cust.data as AdviceCustomer | null) ?? null,
    bookingRef,
  }
}
