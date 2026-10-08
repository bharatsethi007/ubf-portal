import { supabase } from '@/supabase'
import { fetchEffectiveRates } from '@/pages/setup/fxRatesApi'
import { toNzd, type FxRates } from '@/pages/rates/fx'
import { wmFromCargo } from '@/pages/rates/lclRateSearchApi'
import type { ChargeGroup, CostType } from './costTypes'

export type CostDraft = {
  cost_type: CostType
  vendor_name: string | null
  vendor_code: string | null
  charge_group: ChargeGroup | null
  description: string
  qty: number
  unit: string | null
  rate: number | null
  currency: string
  amount: number
  source: 'quote' | 'rate_card' | 'manual'
  source_ref?: Record<string, unknown> | null
}

export type BookingCost = CostDraft & {
  id: string
  booking_id: string
  fx_rate: number
  amount_nzd: number
  note: string | null
  sort_order: number
  created_at: string
}

export type FinanceLane = {
  origin: string | null
  destination: string | null
  incoterm: string | null
  loadType: 'FCL' | 'LCL' | null
  containers: { size: string; qty: number }[]
  wm: number
  cbm: number
  toDoor: boolean
}

const COLS = 'id, booking_id, cost_type, vendor_name, vendor_code, charge_group, description, qty, unit, rate, currency, amount, fx_rate, amount_nzd, source, source_ref, note, sort_order, created_at'

export async function listCosts(bookingId: string): Promise<BookingCost[]> {
  const { data, error } = await supabase.from('booking_costs').select(COLS)
    .eq('booking_id', bookingId).order('sort_order').order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as BookingCost[]
}

export function fxFor(currency: string, rates: FxRates): number {
  return toNzd(1, currency, rates, 'buy') ?? 1
}

export async function insertCosts(bookingId: string, drafts: CostDraft[], rates: FxRates): Promise<void> {
  if (drafts.length === 0) return
  const { data: last } = await supabase.from('booking_costs').select('sort_order')
    .eq('booking_id', bookingId).order('sort_order', { ascending: false }).limit(1)
  const start = ((last?.[0]?.sort_order as number | undefined) ?? 0) + 1
  const rows = drafts.map((d, i) => ({
    ...d, booking_id: bookingId, sort_order: start + i,
    currency: (d.currency || 'NZD').toUpperCase(),
    fx_rate: fxFor(d.currency || 'NZD', rates),
    amount: Math.round(d.amount * 100) / 100,
  }))
  const { error } = await supabase.from('booking_costs').insert(rows)
  if (error) throw new Error(error.message)
}

export async function updateCost(id: string, patch: Partial<BookingCost>, rates: FxRates): Promise<void> {
  const p: Record<string, unknown> = { ...patch }
  if (patch.currency) { p.currency = patch.currency.toUpperCase(); p.fx_rate = fxFor(patch.currency, rates) }
  delete p.amount_nzd
  const { error } = await supabase.from('booking_costs').update(p).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteCost(id: string): Promise<void> {
  const { error } = await supabase.from('booking_costs').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export const fetchFx = () => fetchEffectiveRates('NZD')

export async function fetchFinanceLane(bookingId: string): Promise<FinanceLane> {
  const { data: b, error } = await supabase.from('bookings')
    .select('origin, destination, m_discharge_port, incoterm, load_type, container_type, container_count, cbm, volume_m3, gross_weight_kg, weight_kg, service_type, delivery_mode, quote_id')
    .eq('id', bookingId).maybeSingle()
  if (error || !b) throw new Error(error?.message ?? 'Booking not found')

  const { data: bc } = await supabase.from('booking_containers').select('container_type').eq('booking_id', bookingId)
  let containers = countTypes(((bc ?? []) as { container_type: string | null }[]).map((r) => r.container_type))
  let wm = 0; let cbm = 0

  if (b.quote_id) {
    const [{ data: qc }, { data: cl }] = await Promise.all([
      supabase.from('quote_containers').select('container_size, qty').eq('quote_id', b.quote_id),
      supabase.from('quote_cargo_lines').select('total_cbm, gross_wt').eq('quote_id', b.quote_id),
    ])
    if (containers.length === 0) {
      containers = ((qc ?? []) as { container_size: string | null; qty: number | null }[])
        .filter((r) => r.container_size).map((r) => ({ size: String(r.container_size), qty: Number(r.qty) || 1 }))
    }
    const w = wmFromCargo((cl ?? []) as { total_cbm: number | null; gross_wt: number | null }[])
    wm = w.wm; cbm = w.cbm
  }
  if (containers.length === 0 && b.container_type) {
    containers = [{ size: String(b.container_type).split(',')[0].trim(), qty: Number(b.container_count) || 1 }]
  }
  if (wm <= 0) {
    cbm = Number(b.cbm ?? b.volume_m3 ?? 0) || 0
    const t = (Number(b.gross_weight_kg ?? b.weight_kg ?? 0) || 0) / 1000
    wm = Math.round(Math.max(cbm, t) * 100) / 100
  }
  const lt = (b.load_type ?? '').toUpperCase()
  return {
    origin: b.origin ?? null,
    destination: b.destination ?? b.m_discharge_port ?? null,
    incoterm: b.incoterm ?? null,
    loadType: lt === 'FCL' || lt === 'LCL' ? lt : null,
    containers, wm, cbm,
    toDoor: b.delivery_mode != null || /door$/i.test(b.service_type ?? ''),
  }
}

function countTypes(types: (string | null)[]): { size: string; qty: number }[] {
  const m = new Map<string, number>()
  for (const t of types) if (t) m.set(t, (m.get(t) ?? 0) + 1)
  return [...m.entries()].map(([size, qty]) => ({ size, qty }))
}
