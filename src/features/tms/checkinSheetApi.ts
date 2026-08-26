import { supabase } from '@/supabase'

export type ScreenVal = 'yes' | 'no' | ''
export type SheetLine = { type: string; units: string; weight_kg: string; length_cm: string; width_cm: string; height_cm: string; marks: string }
export const emptyLine = (): SheetLine => ({ type: '', units: '', weight_kg: '', length_cm: '', width_cm: '', height_cm: '', marks: '' })
export function cube(l: any, w: any, h: any, u: any) { const L = parseFloat(l) || 0, W = parseFloat(w) || 0, H = parseFloat(h) || 0, U = parseFloat(u) || 0; return +(((L * W * H) / 1_000_000) * U).toFixed(4) }

export type SheetPrefill = {
  consignment_id?: string | null; booking_id?: string | null; job_unique?: number | null; shipment_ref?: string | null; ref_input?: string
  shipper_company?: string; shipper_address?: string; consignee_company?: string; consignee_port_country?: string
  picked_up_at?: string | null; delivered_by_name?: string; lines?: SheetLine[]
}

export async function prefillFromConsignment(consignmentId: string): Promise<SheetPrefill> {
  const { data, error } = await supabase.from('tms_consignments')
    .select('id,consignment_no,booking_id,job_unique,shipment_ref,sender_company,sender_address,receiver_company,receiver_address,picked_up_at,preferred_pickup_at,driver1:tms_drivers!tms_consignments_assigned_driver_leg1_fkey(first_name,last_name),cargo:tms_consignment_cargo(*)')
    .eq('id', consignmentId).maybeSingle()
  if (error) throw error
  if (!data) return {}
  const d: any = data
  return {
    consignment_id: d.id, booking_id: d.booking_id, job_unique: d.job_unique, shipment_ref: d.shipment_ref, ref_input: d.consignment_no ?? '',
    shipper_company: d.sender_company ?? '', shipper_address: d.sender_address ?? '',
    consignee_company: d.receiver_company ?? '', consignee_port_country: d.receiver_address ?? '',
    picked_up_at: d.picked_up_at ?? d.preferred_pickup_at ?? null,
    delivered_by_name: d.driver1 ? `${d.driver1.first_name} ${d.driver1.last_name}` : '',
    lines: (d.cargo ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((c: any) => ({
      type: c.type ?? '', units: String(c.actual_units ?? c.units ?? ''), weight_kg: String(c.actual_weight_kg ?? c.weight_kg ?? ''),
      length_cm: String(c.actual_length_cm ?? c.length_cm ?? ''), width_cm: String(c.actual_width_cm ?? c.width_cm ?? ''),
      height_cm: String(c.actual_height_cm ?? c.height_cm ?? ''), marks: c.marks ?? '',
    })),
  }
}

export async function resolveReference(ref: string): Promise<SheetPrefill | null> {
  const s = ref.trim(); if (!s) return null
  const { data: cons } = await supabase.from('tms_consignments').select('id').eq('consignment_no', s).maybeSingle()
  if (cons?.id) return prefillFromConsignment(cons.id)
  const { data: bk } = await supabase.from('bookings').select('id,booking_ref,shipper_address,shipper_city,consignee_name,consignee_city,consignee_country').eq('booking_ref', s).maybeSingle()
  if (bk?.id) return { booking_id: bk.id, ref_input: s, shipper_address: [bk.shipper_address, bk.shipper_city].filter(Boolean).join(', '), consignee_company: bk.consignee_name ?? '', consignee_port_country: [bk.consignee_city, bk.consignee_country].filter(Boolean).join(', ') }
  let q = supabase.from('shipments').select('job_unique,house_bill,shipper_name,consignee_name').limit(1)
  q = /^\d+$/.test(s) ? q.eq('job_unique', Number(s)) : q.eq('house_bill', s)
  const { data: ships } = await q
  const sh: any = ships?.[0]
  if (sh) return { job_unique: sh.job_unique, shipment_ref: sh.house_bill ?? null, ref_input: s, shipper_company: sh.shipper_name ?? '', consignee_company: sh.consignee_name ?? '' }
  return null
}

export type SheetForm = {
  ref_input: string; consignment_id: string | null; booking_id: string | null; job_unique: number | null; shipment_ref: string | null
  job_type: string; delivered_by_name: string; picked_up_at: string | null
  shipper_company: string; shipper_address: string; shipper_additional_info: string; po_number: string; reference: string
  consignee_company: string; consignee_port_country: string; consignee_email: string; is_consignee_unknown: boolean; warehouse_location: string
  tags: string; console: string; goods_type: 'general' | 'dangerous'; screen_at: string | null
  known_shipper: ScreenVal; sufficient_packaging: ScreenVal; ipsm_pallet: ScreenVal; statement_of_content: ScreenVal; tamper_evident_form: ScreenVal
  booking_docs_attached: ScreenVal; damaged: ScreenVal; fragile: ScreenVal; temperature_controlled: ScreenVal; physically_scanned: ScreenVal
  comments: string; lines: SheetLine[]
}

export function emptySheetForm(): SheetForm {
  return {
    ref_input: '', consignment_id: null, booking_id: null, job_unique: null, shipment_ref: null,
    job_type: '', delivered_by_name: '', picked_up_at: null,
    shipper_company: '', shipper_address: '', shipper_additional_info: '', po_number: '', reference: '',
    consignee_company: '', consignee_port_country: '', consignee_email: '', is_consignee_unknown: false, warehouse_location: '',
    tags: '', console: '', goods_type: 'general', screen_at: new Date().toISOString().slice(0, 10),
    known_shipper: '', sufficient_packaging: '', ipsm_pallet: '', statement_of_content: '', tamper_evident_form: '',
    booking_docs_attached: '', damaged: '', fragile: '', temperature_controlled: '', physically_scanned: '',
    comments: '', lines: [emptyLine()],
  }
}

export function mergePrefill(base: SheetForm, p: SheetPrefill): SheetForm {
  return {
    ...base,
    ref_input: p.ref_input ?? base.ref_input, consignment_id: p.consignment_id ?? base.consignment_id,
    booking_id: p.booking_id ?? base.booking_id, job_unique: p.job_unique ?? base.job_unique, shipment_ref: p.shipment_ref ?? base.shipment_ref,
    shipper_company: p.shipper_company ?? base.shipper_company, shipper_address: p.shipper_address ?? base.shipper_address,
    consignee_company: p.consignee_company ?? base.consignee_company, consignee_port_country: p.consignee_port_country ?? base.consignee_port_country,
    delivered_by_name: p.delivered_by_name ?? base.delivered_by_name, picked_up_at: p.picked_up_at ?? base.picked_up_at,
    lines: (p.lines && p.lines.length) ? p.lines : base.lines,
  }
}

const sv = (v: ScreenVal) => (v === '' ? null : v)

export async function saveCheckinSheet(f: SheetForm) {
  const { data: u } = await supabase.auth.getUser()
  const payload: any = {
    consignment_id: f.consignment_id, booking_id: f.booking_id, job_unique: f.job_unique, shipment_ref: f.shipment_ref,
    ref_input: f.ref_input || null, job_type: f.job_type || null, delivered_by_name: f.delivered_by_name || null, picked_up_at: f.picked_up_at || null,
    shipper_company: f.shipper_company || null, shipper_address: f.shipper_address || null, shipper_additional_info: f.shipper_additional_info || null,
    po_number: f.po_number || null, reference: f.reference || null,
    consignee_company: f.consignee_company || null, consignee_port_country: f.consignee_port_country || null, consignee_email: f.consignee_email || null,
    is_consignee_unknown: f.is_consignee_unknown, warehouse_location: f.warehouse_location || null,
    tags: f.tags || null, console: f.console || null, goods_type: f.goods_type,
    screen_at: f.screen_at || new Date().toISOString(),
    known_shipper: sv(f.known_shipper), sufficient_packaging: sv(f.sufficient_packaging), ipsm_pallet: sv(f.ipsm_pallet),
    statement_of_content: sv(f.statement_of_content), tamper_evident_form: sv(f.tamper_evident_form),
    booking_docs_attached: sv(f.booking_docs_attached), damaged: sv(f.damaged), fragile: sv(f.fragile),
    temperature_controlled: sv(f.temperature_controlled), physically_scanned: sv(f.physically_scanned),
    comments: f.comments || null, checked_in_at: new Date().toISOString(), created_by: u?.user?.id ?? null, received_by: u?.user?.id ?? null,
  }
  const { data: sheet, error } = await supabase.from('tms_checkin_sheets').insert(payload).select('id,sheet_no').single()
  if (error) throw error
  const sheetId = sheet.id as string
  const lineRows = f.lines.filter((l) => l.type && (parseFloat(l.units) || 0) > 0).map((l, i) => ({
    sheet_id: sheetId, type: l.type, units: parseFloat(l.units) || null, weight_kg: parseFloat(l.weight_kg) || null,
    length_cm: parseFloat(l.length_cm) || null, width_cm: parseFloat(l.width_cm) || null, height_cm: parseFloat(l.height_cm) || null,
    total_cube_m3: cube(l.length_cm, l.width_cm, l.height_cm, l.units) || null, marks: l.marks || null, sort_order: i,
  }))
  if (lineRows.length) { const { error: le } = await supabase.from('tms_checkin_sheet_lines').insert(lineRows); if (le) throw le }
  if (f.consignment_id) {
    const { data: cargo } = await supabase.from('tms_consignment_cargo').select('id,sort_order').eq('consignment_id', f.consignment_id).order('sort_order')
    const cg = cargo ?? []
    for (let i = 0; i < f.lines.length && i < cg.length; i++) {
      const l = f.lines[i]
      await supabase.from('tms_consignment_cargo').update({
        actual_units: parseFloat(l.units) || null, actual_length_cm: parseFloat(l.length_cm) || null, actual_width_cm: parseFloat(l.width_cm) || null,
        actual_height_cm: parseFloat(l.height_cm) || null, actual_weight_kg: parseFloat(l.weight_kg) || null,
        actual_total_cube_m3: cube(l.length_cm, l.width_cm, l.height_cm, l.units) || null,
      }).eq('id', (cg[i] as any).id)
    }
    await supabase.from('tms_consignments').update({ wms_checkin_at: new Date().toISOString(), wms_checkin_by: u?.user?.id ?? null }).eq('id', f.consignment_id)
  }
  return sheet.sheet_no as string
}
