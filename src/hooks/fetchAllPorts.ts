import { supabase } from '../supabase'

// PostgREST caps every request at 1000 rows. Ports now holds ~27k rows
// (UN/LOCODE seaports + OurAirports), so read in parallel pages.
const PAGE = 1000

export type PortRow = {
  code: string
  name: string | null
  country_code: string | null
  lat: number | null
  lng: number | null
  is_core: boolean | null
}

type Opts = { kind?: 'sea' | 'air'; withCoordsOnly?: boolean }

function query(opts: Opts, withCount: boolean) {
  let q = supabase
    .from('ports')
    .select('code,name,country_code,lat,lng,is_core', withCount ? { count: 'exact' } : undefined)
  if (opts.kind) q = q.eq('kind', opts.kind)
  if (opts.withCoordsOnly) q = q.not('lat', 'is', null)
  // Core ports first so client-side search lists them before minor ports.
  return q.order('is_core', { ascending: false }).order('name', { ascending: true }).order('code', { ascending: true })
}

/** Reads every matching ports row, paging past the 1000-row API cap. */
export async function fetchAllPorts(opts: Opts = {}): Promise<PortRow[]> {
  const first = await query(opts, true).range(0, PAGE - 1)
  if (first.error || !first.data) return []
  const total = first.count ?? first.data.length
  const pages = []
  for (let from = PAGE; from < total; from += PAGE) {
    pages.push(query(opts, false).range(from, from + PAGE - 1))
  }
  const rest = await Promise.all(pages)
  return [first.data, ...rest.map((p) => p.data ?? [])].flat() as PortRow[]
}
