import type { ImportSeaRow } from './types'

export type ImportSeaBoardCellKey =
  | 'eta'
  | 'atf'
  | 'last_free_day'
  | 'delivery_date'
  | 'container_return_date'
  | 'containers'
  | 'port_cleared'
  | 'line_released'

const TRACKED_KEYS: ImportSeaBoardCellKey[] = [
  'eta',
  'atf',
  'last_free_day',
  'delivery_date',
  'container_return_date',
  'port_cleared',
  'line_released',
]

function containerSignature(row: ImportSeaRow): string {
  return (row.containers ?? [])
    .map((c) => `${c.container_no ?? ''}:${c.container_type ?? ''}`)
    .join('|')
}

export function diffImportSeaBoardRow(
  before: ImportSeaRow,
  after: ImportSeaRow,
): ImportSeaBoardCellKey[] {
  const changed: ImportSeaBoardCellKey[] = []
  for (const key of TRACKED_KEYS) {
    if (before[key] !== after[key]) changed.push(key)
  }
  if (containerSignature(before) !== containerSignature(after)) {
    changed.push('containers')
  }
  return changed
}

export function formatBoardRowChangeList(keys: ImportSeaBoardCellKey[]): string {
  const labels: Record<ImportSeaBoardCellKey, string> = {
    eta: 'ETA',
    atf: 'ATF',
    last_free_day: 'LFD',
    delivery_date: 'Delivery',
    container_return_date: 'Return',
    containers: 'Containers',
    port_cleared: 'Port cleared',
    line_released: 'Line released',
  }
  return keys.map((k) => labels[k]).join(', ')
}
