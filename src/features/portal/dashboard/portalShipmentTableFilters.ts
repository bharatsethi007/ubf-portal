import type { PortalShipmentRow } from './portalDashboardApi'
import { shipmentActivityDate } from './portalShipmentDates'
import { isArrived, shipmentDirection, tabMatchesStatus } from './portalStatus'
import type { DirectionTab } from './portalShipmentParty'

export type StatusTab = 'All' | 'In Transit' | 'Arriving' | 'Departing'
export type ModeTab = 'All' | 'Air' | 'Sea'

export const DIRECTION_TABS: { key: DirectionTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'import', label: 'Imports' },
  { key: 'export', label: 'Exports' },
]

export const STATUS_TABS: StatusTab[] = ['All', 'In Transit', 'Arriving', 'Departing']

export const MODE_TABS: ModeTab[] = ['All', 'Air', 'Sea']

export const PAGE_SIZE = 10

function matchesDirection(row: PortalShipmentRow, dirTab: DirectionTab): boolean {
  if (dirTab === 'all') return true
  return shipmentDirection(row) === dirTab
}

function matchesMode(row: PortalShipmentRow, modeTab: ModeTab): boolean {
  if (modeTab === 'All') return true
  return (row.mode ?? '').toLowerCase() === modeTab.toLowerCase()
}

export function filterShipments(
  rows: PortalShipmentRow[],
  dirTab: DirectionTab,
  statusTab: StatusTab,
  modeTab: ModeTab,
): PortalShipmentRow[] {
  return rows
    .filter((r) => matchesDirection(r, dirTab))
    .filter((r) => tabMatchesStatus(statusTab, r.status))
    .filter((r) => matchesMode(r, modeTab))
    .sort((a, b) => {
      const aDone = isArrived(a.status) ? 1 : 0
      const bDone = isArrived(b.status) ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      return shipmentActivityDate(b) - shipmentActivityDate(a)
    })
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize
  return rows.slice(start, start + pageSize)
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}
