import type { ImportSeaRow } from './types'
import { countUnresolvedContainerConflicts } from '@/features/bookingRecord/containers/containerConflictUtils'

export type TriFilter = '' | 'yes' | 'no'

export type ImportSeaFilterState = {
  search: string
  shippingLine: string
  dischargePort: string
  portNotCleared: TriFilter
  lineNotReleased: TriFilter
  delivered: TriFilter
  onHold: TriFilter
  containerConflicts: TriFilter
  etaFrom: string
  etaTo: string
}

export const EMPTY_IMPORT_SEA_FILTERS: ImportSeaFilterState = {
  search: '',
  shippingLine: '',
  dischargePort: '',
  portNotCleared: '',
  lineNotReleased: '',
  delivered: '',
  onHold: '',
  containerConflicts: '',
  etaFrom: '',
  etaTo: '',
}

function matchesSearch(row: ImportSeaRow, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const parts = [
    row.customer_name,
    row.booking_ref,
    row.job_no,
    ...(row.containers ?? []).map((c) => c.container_no),
  ]
  return parts.some((p) => p?.toLowerCase().includes(needle))
}

function matchesTri(value: boolean | null | undefined, filter: TriFilter): boolean {
  if (!filter) return true
  const yes = Boolean(value)
  return filter === 'yes' ? yes : !yes
}

function inEtaRange(iso: string | null, from: string, to: string): boolean {
  if (!from && !to) return true
  if (!iso) return false
  const day = iso.slice(0, 10)
  if (from && day < from) return false
  if (to && day > to) return false
  return true
}

export function applyImportSeaFilters(
  rows: ImportSeaRow[],
  filters: ImportSeaFilterState,
): ImportSeaRow[] {
  const line = filters.shippingLine.trim().toLowerCase()
  const port = filters.dischargePort.trim().toLowerCase()

  return rows.filter((row) => {
    if (!matchesSearch(row, filters.search)) return false
    if (line && !row.shipping_line?.toLowerCase().includes(line)) return false
    if (port && !row.discharge_port?.toLowerCase().includes(port)) return false
    if (!matchesTri(!row.port_cleared, filters.portNotCleared)) return false
    if (!matchesTri(!row.line_released, filters.lineNotReleased)) return false
    if (!matchesTri(Boolean(row.delivery_date), filters.delivered)) return false
    if (!matchesTri(Boolean(row.hold_code), filters.onHold)) return false
    if (filters.containerConflicts === 'yes' && countUnresolvedContainerConflicts(row.containers) === 0) {
      return false
    }
    if (filters.containerConflicts === 'no' && countUnresolvedContainerConflicts(row.containers) > 0) {
      return false
    }
    if (!inEtaRange(row.eta, filters.etaFrom, filters.etaTo)) return false
    return true
  })
}

export function collectFilterOptions(rows: ImportSeaRow[]): {
  shippingLines: string[]
  dischargePorts: string[]
} {
  const lines = new Set<string>()
  const ports = new Set<string>()
  for (const row of rows) {
    if (row.shipping_line?.trim()) lines.add(row.shipping_line.trim())
    if (row.discharge_port?.trim()) ports.add(row.discharge_port.trim())
  }
  return {
    shippingLines: [...lines].sort((a, b) => a.localeCompare(b)),
    dischargePorts: [...ports].sort((a, b) => a.localeCompare(b)),
  }
}
