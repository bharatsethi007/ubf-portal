import { shipmentTrackingId } from '../dashboard/portalDashboardApi'
import {
  counterpartyName,
  customerRefDisplay,
  freightTypeDisplay,
} from '../dashboard/portalShipmentParty'
import type { PortalShipmentDetail } from './portalShipmentDetailTypes'

export function shipmentDetailTitle(shipment: PortalShipmentDetail): string {
  const party = counterpartyName(shipment)
  if (party) return party
  const desc = shipment.goods_desc?.trim()
  if (desc) return desc.length > 60 ? `${desc.slice(0, 57)}…` : desc
  return `Shipment ${shipmentTrackingId(shipment)}`
}

export function displayJobNo(shipment: PortalShipmentDetail): string {
  return String(shipment.job_no ?? shipment.job_unique)
}

export function placedDate(shipment: PortalShipmentDetail): string | null {
  return shipment.doc_date ?? shipment.created_src?.slice(0, 10) ?? null
}

export function formatLoadLine(shipment: PortalShipmentDetail): string {
  const parts: string[] = []
  if (shipment.pack_qty != null) parts.push(`${Math.round(Number(shipment.pack_qty))} pcs`)
  if (shipment.weight_kg != null) parts.push(`${Math.round(Number(shipment.weight_kg))} kg`)
  if (shipment.volume_m3 != null) {
    const v = Number(shipment.volume_m3)
    parts.push(`${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10} cbm`)
  }
  return parts.join(' · ') || '—'
}

export function freightTypeLabel(shipment: PortalShipmentDetail): string {
  return freightTypeDisplay(shipment)
}

export function referenceLabel(shipment: PortalShipmentDetail): string {
  return customerRefDisplay(shipment)
}
