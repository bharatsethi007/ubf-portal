import { arrivalDate, departureDate, parsePortalDate } from '../dashboard/portalShipmentDates'
import { isArrived, isInTransit, mapShipmentStatus } from '../dashboard/portalStatus'
import type { PortalShipmentDetail, TimelineMilestone } from './portalShipmentDetailTypes'

function isoDate(iso: string | null): string | null {
  if (!iso) return null
  return iso
}

/** Derived milestones until tracking_events / PortConnect exist. */
export function buildShipmentTimeline(shipment: PortalShipmentDetail): TimelineMilestone[] {
  const booked = shipment.doc_date ?? shipment.created_src?.slice(0, 10) ?? null
  const departAct = shipment.departed
  const departEst = shipment.etd
  const depart = departAct ?? departEst
  const arriveAct = shipment.arrived
  const arriveEst = arrivalDate(shipment)
  const arrive = arriveAct ?? arriveEst
  const delivered = isArrived(shipment.status) ? (arriveAct ?? arriveEst) : null

  const statusLabel = mapShipmentStatus(shipment.status).label
  const inTransitDone = Boolean(departAct) && (isInTransit(shipment.status) || Boolean(arriveAct) || isArrived(shipment.status))
  const inTransitCurrent = statusLabel === 'In Transit'

  const steps: Omit<TimelineMilestone, 'state'>[] = [
    { key: 'booked', label: 'Booked', date: isoDate(booked), estimated: false },
    {
      key: 'departed',
      label: 'Departed origin',
      date: isoDate(depart),
      estimated: !departAct && Boolean(departEst),
    },
    { key: 'transit', label: 'In transit', date: isoDate(departAct), estimated: false },
    {
      key: 'arrived',
      label: 'Arrived destination',
      date: isoDate(arrive),
      estimated: !arriveAct && Boolean(arriveEst),
    },
    {
      key: 'delivered',
      label: 'Delivered',
      date: isoDate(delivered),
      estimated: !arriveAct && isArrived(shipment.status),
    },
  ]

  let currentIdx = 0
  if (delivered) currentIdx = 4
  else if (arriveAct || statusLabel === 'At Destination') currentIdx = 3
  else if (inTransitDone || inTransitCurrent) currentIdx = 2
  else if (depart || statusLabel === 'Departure') currentIdx = 1

  return steps.map((step, i) => ({
    ...step,
    state: i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'pending',
  }))
}

export function recentTimelineUpdates(timeline: TimelineMilestone[], limit = 4): TimelineMilestone[] {
  return timeline.filter((m) => m.date).slice().reverse().slice(0, limit)
}

export function transitDays(shipment: PortalShipmentDetail): string {
  const from = parsePortalDate(departureDate(shipment))
  const to = parsePortalDate(arrivalDate(shipment))
  if (!from || !to) return '—'
  const days = Math.round((to.getTime() - from.getTime()) / 86400000)
  if (days < 0) return '—'
  return `${days} day${days === 1 ? '' : 's'}`
}
