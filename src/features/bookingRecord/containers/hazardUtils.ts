export type PortConnectHazard = {
  unNumber?: string | null
  un_number?: string | null
  description?: string | null
  hazardDescription?: string | null
  class?: string | null
  hazardClass?: string | null
  classCode?: string | null
}

export function normalizeHazards(raw: unknown): PortConnectHazard[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((h) => h && typeof h === 'object') as PortConnectHazard[]
}

export function hazardCountFromList(hazards: PortConnectHazard[], fallback = 0): number {
  return hazards.length > 0 ? hazards.length : fallback
}

export function hazardTooltipLines(hazards: PortConnectHazard[]): string[] {
  return hazards.map((h) => {
    const un = h.unNumber ?? h.un_number ?? '—'
    const desc = h.description ?? h.hazardDescription ?? 'Hazardous cargo'
    const cls = h.class ?? h.hazardClass ?? h.classCode ?? '—'
    return `UN ${un} · ${desc} · Class ${cls}`
  })
}

export function hazardTooltipText(hazards: PortConnectHazard[], count?: number): string | null {
  const list = normalizeHazards(hazards)
  const n = count ?? list.length
  if (n <= 0 && !list.length) return null
  const lines = hazardTooltipLines(list)
  if (!lines.length) return n > 0 ? `${n} hazardous container${n === 1 ? '' : 's'}` : null
  return lines.join('\n')
}
