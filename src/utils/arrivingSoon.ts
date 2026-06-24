import type { Shipment } from '../types/shipment'

function weekAhead(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

export function getArrivingSoon(shipments: Shipment[], limit = 25): Shipment[] {
  const today = new Date().toISOString().slice(0, 10)
  const end = weekAhead()

  return shipments
    .filter(
      (s) =>
        s.eta &&
        s.eta >= today &&
        s.eta <= end &&
        !s.status.startsWith('Arrived'),
    )
    .sort((a, b) => (a.eta! < b.eta! ? -1 : a.eta! > b.eta! ? 1 : 0))
    .slice(0, limit)
}
