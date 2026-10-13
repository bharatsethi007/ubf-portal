import { supabase } from '@/supabase'
import type { CustomerPickerValue } from '@/components/bookings/CustomerPicker'
import { lineCbm, lineTotals, type Line } from './EaCargoLines'
import { bookingAccountId } from './intake/customerAccount'

export type NewEa = {
  shipper: CustomerPickerValue | null
  consignee: CustomerPickerValue | null
  billTo: CustomerPickerValue | null
  destination: string
  incoterm: string
  readyDate: string | null
  customerRef: string
  lines: Line[]
  goods: string
  value: string
  currency: string
  isDg: boolean
  unNumber: string
  mode: 'pickup' | 'dropoff'
  pickupAddress: string
  notes: string
  consolId: string
}

const addr = (c: CustomerPickerValue | null) => [c?.address1, c?.address2, c?.address3].filter(Boolean).join(', ') || null
const nul = (s: string) => (s.trim() ? s.trim() : null)

export async function loadAccounts(ids: string[]): Promise<Record<string, CustomerPickerValue>> {
  const { data } = await supabase.from('customers')
    .select('account_id, name, address1, address2, address3, city, state, postcode, country, phone, email, contact')
    .in('account_id', ids)
  const out: Record<string, CustomerPickerValue> = {}
  for (const c of (data ?? []) as CustomerPickerValue[]) out[c.account_id] = c
  return out
}

export function newEaIssues(f: NewEa) {
  const t = lineTotals(f.lines)
  const out: string[] = []
  if (!f.shipper) out.push('Shipper')
  if (!f.consignee) out.push('Consignee')
  if (!f.billTo) out.push('Bill-to')
  if (!f.destination.trim()) out.push('Destination')
  if (!t.pcs) out.push('Pieces')
  if (!t.kg) out.push('Weight')
  if (!f.goods.trim()) out.push('Goods description')
  if (f.mode === 'pickup' && !f.pickupAddress.trim()) out.push('Pickup address')
  return out
}

/** Insert booking + booked cargo lines. Optional: allocate to consol, book TMS pickup. Returns booking id. */
export async function createEaBooking(f: NewEa, opts: { draft: boolean; bookPickup: boolean }) {
  const t = lineTotals(f.lines)
  const { data: auth } = await supabase.auth.getUser()
  const accountId = await bookingAccountId([f.billTo?.account_id, f.consignee?.account_id, f.shipper?.account_id])
  const { data, error } = await supabase.from('bookings').insert({
    module: 'EA',
    source: 'manual',
    status: opts.draft ? 'draft' : 'confirmed',
    account_id: accountId,
    origin: 'AKL',
    destination: f.destination.trim().toUpperCase(),
    incoterm: nul(f.incoterm),
    cargo_ready_date: f.readyDate,
    customer_ref: nul(f.customerRef),
    shipper_account_id: f.shipper?.account_id ?? null,
    shipper_name: f.shipper?.name ?? null,
    shipper_address: addr(f.shipper),
    shipper_city: f.shipper?.city ?? null,
    shipper_country: f.shipper?.country ?? null,
    consignee_account_id: f.consignee?.account_id ?? null,
    consignee_name: f.consignee?.name ?? null,
    consignee_address: addr(f.consignee),
    consignee_city: f.consignee?.city ?? null,
    consignee_country: f.consignee?.country ?? null,
    consignee_phone: f.consignee?.phone ?? null,
    consignee_contact: f.consignee?.contact ?? null,
    bill_to_account_id: f.billTo?.account_id ?? null,
    pieces: t.pcs || null,
    weight_kg: t.kg || null,
    volume_m3: t.cbm,
    chargeable_weight_kg: t.chg || null,
    goods_description: nul(f.goods),
    cargo_value: f.value.trim() ? Number(f.value) : null,
    cargo_value_currency: f.currency || 'NZD',
    is_dg: f.isDg,
    un_number: f.isDg ? nul(f.unNumber) : null,
    collection_mode: f.mode,
    pickup_address: f.mode === 'pickup' ? nul(f.pickupAddress) : null,
    special_instructions: nul(f.notes),
    consol_id: f.consolId || null,
    handled_by: auth.user?.id ?? null,
    created_by: auth.user?.id ?? null,
  }).select('id').single()
  if (error) throw new Error(error.message)
  const id = data.id as string

  const lines = f.lines
    .filter((x) => x.pcs || x.kg || x.l)
    .map((x, i) => ({
      booking_id: id, ord: i + 1, kind: 'booked',
      pieces: x.pcs ? Number(x.pcs) : null,
      length: x.l ? Number(x.l) : null, width: x.w ? Number(x.w) : null, height: x.h ? Number(x.h) : null,
      length_unit: 'cm', weight_unit: 'kg',
      weight: x.kg ? Number(x.kg) : null,
      cbm: lineCbm(x),
      goods_desc: i === 0 ? nul(f.goods) : null,
    }))
  if (lines.length) {
    const { error: le } = await supabase.from('booking_cargo_lines').insert(lines)
    if (le) throw new Error(`Booking saved, cargo lines failed: ${le.message}`)
  }

  if (opts.bookPickup && !opts.draft && f.mode === 'pickup') {
    const ready = f.readyDate ? new Date(`${f.readyDate}T10:00:00`).toISOString() : new Date().toISOString()
    const { error: pe } = await supabase.rpc('booking_create_pickup', { p_booking: id, p_ready: ready })
    if (pe) throw new Error(`Booking saved, pickup failed: ${pe.message}`)
  }
  return id
}
