import { supabase } from '../../supabase'

export type ChargeGroup = {
  code: string
  label: string
  sort_order: number
  active: boolean
}

export type ChargeCode = {
  code: string
  description: string
  charge_group: string
  sort_order: number
  active: boolean
}

type GroupRow = {
  code: string
  label: string
  sort_order: number | null
  active: boolean | null
}

type CodeRow = {
  code: string
  description: string
  charge_group: string
  sort_order: number | null
  active: boolean | null
}

function mapGroup(row: GroupRow): ChargeGroup {
  return {
    code: row.code,
    label: row.label,
    sort_order: row.sort_order ?? 0,
    active: row.active ?? true,
  }
}

function mapCode(row: CodeRow): ChargeCode {
  return {
    code: row.code,
    description: row.description,
    charge_group: row.charge_group,
    sort_order: row.sort_order ?? 0,
    active: row.active ?? true,
  }
}

export async function fetchChargeGroups(includeInactive = false): Promise<ChargeGroup[]> {
  let query = supabase
    .from('charge_groups')
    .select('code, label, sort_order, active')
    .order('sort_order', { ascending: true })
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as GroupRow[]).map(mapGroup)
}

export async function fetchChargeCodes(includeInactive = false): Promise<ChargeCode[]> {
  let query = supabase
    .from('charge_codes')
    .select('code, description, charge_group, sort_order, active')
    .order('charge_group', { ascending: true })
    .order('sort_order', { ascending: true })
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as CodeRow[]).map(mapCode)
}

export async function upsertChargeGroup(group: ChargeGroup): Promise<void> {
  const { error } = await supabase.from('charge_groups').upsert(
    {
      code: group.code,
      label: group.label,
      sort_order: group.sort_order,
      active: group.active,
    },
    { onConflict: 'code' },
  )
  if (error) throw error
}

export async function upsertChargeCode(code: ChargeCode): Promise<void> {
  const { error } = await supabase.from('charge_codes').upsert(
    {
      code: code.code,
      description: code.description,
      charge_group: code.charge_group,
      sort_order: code.sort_order,
      active: code.active,
    },
    { onConflict: 'code' },
  )
  if (error) throw error
}

export async function deleteChargeGroup(code: string): Promise<void> {
  const { error } = await supabase.from('charge_groups').delete().eq('code', code)
  if (error) throw error
}

export async function deleteChargeCode(code: string): Promise<void> {
  const { error } = await supabase.from('charge_codes').delete().eq('code', code)
  if (error) throw error
}

export function isFkViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23503'
}

export async function createChargeCodeAuto(description: string, charge_group: string): Promise<ChargeCode> {
  const clean = description.trim()
  const base = (clean.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8)) || 'CHG'
  let code = base
  for (let i = 2; i <= 50; i++) {
    const { data } = await supabase.from('charge_codes').select('code').eq('code', code).maybeSingle()
    if (!data) break
    code = `${base}${i}`
  }
  const { data, error } = await supabase.from('charge_codes')
    .insert({ code, description: clean, charge_group, sort_order: 0, active: true })
    .select('code,description,charge_group,sort_order,active')
    .single()
  if (error) throw error
  return mapCode(data as CodeRow)
}
