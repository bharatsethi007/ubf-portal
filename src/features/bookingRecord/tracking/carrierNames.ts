import type { BookingTrackingEvent } from './trackingTypes'

// Carrier SCAC -> friendly name (Maersk family; the only feed wired today).
const CARRIER_NAMES: Record<string, string> = {
  MAEU: 'Maersk',
  SEAU: 'Sealand',
  SUDU: 'Hamburg Süd',
}

export function carrierName(scac: string | null | undefined): string | null {
  if (!scac) return null
  const key = scac.trim().toUpperCase()
  return CARRIER_NAMES[key] ?? scac.trim()
}

/** The matched carrier, inferred from the carrier events already loaded. */
export function deriveCarrierName(events: BookingTrackingEvent[]): string | null {
  const hit = events.find((ev) => ev.source === 'carrier' && ev.operator_scac)
  return hit ? carrierName(hit.operator_scac) : null
}
