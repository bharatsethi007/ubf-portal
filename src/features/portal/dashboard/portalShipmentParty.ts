import type { PortalShipmentRow } from './portalDashboardApi'
import { shipmentDirection } from './portalStatus'

export type DirectionTab = 'all' | 'import' | 'export'

export function partyColumnHeader(dirTab: DirectionTab): string {
  if (dirTab === 'import') return 'Shipper'
  if (dirTab === 'export') return 'Consignee'
  return 'Party'
}

/** Import → shipper_name; export → consignee_name (CONS_NAME1). */
export function counterpartyName(row: PortalShipmentRow): string | null {
  const dir = shipmentDirection(row)
  const name = dir === 'import' ? row.shipper_name : row.consignee_name
  return name?.trim() || null
}

export function customerRefDisplay(row: { customer_ref?: string | null }): string {
  return row.customer_ref?.trim() || '—'
}

export function freightTypeDisplay(row: { mode?: string | null; load_type?: string | null }): string {
  if (row.mode !== 'sea') return '—'
  return row.load_type ?? '—'
}
