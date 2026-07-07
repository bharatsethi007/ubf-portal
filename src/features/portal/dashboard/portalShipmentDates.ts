import type { PortalShipmentRow } from './portalDashboardApi'

export function parsePortalDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Best single date for sorting / range activity (newest wins). */
export function shipmentActivityDate(r: PortalShipmentRow): number {
  const stamps = [r.eta, r.etd, r.relevant_date, r.doc_date, r.departed, r.arrived]
    .map(parsePortalDate)
    .filter((d): d is Date => d != null)
    .map((d) => d.getTime())
  return stamps.length ? Math.max(...stamps) : 0
}

export function departureDate(r: PortalShipmentRow): string | null {
  return r.etd ?? r.departed ?? r.relevant_date ?? r.doc_date ?? null
}

export function arrivalDate(r: PortalShipmentRow): string | null {
  return r.eta ?? r.arrived ?? null
}

export function dateInMonth(iso: string | null | undefined, y: number, m: number): boolean {
  const d = parsePortalDate(iso)
  if (!d) return false
  return d.getFullYear() === y && d.getMonth() === m
}
