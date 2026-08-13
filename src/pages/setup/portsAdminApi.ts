import { supabase } from '../../supabase'

export type PortKind = 'sea' | 'air'
export type Port = {
  code: string
  name: string
  lat: number | null
  lng: number | null
  kind: PortKind
  country_code: string
}

type Row = {
  code: string
  name: string | null
  lat: number | null
  lng: number | null
  kind: string | null
  country_code: string | null
}

const map = (r: Row): Port => ({
  code: r.code,
  name: r.name ?? '',
  lat: r.lat,
  lng: r.lng,
  kind: r.kind === 'air' ? 'air' : 'sea',
  country_code: (r.country_code ?? '').toUpperCase(),
})

// PostgREST .or() splits on commas/parens — strip them from user input.
function sanitize(s: string): string {
  return s.replace(/[,()]/g, ' ').trim()
}

export async function fetchPorts(opts: {
  kind: PortKind; search: string; page: number; pageSize: number
}): Promise<{ rows: Port[]; total: number }> {
  const from = (opts.page - 1) * opts.pageSize
  const to = from + opts.pageSize - 1
  let q = supabase
    .from('ports')
    .select('code,name,lat,lng,kind,country_code', { count: 'exact' })
    .eq('kind', opts.kind)
  const s = sanitize(opts.search)
  if (s) q = q.or(`code.ilike.%${s}%,name.ilike.%${s}%,country_code.ilike.%${s}%`)
  const { data, error, count } = await q.order('code', { ascending: true }).range(from, to)
  if (error) throw error
  return { rows: ((data ?? []) as Row[]).map(map), total: count ?? 0 }
}

export async function upsertPort(p: Port): Promise<void> {
  const { error } = await supabase.from('ports').upsert({
    code: p.code.trim().toUpperCase(),
    name: p.name.trim(),
    lat: p.lat,
    lng: p.lng,
    kind: p.kind,
    country_code: p.country_code.trim().toUpperCase() || null,
  }, { onConflict: 'code' })
  if (error) throw error
}

export async function deletePort(code: string): Promise<void> {
  const { error } = await supabase.from('ports').delete().eq('code', code)
  if (error) throw error
}

export function isFkViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23503'
}
