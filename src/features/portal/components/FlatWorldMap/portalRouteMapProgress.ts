import { parsePortalDate } from '../../dashboard/portalShipmentDates'
import { isArrived, isInTransit } from '../../dashboard/portalStatus'

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/** ETD→ETA fraction for in-transit vehicle placement (portal detail map). */
export function portalRouteProgress(shipment: {
  etd?: string | null
  eta?: string | null
  departed?: string | null
  arrived?: string | null
  status?: string | null
}): number {
  if (isArrived(shipment.status) || shipment.arrived) return 1

  const start = parsePortalDate(shipment.departed ?? shipment.etd)
  const end = parsePortalDate(shipment.arrived ?? shipment.eta)
  const now = Date.now()

  if (start && end && end.getTime() > start.getTime()) {
    if (now <= start.getTime()) return 0
    if (now >= end.getTime()) return 1
    return clamp01((now - start.getTime()) / (end.getTime() - start.getTime()))
  }

  if (isInTransit(shipment.status)) return 0.5
  return 0
}

export function showTransitVehicle(status: string | null | undefined): boolean {
  return isInTransit(status)
}
