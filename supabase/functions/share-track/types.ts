// Public tracking payload. Customer-safe fields only: no client name, job #, costs or notes.

export type LngLat = [number, number]

export type Detail = { label: string; at: string | null; estimated: boolean; done: boolean }

export type Milestone = {
  key: string
  title: string
  place: string | null
  at: string | null
  estimated: boolean
  done: boolean
  current: boolean
  details: Detail[]
}

export type TrackStatus = "booked" | "sailing" | "arrived" | "released" | "delivered"

export type PublicTrack = {
  ref: string | null
  status: TrackStatus
  origin: { code: string | null; name: string | null; coord: LngLat | null }
  destination: { code: string | null; name: string | null; coord: LngLat | null }
  eta: {
    predicted: string | null
    actual: string | null
    scheduled: string | null
    delay_hours: number | null
  }
  vessel: {
    name: string | null
    voyage: string | null
    position: LngLat | null
    speed_kn: number | null
    heading: number | null
    position_at: string | null
    nm_to_go: number | null
  } | null
  containers: { no: string; type: string | null }[]
  milestones: Milestone[]
  stops: { code: string | null; name: string; coord: LngLat | null; role: "origin" | "tranship" | "destination" }[]
  track: LngLat[]
  remaining: LngLat[]
  planned: LngLat[]
  updated_at: string | null
  expires_at: string
}

export type EventRow = {
  source: string
  event_type_code: string
  event_datetime: string
  event_location: string | null
  partner_port_code: string | null
  event_value2: string | null
  is_estimated: boolean | null
  inbound_vessel_name: string | null
  inbound_vessel_imo: number | null
  received_at: string | null
}

export type CtRow = {
  container_no: string
  container_type: string | null
  iso_desc: string | null
  port_code: string | null
  discharge_port_name: string | null
  inbound_vessel_name: string | null
  operator_voyage_id: string | null
  inbound_eta: string | null
  inbound_ata: string | null
  discharged_at: string | null
  customs_release_at: string | null
  mpi_release_at: string | null
  line_release_at: string | null
  gate_out_at: string | null
  delivered_at: string | null
}
