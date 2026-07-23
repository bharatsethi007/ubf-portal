export type TrackingSource = 'portconnect' | 'carrier'
export type SourceFilter = 'all' | 'portconnect' | 'carrier'

export type BookingTrackingSettings = {
  booking_id: string
  portconnect_enabled: boolean
  carrier_enabled: boolean
  carrier_scac: string | null
  last_portconnect_sync: string | null
  last_carrier_sync: string | null
  portconnect_error: string | null
  carrier_error: string | null
}

export type BookingTrackingPatch = Partial<
  Pick<BookingTrackingSettings, 'portconnect_enabled' | 'carrier_enabled' | 'carrier_scac'>
>

export type ContainerTrackingRow = {
  id: string
  booking_id: string
  container_no: string
  container_type: string | null
  iso_type: string | null
  iso_desc: string | null
  port_code: string | null
  container_status: string | null
  container_location: string | null
  load_port_name: string | null
  discharge_port_name: string | null
  operator_name: string | null
  operator_voyage_id: string | null
  inbound_vessel_name: string | null
  inbound_vessel_ref: string | null
  inbound_eta: string | null
  inbound_ata: string | null
  discharged_at: string | null
  line_release_at: string | null
  customs_release_at: string | null
  mpi_release_at: string | null
  gate_out_at: string | null
  vbs_slot_at: string | null
  last_free_at: string | null
  empty_return_depot_code: string | null
  empty_return_depot_name: string | null
  security_check: string | null
  hazard_count: number | null
  hazards: unknown
  stops: unknown
  source: string | null
  updated_at: string
  portconnect_last_updated: string | null
  raw: Record<string, unknown> | null
}

export type BookingTrackingEvent = {
  id: number
  subscription_event_id: number | null
  subscription_id: number | null
  subscription_container_id: number | null
  booking_id: string
  container_no: string | null
  container_visit_id: number | null
  container_visit_uri: string | null
  partner_port_code: string | null
  container_visit_type_code: string | null
  event_type_code: string
  event_datetime: string
  event_location: string | null
  event_value: string | null
  event_value2: string | null
  container_iso_type: string | null
  container_status: string | null
  inbound_vessel_ref: string | null
  inbound_vessel_name: string | null
  inbound_vessel_imo: number | null
  outbound_vessel_ref: string | null
  outbound_vessel_name: string | null
  booking_reference: string | null
  operator_scac: string | null
  source: TrackingSource | string
  received_at: string
  is_estimated?: boolean
}

export type PortConnectRefreshSummary = {
  ok?: boolean
  containers_found: number
  fields_changed: number
  events_written: number
  containers_not_recognised: string[]
  last_refreshed_at: string
  error?: string
}

export type ClearedStatus = 'cleared' | 'missing' | 'cancelled'

export type PortConnectVisitView = {
  row: ContainerTrackingRow
  port: string | null
  category: string | null
  vesselVisit: string | null
  vesselArrival: { at: string | null; kind: 'ATA' | 'ETA' | null }
  location: string | null
  status: string | null
  mtReturn: string | null
  isoLabel: string | null
  weightKg: number | null
  securityCheck: string | null
  cleared: ClearedStatus
  impedimentCount: number
  impedimentCodes: string[]
  temp: string | null
  hazardCount: number
  oversizeCount: number
  lastFreeTime: string | null
  dischargePortName: string | null
  emptyReturnDepotName: string | null
  loadPortName: string | null
}
