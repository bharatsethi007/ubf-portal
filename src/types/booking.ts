export type BookingModule = 'EA' | 'ES' | 'IA' | 'IS'

export type BookingSource = 'manual' | 'email_parsed' | 'email_import' | 'customer_portal'

export type BookingStatus =
  | 'draft'
  | 'submitted'
  | 'new'
  | 'parsed'
  | 'confirmed'
  | 'sli_requested'
  | 'sli_received'
  | 'xml_ready'
  | 'entered'
  | 'synced'
  | 'rejected'

export type BookingServiceType = 'door-door' | 'door-port' | 'port-door' | 'port-port'

export type Booking = {
  id: string
  booking_ref: string
  module: BookingModule
  source: BookingSource
  status: BookingStatus
  account_id: string | null
  is_consolidation: boolean
  importer_name: string | null
  importer_account_id: string | null
  origin: string | null
  destination: string | null
  etd: string | null
  eta: string | null
  cargo_ready_date?: string | null
  vessel_flight: string | null
  container_type: string | null
  container_count: number | null
  weight_kg: number | null
  volume_m3: number | null
  source_payload: Record<string, unknown> | null
  job_unique: number | null
  created_at: string
  updated_at: string

  // Route
  airline?: string
  airline_name?: string
  flight_no?: string
  vessel?: string
  voyage?: string

  // Shipper address
  shipper_address?: string
  shipper_city?: string
  shipper_country?: string
  shipper_phone?: string
  shipper_email?: string

  // Consignee
  consignee_account_id?: string | null
  /** First supplier account on list rows (export shipper). */
  shipper_account_id?: string | null
  consignee_name?: string
  consignee_address?: string
  consignee_city?: string
  consignee_country?: string
  consignee_phone?: string
  consignee_email?: string

  // Cargo
  pieces?: number
  gross_weight_kg?: number
  length_cm?: number
  width_cm?: number
  height_cm?: number
  cbm?: number
  chargeable_weight_kg?: number
  commodity?: string
  packing_type?: string
  goods_description?: string

  // Special handling
  is_dg: boolean
  un_number?: string
  dg_class?: string
  is_temp_controlled: boolean
  temp_range?: string
  is_valuable: boolean
  is_oog: boolean
  special_instructions?: string

  // Service & docs
  service_type?: BookingServiceType
  incoterm?: string
  hawb?: string
  mawb?: string

  // Notify party
  notify_name?: string
  notify_address?: string
  notify_country?: string
}

export type BookingSupplier = {
  id: string
  booking_id: string
  ord: number
  supplier_name: string | null
  supplier_account_id: string | null
  pickup_location: string | null
  po_number: string | null
  commodity: string | null
  weight_kg: number | null
  volume_m3: number | null

  supplier_address?: string
  supplier_city?: string
  supplier_country?: string
  supplier_phone?: string
  supplier_email?: string
  pieces?: number
  gross_weight_kg?: number
  cbm?: number
  goods_description?: string
}

type ModuleConfig = {
  label: string
  mode: 'air' | 'sea'
  direction: 'export' | 'import'
  portKind: 'IATA' | 'UNLOCODE'
  portLen: number
}

export const MODULE_CONFIG: Record<BookingModule, ModuleConfig> = {
  EA: { label: 'Export Air', mode: 'air', direction: 'export', portKind: 'IATA', portLen: 3 },
  ES: { label: 'Export Sea', mode: 'sea', direction: 'export', portKind: 'UNLOCODE', portLen: 5 },
  IA: { label: 'Import Air', mode: 'air', direction: 'import', portKind: 'IATA', portLen: 3 },
  IS: { label: 'Import Sea', mode: 'sea', direction: 'import', portKind: 'UNLOCODE', portLen: 5 },
}

/** TradeWindow module codes for RPCs (EA → FEA, etc.) */
export const TW_MODULE_CODE: Record<BookingModule, string> = {
  EA: 'FEA',
  ES: 'FES',
  IA: 'FIA',
  IS: 'FIS',
}

export function bookingModuleToTwCode(module: BookingModule): string {
  return TW_MODULE_CODE[module]
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  new: 'New',
  parsed: 'Parsed',
  confirmed: 'Confirmed',
  sli_requested: 'SLI requested',
  sli_received: 'SLI received',
  xml_ready: 'XML ready',
  entered: 'Entered',
  synced: 'Synced',
  rejected: 'Rejected',
}

export function isUntouched(b: Pick<Booking, 'source' | 'status'>): boolean {
  return b.source === 'customer_portal' && (b.status === 'new' || b.status === 'parsed')
}
