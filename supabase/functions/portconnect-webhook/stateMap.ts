import type {
  BookingStatePatch,
  ContainerStatePatch,
  ParsedWebhookEvent,
  TrackingSettingsPatch,
} from "./types.ts"
import { normalizeEventType } from "./parseEvent.ts"

function parseTimestamp(value: string | null, fallback: string): string {
  if (!value?.trim()) return fallback
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString()
}

function toDateOnly(iso: string): string {
  return iso.slice(0, 10)
}

function isDepotGateIn(event: ParsedWebhookEvent): boolean {
  if (normalizeEventType(event.eventTypeCode) !== "GATEIN") return false
  const hay = `${event.eventLocation ?? ""} ${event.eventValue ?? ""} ${event.eventValue2 ?? ""}`
    .toUpperCase()
  return hay.includes("DEPOT") || event.containerVisitTypeCode?.toUpperCase() === "EMPTY"
}

export function applyEventState(
  event: ParsedWebhookEvent,
  container: ContainerStatePatch,
  booking: BookingStatePatch,
  settings: TrackingSettingsPatch,
): void {
  const type = normalizeEventType(event.eventTypeCode)
  const at = event.eventDatetime
  const parsedValueAt = parseTimestamp(event.eventValue, at)

  container.latest_event_label = event.eventTypeCode
  container.latest_event_location = event.eventLocation
  container.latest_event_at = at
  container.source = "portconnect"
  container.updated_at = new Date().toISOString()

  switch (type) {
    case "VESSELARRIVAL":
      container.inbound_ata = at
      booking.m_atf = toDateOnly(at)
      break
    case "DISCHARGE":
      container.discharged_at = at
      booking.discharge_date = toDateOnly(at)
      if (event.eventValue) container.inbound_vessel_name = event.eventValue
      if (event.eventValue2) container.inbound_vessel_ref = event.eventValue2
      break
    case "DISCHARGEDNOTCLEARED":
      container.discharged_not_cleared = true
      break
    case "CUSTOMSRELEASE":
      container.customs_release_at = at
      break
    case "MPIRELEASE":
      container.mpi_release_at = at
      break
    case "LOPRELEASE":
      container.line_release_at = at
      break
    case "CLEARED":
      container.discharged_not_cleared = false
      break
    case "AVAILABLE":
      container.available_at = at
      break
    case "LFTCHANGED":
      container.last_free_at = parsedValueAt
      container.lft_warning = false
      container.lft_overdue = false
      booking.last_free_day = toDateOnly(parsedValueAt)
      break
    case "LFT24HOURS":
      container.last_free_at = parsedValueAt
      container.lft_warning = true
      booking.last_free_day = toDateOnly(parsedValueAt)
      break
    case "LFTEXCEEDED":
      container.last_free_at = parsedValueAt
      container.lft_overdue = true
      booking.last_free_day = toDateOnly(parsedValueAt)
      break
    case "VBSCHANGED":
      container.vbs_slot_at = parsedValueAt
      break
    case "GATEOUT":
      container.gate_out_at = at
      booking.delivery_date = toDateOnly(at)
      break
    case "GATEIN":
      if (isDepotGateIn(event)) {
        booking.container_return_date = toDateOnly(at)
      }
      break
    case "PINAVAILABLE":
      container.express_pin_status = event.eventValue ?? "available"
      break
    case "ACTIVE":
      settings.portconnect_enabled = true
      settings.last_portconnect_sync = new Date().toISOString()
      break
    case "AVAILABLECANCELLED":
      container.available_at = null
      break
    case "CLEAREDCANCELLED":
      break
    case "CUSTOMSRELEASECANCELLED":
      container.customs_release_at = null
      break
    case "MPIRELEASECANCELLED":
      container.mpi_release_at = null
      break
    case "LOPRELEASECANCELLED":
      container.line_release_at = null
      break
    default:
      break
  }
}

export function sortEvents(events: ParsedWebhookEvent[]): ParsedWebhookEvent[] {
  return [...events].sort((a, b) => a.eventDatetime.localeCompare(b.eventDatetime))
}
