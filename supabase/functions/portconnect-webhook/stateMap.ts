import type {
  BookingStatePatch,
  ContainerStatePatch,
  ParsedWebhookEvent,
  TrackingSettingsPatch,
} from "./types.ts"
import { normalizeEventType } from "./parseEvent.ts"
import { isLytteltonPort } from "../_shared/portconnectFields.ts"

function parseTimestamp(value: string | null, fallback: string): string {
  if (!value?.trim()) return fallback
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString()
}

function toDateOnly(iso: string): string {
  return iso.slice(0, 10)
}

function setBookingDate(
  booking: BookingStatePatch,
  overrides: Record<string, boolean>,
  field: string,
  value: string | null | undefined,
): void {
  if (!value || overrides[field]) return
  booking[field] = toDateOnly(value)
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
  overrides: Record<string, boolean>,
): void {
  const type = normalizeEventType(event.eventTypeCode)
  const at = event.eventDatetime
  const parsedValueAt = parseTimestamp(event.eventValue, at)
  const lyttelton = isLytteltonPort(event.partnerPortCode)

  container.latest_event_label = event.eventTypeCode
  container.latest_event_location = event.eventLocation
  container.latest_event_at = at
  container.source = "portconnect"
  container.updated_at = new Date().toISOString()

  switch (type) {
    case "VESSELARRIVAL":
      container.inbound_ata = at
      setBookingDate(booking, overrides, "m_eta", at)
      break
    case "DISCHARGE":
      container.discharged_at = at
      setBookingDate(booking, overrides, "discharge_date", at)
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
      if (!lyttelton) setBookingDate(booking, overrides, "last_free_day", parsedValueAt)
      break
    case "LFT24HOURS":
      container.last_free_at = parsedValueAt
      container.lft_warning = true
      if (!lyttelton) setBookingDate(booking, overrides, "last_free_day", parsedValueAt)
      break
    case "LFTEXCEEDED":
      container.last_free_at = parsedValueAt
      container.lft_overdue = true
      if (!lyttelton) setBookingDate(booking, overrides, "last_free_day", parsedValueAt)
      break
    case "VBSCHANGED":
      container.vbs_slot_at = parsedValueAt
      break
    case "GATEOUT":
      container.gate_out_at = at
      setBookingDate(booking, overrides, "delivery_date", at)
      break
    case "GATEIN":
      if (isDepotGateIn(event)) {
        setBookingDate(booking, overrides, "container_return_date", at)
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

export function webhookTaskTrigger(
  event: ParsedWebhookEvent,
): "MPIRELEASE" | "GATEOUT" | "GATEIN_DEPOT" | null {
  const type = normalizeEventType(event.eventTypeCode)
  if (type === "MPIRELEASE") return "MPIRELEASE"
  if (type === "GATEOUT") return "GATEOUT"
  if (type === "GATEIN" && isDepotGateIn(event)) return "GATEIN_DEPOT"
  return null
}

function parseOverrides(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object") return {}
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v) out[k] = true
  }
  return out
}

export async function loadBookingOverrides(
  db: import("jsr:@supabase/supabase-js@2").SupabaseClient,
  cache: Map<string, Record<string, boolean>>,
  bookingId: string,
): Promise<Record<string, boolean>> {
  const hit = cache.get(bookingId)
  if (hit) return hit
  const { data, error } = await db
    .from("bookings")
    .select("field_overrides")
    .eq("id", bookingId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const overrides = parseOverrides(data?.field_overrides)
  cache.set(bookingId, overrides)
  return overrides
}
