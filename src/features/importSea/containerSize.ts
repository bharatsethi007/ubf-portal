import type { ImportSeaContainer } from './types'

/** Nominal box length from ISO 6346 size code or legacy type: 20', 40', 45'. */
export function containerSize(c: Pick<ImportSeaContainer, 'iso_type' | 'container_type' | 'iso_desc'>): string | null {
  const iso = c.iso_type?.trim().toUpperCase() ?? ''
  if (iso) {
    if (iso[0] === '2') return "20'"
    if (iso[0] === '4') return "40'"
    if (iso[0] === 'L') return "45'"
  }
  const desc = c.iso_desc?.trim() ?? ''
  const d = desc.match(/^(20|40|45)'/)
  if (d) return `${d[1]}'`
  const t = c.container_type?.trim().toUpperCase().match(/^(20|40|45)/)
  return t ? `${t[1]}'` : null
}

/** "1×20'", "2×40' 1×20'", "3×?" when sizes are unknown. */
export function containerSizeSummary(list: ImportSeaContainer[]): string {
  const counts = new Map<string, number>()
  for (const c of list) {
    if (!c.container_no?.trim()) continue
    const s = containerSize(c) ?? '?'
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([s, n]) => `${n}×${s}`)
    .join(' ')
}
