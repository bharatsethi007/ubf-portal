export type CourierPieceRow = { qty: number; weightKg: number; lengthCm: number; widthCm: number; heightCm: number }

export type CourierCommodityRow = {
  description: string
  hsCode: string
  qty: number
  value: number
  currency: string
  countryOfManufacture?: string
}

export type CourierShipment = {
  id: string
  booking_ref: string | null
  quote_id: string | null
  carrier: string | null
  service: string | null
  service_code: string | null
  shipment_type: string | null
  direction: string | null
  status: string | null
  waybill_no: string | null
  pickup_confirmation: string | null
  shipper_name: string | null
  shipper_company: string | null
  shipper_is_business: boolean | null
  shipper_country: string | null
  shipper_address1: string | null
  shipper_address2: string | null
  shipper_address3: string | null
  shipper_postcode: string | null
  shipper_city: string | null
  shipper_state: string | null
  shipper_residential: boolean | null
  shipper_email: string | null
  shipper_phone: string | null
  shipper_vat: string | null
  receiver_name: string | null
  receiver_company: string | null
  receiver_is_business: boolean | null
  receiver_country: string | null
  receiver_address1: string | null
  receiver_address2: string | null
  receiver_address3: string | null
  receiver_postcode: string | null
  receiver_city: string | null
  receiver_state: string | null
  receiver_residential: boolean | null
  receiver_email: string | null
  receiver_phone: string | null
  receiver_vat: string | null
  purpose: string | null
  incoterm: string | null
  duties_paid_by: string | null
  payer_account: string | null
  declared_value: number | null
  declared_currency: string | null
  chargeable_weight: number | null
  ship_date: string | null
  pieces: unknown
  commodities: unknown
  invoice_number: string | null
  invoice_remarks: string | null
  rate_charge: number | null
  rate_currency: string | null
  label_url: string | null
  label_format: string | null
  tracking_events: unknown
  created_at: string
}

export function parsePieces(raw: unknown): CourierPieceRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map((p) => {
    const row = p as Record<string, unknown>
    return { qty: Number(row.qty) || 0, weightKg: Number(row.weightKg) || 0, lengthCm: Number(row.lengthCm) || 0, widthCm: Number(row.widthCm) || 0, heightCm: Number(row.heightCm) || 0 }
  })
}

export function parseCommodities(raw: unknown): CourierCommodityRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map((c) => {
    const row = c as Record<string, unknown>
    return { description: String(row.description ?? ''), hsCode: String(row.hsCode ?? ''), qty: Number(row.qty) || 0, value: Number(row.value) || 0, currency: String(row.currency ?? ''), countryOfManufacture: row.countryOfManufacture ? String(row.countryOfManufacture) : undefined }
  })
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return '-'
  const cur = currency ?? 'NZD'
  const n = new Intl.NumberFormat('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  return `${cur} ${n}`
}