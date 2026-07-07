import { isArrived, isAtOrigin, isBooked } from '../dashboard/portalStatus'
import type { PortalShipmentDetail, ShipmentTask } from './portalShipmentDetailTypes'

/** Derived checklist — same heuristics as dashboard Needs attention. */
export function buildShipmentTasks(shipment: PortalShipmentDetail): ShipmentTask[] {
  const today = new Date().toISOString().slice(0, 10)
  const tasks: ShipmentTask[] = []

  if (shipment.eta && shipment.eta < today && !isArrived(shipment.status)) {
    tasks.push({ id: 'overdue-eta', label: 'Overdue arrival — shipment past ETA', sev: 'high' })
  }
  if (shipment.etd && shipment.etd < today && isAtOrigin(shipment.status)) {
    tasks.push({ id: 'delayed-etd', label: 'Departure delayed — still at origin past ETD', sev: 'high' })
  }
  if (shipment.eta) {
    const days = Math.ceil((new Date(shipment.eta).getTime() - Date.now()) / 86400000)
    if (days >= 0 && days <= 3 && isBooked(shipment.status)) {
      tasks.push({ id: 'arriving-soon', label: 'Arriving soon — still booked', sev: 'med' })
    }
  }

  return tasks
}
