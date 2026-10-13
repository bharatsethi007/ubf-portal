import type { AirConsol, EaRow, EaView } from './eaTypes'

export type EaGroup =
  | { kind: 'consol'; key: string; consol: AirConsol; rows: EaRow[]; starred: boolean }
  | { kind: 'lane'; key: string; dest: string; rows: EaRow[] }

/**
 * Board order: starred consols, other consols by flight date, unallocated by lane, then no destination.
 * Empty consols only show in the All open and Allocated views (so planned flights stay visible).
 */
export function buildGroups(rows: EaRow[], consols: AirConsol[], stars: Set<string>, view: EaView, searching: boolean): EaGroup[] {
  const byConsol = new Map<string, EaRow[]>()
  const byLane = new Map<string, EaRow[]>()
  for (const r of rows) {
    if (r.consol_id) byConsol.set(r.consol_id, [...(byConsol.get(r.consol_id) ?? []), r])
    else {
      const k = (r.destination || '').toUpperCase() || 'UNSET'
      byLane.set(k, [...(byLane.get(k) ?? []), r])
    }
  }

  const showEmpty = !searching && (view === 'open' || view === 'allocated')
  const known = new Set(consols.map((c) => c.id))
  const consolGroups: EaGroup[] = consols
    .map((c) => ({ kind: 'consol' as const, key: `c:${c.id}`, consol: c, rows: byConsol.get(c.id) ?? [], starred: stars.has(c.id) }))
    .filter((g) => g.rows.length > 0 || showEmpty)
    .sort((a, b) => Number(b.starred) - Number(a.starred) || a.consol.flight_date.localeCompare(b.consol.flight_date) || a.consol.flight_no.localeCompare(b.consol.flight_no))

  // Bookings on a consol outside the loaded window (old or departed) still need a home
  for (const [id, list] of byConsol) {
    if (known.has(id)) continue
    const k = (list[0].destination || '').toUpperCase() || 'UNSET'
    byLane.set(k, [...(byLane.get(k) ?? []), ...list])
  }

  const laneGroups: EaGroup[] = [...byLane.entries()]
    .sort((a, b) => (a[0] === 'UNSET' ? 1 : b[0] === 'UNSET' ? -1 : b[1].length - a[1].length))
    .map(([dest, list]) => ({ kind: 'lane' as const, key: `l:${dest}`, dest, rows: list }))

  return [...consolGroups, ...laneGroups]
}
