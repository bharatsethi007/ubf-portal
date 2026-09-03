import { supabase } from '../../../supabase'

export type AirLocalChargeSheetDetail = {
  id: string
  title: string | null
  direction: string
  movement: string
  airport_codes: string[]
  airline_codes: string[]
  valid_from: string | null
  valid_to: string | null
  status: string
}

// charge_codes use 'origin' | 'freight' | 'destination'; sheets use 'origin' | 'dest'.
export function groupForDirection(direction: string): string {
  return direction === 'dest' ? 'destination' : 'origin'
}

export async function fetchAirLocalChargeSheet(id: string): Promise<AirLocalChargeSheetDetail | null> {
  const { data, error } = await supabase
    .from('air_local_charge_sheets')
    .select('id, title, direction, movement, airport_codes, airline_codes, valid_from, valid_to, status')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as Record<string, any>
  return {
    id: String(r.id),
    title: r.title ? String(r.title) : null,
    direction: String(r.direction),
    movement: String(r.movement),
    airport_codes: Array.isArray(r.airport_codes) ? r.airport_codes.map(String) : [],
    airline_codes: Array.isArray(r.airline_codes) ? r.airline_codes.map(String) : [],
    valid_from: r.valid_from ? String(r.valid_from) : null,
    valid_to: r.valid_to ? String(r.valid_to) : null,
    status: String(r.status),
  }
}

export type AirLocalChargeHeaderPatch = {
  title: string | null
  direction: string
  movement: string
  airport_codes: string[]
  airline_codes: string[]
  valid_from: string | null
  valid_to: string | null
  status: string
}

export async function updateAirLocalChargeSheetHeader(id: string, p: AirLocalChargeHeaderPatch): Promise<void> {
  const { error } = await supabase
    .from('air_local_charge_sheets')
    .update({
      title: p.title || null,
      direction: p.direction,
      movement: p.movement,
      airport_codes: p.airport_codes,
      airline_codes: p.airline_codes,
      valid_from: p.valid_from || null,
      valid_to: p.valid_to || null,
      status: p.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export type AirLocalChargeLineDraft = {
  key: string
  dbId: string | null
  charge_code: string
  label: string
  basis: string
  buy_amount: string
  buy_currency: string
  sell_amount: string
  sell_currency: string
  min_buy: string
  min_sell: string
  vendor_account_id: string
  vendor_name: string
  condition: string
}

export async function listAirLocalChargeLines(sheetId: string): Promise<AirLocalChargeLineDraft[]> {
  const { data, error } = await supabase
    .from('air_local_charge_lines')
    .select('id, charge_code, label, basis, buy_amount, buy_currency, sell_amount, sell_currency, min_buy, min_sell, vendor_account_id, vendor_name, condition')
    .eq('sheet_id', sheetId)
    .order('ord', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data as Record<string, any>[]) ?? []).map((r) => ({
    key: String(r.id),
    dbId: String(r.id),
    charge_code: r.charge_code ? String(r.charge_code) : '',
    label: r.label ? String(r.label) : '',
    basis: r.basis ? String(r.basis) : 'per_kg',
    buy_amount: r.buy_amount == null ? '' : String(r.buy_amount),
    buy_currency: r.buy_currency ? String(r.buy_currency) : '',
    sell_amount: r.sell_amount == null ? '' : String(r.sell_amount),
    sell_currency: r.sell_currency ? String(r.sell_currency) : '',
    min_buy: r.min_buy == null ? '' : String(r.min_buy),
    min_sell: r.min_sell == null ? '' : String(r.min_sell),
    vendor_account_id: r.vendor_account_id ? String(r.vendor_account_id) : '',
    vendor_name: r.vendor_name ? String(r.vendor_name) : '',
    condition: r.condition ? String(r.condition) : '',
  }))
}

export async function saveAirLocalChargeLines(
  sheetId: string,
  rows: AirLocalChargeLineDraft[],
  originalIds: string[],
  chargeGroup: string,
): Promise<void> {
  const keptIds = new Set(rows.filter((r) => r.dbId).map((r) => r.dbId as string))
  const toDelete = originalIds.filter((id) => !keptIds.has(id))
  if (toDelete.length) {
    const { error } = await supabase.from('air_local_charge_lines').delete().in('id', toDelete)
    if (error) throw error
  }

  const num = (s: string) => (s === '' || isNaN(Number(s)) ? null : Number(s))
  let ord = 0
  for (const r of rows) {
    ord += 1
    const payload = {
      sheet_id: sheetId,
      ord,
      charge_code: r.charge_code.trim() || null,
      label: r.label.trim(),
      charge_group: chargeGroup,
      basis: r.basis || 'per_kg',
      percent_base: 'freight',
      buy_amount: num(r.buy_amount),
      buy_currency: r.buy_currency || null,
      sell_amount: num(r.sell_amount),
      sell_currency: r.sell_currency || null,
      min_buy: num(r.min_buy),
      min_sell: num(r.min_sell),
      vendor_account_id: r.vendor_account_id || null,
      vendor_name: r.vendor_name || null,
      condition: r.condition.trim() || null,
    }
    if (r.dbId) {
      const { error } = await supabase.from('air_local_charge_lines').update(payload).eq('id', r.dbId)
      if (error) throw error
    } else {
      const { error } = await supabase.from('air_local_charge_lines').insert(payload)
      if (error) throw error
    }
  }
}
