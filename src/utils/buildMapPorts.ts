import type { MapPortPoint, PortMap } from '../types/port'

type PortRow = { origin: string | null; destination: string | null }

export function buildMapPorts(rows: PortRow[], portMap: PortMap): MapPortPoint[] {
  const counts = new Map<string, number>()

  for (const row of rows) {
    if (row.origin) counts.set(row.origin, (counts.get(row.origin) ?? 0) + 1)
    if (row.destination) counts.set(row.destination, (counts.get(row.destination) ?? 0) + 1)
  }

  const points: MapPortPoint[] = []
  for (const [code, count] of counts) {
    const port = portMap.get(code)
    if (!port) continue
    points.push({ code, name: port.name, lng: port.lng, lat: port.lat, count })
  }

  return points.sort((a, b) => b.count - a.count)
}
