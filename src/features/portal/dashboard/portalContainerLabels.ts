import type { PortalContainerRow } from './portalTradeKpi'

/** Consol grain → deduped container numbers (order preserved). */
export function buildContainerNumberMap(containers: PortalContainerRow[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  const seen = new Map<string, Set<string>>()

  for (const c of containers) {
    if (!c.consol_key || !c.c_number?.trim()) continue
    const num = c.c_number.trim()
    let ids = seen.get(c.consol_key)
    if (!ids) {
      ids = new Set()
      seen.set(c.consol_key, ids)
      map.set(c.consol_key, [])
    }
    if (ids.has(num)) continue
    ids.add(num)
    map.get(c.consol_key)!.push(num)
  }

  return map
}

export function formatContainerNumbers(numbers: string[] | undefined): string {
  if (!numbers?.length) return ''
  if (numbers.length === 1) return numbers[0]
  return `${numbers[0]} +${numbers.length - 1}`
}
