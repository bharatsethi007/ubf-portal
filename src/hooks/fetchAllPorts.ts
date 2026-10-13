import { supabase } from '../supabase'
import { idbGet, idbSet } from '../lib/idbCache'

// All ports (~27k: UN/LOCODE seaports + OurAirports) load ONCE per browser as a single snapshot,
// shared by usePorts / useSeaPorts / useModePorts, and kept in IndexedDB. Later visits only ask
// the server for the version number and download nothing unless ports changed.

export type PortRow = {
  code: string
  name: string | null
  country_code: string | null
  lat: number | null
  lng: number | null
  is_core: boolean | null
  kind: string | null
}

type Opts = { kind?: 'sea' | 'air'; withCoordsOnly?: boolean }
type Tuple = [string, string | null, string | null, number | null, number | null, string | null, boolean | null]
type Stored = { version: number; rows: Tuple[] }

const IDB_KEY = 'ports_snapshot_v1'
const PAGE = 1000
let snapshot: Promise<PortRow[]> | null = null

const toRow = (t: Tuple): PortRow => ({ code: t[0], name: t[1], country_code: t[2], lat: t[3], lng: t[4], kind: t[5], is_core: t[6] })

async function loadSnapshot(): Promise<PortRow[]> {
  const cached = await idbGet<Stored>(IDB_KEY)
  const { data, error } = await supabase.rpc('ports_snapshot', { p_have: cached?.version ?? null })
  if (!error && data) {
    const res = data as { version: number; rows: Tuple[] | null }
    if (res.rows == null && cached) return cached.rows.map(toRow)
    if (res.rows) {
      void idbSet(IDB_KEY, { version: res.version, rows: res.rows } satisfies Stored)
      return res.rows.map(toRow)
    }
  }
  if (cached) return cached.rows.map(toRow)
  return legacyFetch()
}

// Fallback when the snapshot RPC is unavailable (e.g. SQL not applied yet): page the table.
async function legacyFetch(): Promise<PortRow[]> {
  const q = () => supabase.from('ports').select('code,name,country_code,lat,lng,is_core,kind')
    .order('is_core', { ascending: false }).order('name', { ascending: true }).order('code', { ascending: true })
  const first = await supabase.from('ports').select('code', { count: 'exact', head: true })
  const total = first.count ?? PAGE
  const pages = []
  for (let from = 0; from < total; from += PAGE) pages.push(q().range(from, from + PAGE - 1))
  const res = await Promise.all(pages)
  return res.flatMap((r) => (r.data ?? []) as PortRow[])
}

/** All matching ports, from the shared browser-cached snapshot. */
export async function fetchAllPorts(opts: Opts = {}): Promise<PortRow[]> {
  if (!snapshot) snapshot = loadSnapshot().catch(() => { snapshot = null; return [] as PortRow[] })
  const all = await snapshot
  return all.filter((r) => (!opts.kind || r.kind === opts.kind) && (!opts.withCoordsOnly || r.lat != null))
}
