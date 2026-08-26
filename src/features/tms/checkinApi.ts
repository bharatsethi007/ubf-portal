import { supabase } from '@/supabase'

export type CheckinQueueRow = { id: string; consignment_no: string | null; sender_company: string | null; sender_address: string | null; preferred_pickup_at: string | null; status: string }

export async function listCheckinQueue(): Promise<CheckinQueueRow[]> {
  const { data, error } = await supabase.from('tms_consignments')
    .select('id,consignment_no,sender_company,sender_address,preferred_pickup_at,status')
    .eq('order_type', 'pick-up').eq('archived', false).is('wms_checkin_at', null)
    .not('status', 'in', '("complete","checked_in","failed","inComplete","cancel","archived")')
    .order('preferred_pickup_at', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as CheckinQueueRow[]
}

export type VarianceRow = { consignment_id: string; consignment_no: string | null; wms_checkin_at: string; old_cbm: number; new_cbm: number }

export async function listVariance(): Promise<VarianceRow[]> {
  const { data, error } = await supabase.from('tms_checkin_variance').select('*').order('wms_checkin_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r: any) => ({ ...r, old_cbm: Number(r.old_cbm), new_cbm: Number(r.new_cbm) })) as VarianceRow[]
}

export type CheckinLine = {
  id: string; type: string
  units: number | null; length_cm: number | null; width_cm: number | null; height_cm: number | null; weight_kg: number | null; total_cube_m3: number | null
  actual_units: number | null; actual_length_cm: number | null; actual_width_cm: number | null; actual_height_cm: number | null; actual_weight_kg: number | null; actual_total_cube_m3: number | null
}

export async function fetchCheckinLines(consignmentId: string): Promise<CheckinLine[]> {
  const { data, error } = await supabase.from('tms_consignment_cargo')
    .select('id,type,units,length_cm,width_cm,height_cm,weight_kg,total_cube_m3,actual_units,actual_length_cm,actual_width_cm,actual_height_cm,actual_weight_kg,actual_total_cube_m3')
    .eq('consignment_id', consignmentId).order('sort_order')
  if (error) throw error
  return (data ?? []) as CheckinLine[]
}

export function cube(l: any, w: any, h: any, u: any) {
  const L = parseFloat(l) || 0, W = parseFloat(w) || 0, H = parseFloat(h) || 0, U = parseFloat(u) || 0
  return +(((L * W * H) / 1_000_000) * U).toFixed(4)
}

export type ActualDraft = { id: string; units: string; length_cm: string; width_cm: string; height_cm: string; weight_kg: string }

export async function confirmCheckin(consignmentId: string, drafts: ActualDraft[]) {
  for (const d of drafts) {
    const { error } = await supabase.from('tms_consignment_cargo').update({
      actual_units: parseFloat(d.units) || null,
      actual_length_cm: parseFloat(d.length_cm) || null,
      actual_width_cm: parseFloat(d.width_cm) || null,
      actual_height_cm: parseFloat(d.height_cm) || null,
      actual_weight_kg: parseFloat(d.weight_kg) || null,
      actual_total_cube_m3: cube(d.length_cm, d.width_cm, d.height_cm, d.units) || null,
    }).eq('id', d.id)
    if (error) throw error
  }
  const { data: u } = await supabase.auth.getUser()
  const { error } = await supabase.from('tms_consignments')
    .update({ wms_checkin_at: new Date().toISOString(), wms_checkin_by: u?.user?.id ?? null })
    .eq('id', consignmentId)
  if (error) throw error
}

export type CompletedSheet = {
  id: string
  sheet_no: string | null
  checked_in_at: string | null
  consignment_id: string | null
  shipper_company: string | null
  consignee_company: string | null
  consignment: { consignment_no: string | null } | null
}

export async function listCompletedSheets(bucket: 'ubf' | 'third'): Promise<CompletedSheet[]> {
  let q = supabase.from('tms_checkin_sheets')
    .select('id,sheet_no,checked_in_at,consignment_id,shipper_company,consignee_company,consignment:tms_consignments!tms_checkin_sheets_consignment_id_fkey(consignment_no)')
    .order('checked_in_at', { ascending: false, nullsFirst: false })
  q = bucket === 'ubf' ? q.not('consignment_id', 'is', null) : q.is('consignment_id', null)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CompletedSheet[]
}
