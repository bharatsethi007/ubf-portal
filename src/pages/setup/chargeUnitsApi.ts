import { supabase } from '../../supabase'

export type UnitMode = 'air' | 'sea'

export type ChargeUnitRow = {
  code: string
  label: string
  sort_order: number
  active: boolean
  modes: UnitMode[]
}

type Row = { code: string; label: string | null; sort_order: number | null; active: boolean | null; modes: string[] | null }

const mapRow = (r: Row): ChargeUnitRow => ({
  code: r.code,
  label: r.label ?? r.code,
  sort_order: r.sort_order ?? 0,
  active: r.active ?? true,
  modes: (r.modes ?? ['air', 'sea']).filter((m): m is UnitMode => m === 'air' || m === 'sea'),
})

/** All units, inactive included (Setup only; pickers use useChargeUnits). */
export async function fetchChargeUnits(): Promise<ChargeUnitRow[]> {
  const { data, error } = await supabase
    .from('charge_units')
    .select('code, label, sort_order, active, modes')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return ((data ?? []) as Row[]).map(mapRow)
}

export async function upsertChargeUnit(u: ChargeUnitRow): Promise<void> {
  const { error } = await supabase.from('charge_units').upsert({
    code: u.code,
    label: u.label.trim(),
    sort_order: u.sort_order,
    active: u.active,
    modes: u.modes,
  }, { onConflict: 'code' })
  if (error) throw error
}

/** "Per Pallet" -> "per_pallet". Quote lines store this code, so it never changes after creation. */
export function unitCodeFromLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}
