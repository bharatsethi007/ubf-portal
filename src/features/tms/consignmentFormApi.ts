import { useEffect, useState } from 'react'
import { supabase } from '@/supabase'

export const ORDER_TYPES = [
  { code: 'pick-up', label: 'Pick Up' },
  { code: 'drop-off', label: 'Drop Off' },
  { code: 'transfer', label: 'Transfer' },
]

export const CARGO_TYPES = [
  { code: 'pallet', label: 'Pallets' },
  { code: 'carton', label: 'Cartons' },
  { code: 'crate', label: 'Crates' },
  { code: 'package', label: 'Packages' },
  { code: 'drum-gallon', label: 'Drums/Gallons' },
  { code: 'bail-roll', label: 'Bails/Rolls' },
  { code: 'piece', label: 'Pieces (Misc)' },
]

export const FLAG_KEYS = [
  'signature_required', 'photo_pod_required', 'urgent', 'tail_lift_required',
  'customs_mpi', 'fragile', 'saturday_delivery', 'temperature_control',
] as const

export const FLAG_LABELS: Record<string, string> = {
  signature_required: 'Signature Required',
  photo_pod_required: 'Photo POD Required',
  urgent: 'Urgent',
  tail_lift_required: 'Tail Lift Required',
  customs_mpi: 'Customs/MPI/Food Safety',
  fragile: 'Fragile',
  saturday_delivery: 'Saturday Delivery',
  temperature_control: 'Temperature Control Required',
}

export type CargoDraft = { type: string; units: string; weight_kg: string; length_cm: string; width_cm: string; height_cm: string }
export const emptyCargo = (): CargoDraft => ({ type: '', units: '', weight_kg: '', length_cm: '', width_cm: '', height_cm: '' })

export function cubeM3(l: string, w: string, h: string, units: string) {
  const L = parseFloat(l) || 0, W = parseFloat(w) || 0, H = parseFloat(h) || 0, U = parseFloat(units) || 0
  return +(((L * W * H) / 1_000_000) * U).toFixed(4)
}

export type PartyDraft = { company: string; address: string; additional_info: string; contact: string; phone: string; email: string }
export const emptyParty = (): PartyDraft => ({ company: '', address: '', additional_info: '', contact: '', phone: '', email: '' })

/** UB Freight Mangere depot party — auto-filled as receiver (pick-up) or sender (drop-off). */
export const MANGERE_COMPANY = 'UB Freight Mangere'
export const MANGERE_ADDRESS = '173 Montgomerie Road, Mangere, Auckland'
export const MANGERE_PHONE = '09 966 3850'
export function mangereParty(identity: { username: string; email: string }): PartyDraft {
  return { company: MANGERE_COMPANY, address: MANGERE_ADDRESS, additional_info: '', contact: identity.username, phone: MANGERE_PHONE, email: identity.email }
}
export const isMangere = (p: PartyDraft) => p.company.trim() === MANGERE_COMPANY

export type ConsignmentFormValues = {
  order_type: string
  depot_id: string
  mode: string
  sender: PartyDraft
  receiver: PartyDraft
  preferred_pickup_at: string
  preferred_delivery_at: string
  reference: string
  delivery_instructions: string
  calculate_volume_by: 'unitType' | 'totalShipment'
  goods_type: 'general' | 'dangerous'
  dangerous_goods_reason: string
  flags: Record<string, boolean>
  cargo: CargoDraft[]
  email_labels: boolean
  email_consignment_note: boolean
  email_pod: boolean
  pod_additional_emails: string[]
}

export function emptyForm(): ConsignmentFormValues {
  return {
    order_type: 'pick-up', depot_id: '', mode: '', sender: emptyParty(), receiver: emptyParty(),
    preferred_pickup_at: '', preferred_delivery_at: '',
    reference: '', delivery_instructions: '',
    calculate_volume_by: 'unitType', goods_type: 'general', dangerous_goods_reason: '',
    flags: Object.fromEntries(FLAG_KEYS.map((k) => [k, false])),
    cargo: [emptyCargo()],
    email_labels: false, email_consignment_note: false, email_pod: false, pod_additional_emails: [],
  }
}

export function useDepots() {
  const [depots, setDepots] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    supabase.from('tms_depots').select('id,name').eq('active', true).order('name').then(({ data }) => setDepots(data ?? []))
  }, [])
  return depots
}

/** Signed-in user identity for auto-filling the depot party contact. username = email local-part. */
export function useCurrentUserIdentity() {
  const [identity, setIdentity] = useState<{ username: string; email: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      const email = data.user?.email ?? ''
      setIdentity({ email, username: email ? email.split('@')[0] : '' })
    })
    return () => { cancelled = true }
  }, [])
  return identity
}

const toIso = (s: string) => (s ? new Date(s).toISOString() : null)
const cleanEmails = (arr: string[]) => arr.map((e) => e.trim()).filter(Boolean)

function toPayload(v: ConsignmentFormValues) {
  return {
    order_type: v.order_type,
    depot_id: v.depot_id || null,
    mode: v.mode || null,
    source: 'manual',
    sender_company: v.sender.company || null,
    sender_address: v.sender.address || null,
    sender_additional_info: v.sender.additional_info || null,
    sender_contact: v.sender.contact || null,
    sender_phone: v.sender.phone || null,
    sender_email: v.sender.email || null,
    receiver_company: v.receiver.company || null,
    receiver_address: v.receiver.address || null,
    receiver_additional_info: v.receiver.additional_info || null,
    receiver_contact: v.receiver.contact || null,
    receiver_phone: v.receiver.phone || null,
    receiver_email: v.receiver.email || null,
    receiver_additional_emails: v.order_type === 'drop-off' ? cleanEmails(v.pod_additional_emails) : [],
    preferred_pickup_at: toIso(v.preferred_pickup_at),
    preferred_delivery_at: toIso(v.preferred_delivery_at),
    reference: v.reference || null,
    delivery_instructions: v.delivery_instructions || null,
    calculate_volume_by: v.calculate_volume_by,
    goods_type: v.goods_type,
    dangerous_goods_reason: v.goods_type === 'dangerous' ? (v.dangerous_goods_reason || null) : null,
    email_labels: v.order_type === 'pick-up' ? v.email_labels : false,
    email_consignment_note: v.order_type === 'pick-up' ? v.email_consignment_note : false,
    email_pod: v.order_type === 'drop-off' ? v.email_pod : false,
    ...Object.fromEntries(FLAG_KEYS.map((k) => [k, !!v.flags[k]])),
  }
}

function cargoRows(consignmentId: string, cargo: CargoDraft[]) {
  return cargo
    .filter((c) => c.type && (parseFloat(c.units) || 0) > 0)
    .map((c, i) => ({
      consignment_id: consignmentId, type: c.type,
      units: parseFloat(c.units) || null, weight_kg: parseFloat(c.weight_kg) || null,
      length_cm: parseFloat(c.length_cm) || null, width_cm: parseFloat(c.width_cm) || null, height_cm: parseFloat(c.height_cm) || null,
      total_cube_m3: cubeM3(c.length_cm, c.width_cm, c.height_cm, c.units) || null, sort_order: i,
    }))
}

export async function createConsignment(v: ConsignmentFormValues) {
  const { data, error } = await supabase.from('tms_consignments').insert(toPayload(v)).select('id, consignment_no').single()
  if (error) throw error
  const rows = cargoRows(data.id as string, v.cargo)
  if (rows.length) {
    const { error: cErr } = await supabase.from('tms_consignment_cargo').insert(rows)
    if (cErr) throw cErr
  }
  return data as { id: string; consignment_no: string }
}

export async function updateConsignment(id: string, v: ConsignmentFormValues) {
  const { error } = await supabase.from('tms_consignments').update(toPayload(v)).eq('id', id)
  if (error) throw error
  await supabase.from('tms_consignment_cargo').delete().eq('consignment_id', id)
  const rows = cargoRows(id, v.cargo)
  if (rows.length) {
    const { error: cErr } = await supabase.from('tms_consignment_cargo').insert(rows)
    if (cErr) throw cErr
  }
}

function toLocalInput(v: string | null) {
  if (!v) return ''
  const d = new Date(v)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export async function fetchConsignmentForEdit(id: string): Promise<ConsignmentFormValues | null> {
  const { data, error } = await supabase.from('tms_consignments').select('*, cargo:tms_consignment_cargo(*)').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const d: any = data
  return {
    order_type: d.order_type, depot_id: d.depot_id ?? '', mode: d.mode ?? '',
    sender: { company: d.sender_company ?? '', address: d.sender_address ?? '', additional_info: d.sender_additional_info ?? '', contact: d.sender_contact ?? '', phone: d.sender_phone ?? '', email: d.sender_email ?? '' },
    receiver: { company: d.receiver_company ?? '', address: d.receiver_address ?? '', additional_info: d.receiver_additional_info ?? '', contact: d.receiver_contact ?? '', phone: d.receiver_phone ?? '', email: d.receiver_email ?? '' },
    preferred_pickup_at: toLocalInput(d.preferred_pickup_at), preferred_delivery_at: toLocalInput(d.preferred_delivery_at),
    reference: d.reference ?? '', delivery_instructions: d.delivery_instructions ?? '',
    calculate_volume_by: d.calculate_volume_by ?? 'unitType', goods_type: d.goods_type ?? 'general', dangerous_goods_reason: d.dangerous_goods_reason ?? '',
    flags: Object.fromEntries(FLAG_KEYS.map((k) => [k, !!d[k]])),
    cargo: (d.cargo ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((c: any) => ({
      type: c.type, units: String(c.units ?? ''), weight_kg: String(c.weight_kg ?? ''),
      length_cm: String(c.length_cm ?? ''), width_cm: String(c.width_cm ?? ''), height_cm: String(c.height_cm ?? ''),
    })),
    email_labels: !!d.email_labels, email_consignment_note: !!d.email_consignment_note, email_pod: !!d.email_pod,
    pod_additional_emails: Array.isArray(d.receiver_additional_emails) ? d.receiver_additional_emails : [],
  }
}
