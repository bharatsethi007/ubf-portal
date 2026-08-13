import { supabase } from '../../supabase'

export type CarrierTable = 'shipping_lines' | 'airlines'
export type Carrier = { code: string; name: string; sort_order: number; active: boolean }

type Row = { code: string; name: string; sort_order: number | null; active: boolean | null }
const map = (r: Row): Carrier => ({ code: r.code, name: r.name, sort_order: r.sort_order ?? 0, active: r.active ?? true })

export async function fetchCarriers(table: CarrierTable, includeInactive = true): Promise<Carrier[]> {
  let q = supabase.from(table).select('code, name, sort_order, active').order('sort_order', { ascending: true })
  if (!includeInactive) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as Row[]).map(map)
}

export async function upsertCarrier(table: CarrierTable, c: Carrier): Promise<void> {
  const { error } = await supabase.from(table).upsert(
    { code: c.code, name: c.name, sort_order: c.sort_order, active: c.active },
    { onConflict: 'code' },
  )
  if (error) throw error
}

export async function deleteCarrier(table: CarrierTable, code: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('code', code)
  if (error) throw error
}

export function isFkViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23503'
}
