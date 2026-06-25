import type { ModuleTab } from '../types/shipmentFilters'
import type { MapPortPoint, PortMap } from '../types/port'

type PortRow = {
  origin: string | null
  destination: string | null
  direction?: string | null
}

function isImportModule(tab: ModuleTab): boolean {
  return tab === 'IS' || tab === 'IA'
}

function isExportModule(tab: ModuleTab): boolean {
  return tab === 'ES' || tab === 'EA'
}

/** Which port code to plot for this row given the active module filter. */
export function portCodeForMap(row: PortRow, moduleFilter: ModuleTab | 'all'): string | null {
  if (moduleFilter !== 'all') {
    if (isImportModule(moduleFilter)) return row.origin
    if (isExportModule(moduleFilter)) return row.destination
  }

  const dir = row.direction?.toLowerCase()
  if (dir === 'import') return row.origin
  if (dir === 'export') return row.destination
  return null
}

export function buildMapPorts(
  rows: PortRow[],
  portMap: PortMap,
  moduleFilter: ModuleTab | 'all' = 'all',
): MapPortPoint[] {
  const counts = new Map<string, number>()

  for (const row of rows) {
    const code = portCodeForMap(row, moduleFilter)?.trim()
    if (!code) continue
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }

  const points: MapPortPoint[] = []
  for (const [code, count] of counts) {
    const port = portMap.get(code)
    if (!port) continue
    points.push({ code, name: port.name, lng: port.lng, lat: port.lat, count })
  }

  return points.sort((a, b) => b.count - a.count)
}
