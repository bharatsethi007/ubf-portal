import { supabase } from '../../../../supabase'
import { EMPTY_PARTY, saveContact, type Party } from '../contacts/contactsApi'
import { requestBooking } from './bookingsApi'

/** Everything the booking form collects. Strings mirror the inputs; the server casts. */
export type BookingDraft = {
  direction: 'import' | 'export'
  mode: 'sea' | 'air'
  load_type: 'FCL' | 'LCL' | ''
  origin: string
  destination: string
  incoterm: string
  cargo_ready_date: string
  goods_description: string
  hs_code: string
  pieces: string
  packing_type: string
  weight_kg: string
  cbm: string
  container_type: string
  container_count: string
  is_dg: boolean
  un_number: string
  dg_class: string
  is_temp_controlled: boolean
  temp_range: string
  shipper: Party
  consignee: Party
  save_shipper: boolean
  save_consignee: boolean
  pickup: boolean
  pickup_address: string
  delivery: boolean
  delivery_address: string
  needs_customs: boolean
  needs_insurance: boolean
  cargo_value: string
  cargo_value_currency: string
  customer_ref: string
  notes: string
  rate_ref?: string
  quote_response_id?: string
  approve_note?: string
}

export const EMPTY_DRAFT: BookingDraft = {
  direction: 'import', mode: 'sea', load_type: 'FCL', origin: '', destination: '', incoterm: '', cargo_ready_date: '',
  goods_description: '', hs_code: '', pieces: '', packing_type: '', weight_kg: '', cbm: '', container_type: '40HQ', container_count: '1',
  is_dg: false, un_number: '', dg_class: '', is_temp_controlled: false, temp_range: '',
  shipper: EMPTY_PARTY, consignee: EMPTY_PARTY, save_shipper: false, save_consignee: false,
  pickup: false, pickup_address: '', delivery: false, delivery_address: '',
  needs_customs: true, needs_insurance: false, cargo_value: '', cargo_value_currency: 'NZD',
  customer_ref: '', notes: '',
}

/** Plain-English meaning of each incoterm for the side that is our customer. */
export const INCOTERM_HELP: Record<string, string> = {
  EXW: 'Buyer arranges everything from the seller’s door.',
  FCA: 'Seller hands over at an agreed place, export cleared. Buyer arranges the rest.',
  FAS: 'Seller delivers alongside the vessel at the origin port.',
  FOB: 'Seller loads on board at the origin port. Buyer pays sea freight and onwards.',
  CFR: 'Seller pays freight to the destination port. Buyer pays destination charges.',
  CIF: 'As CFR, plus seller insures to the destination port.',
  CPT: 'Seller pays carriage to the named destination.',
  CIP: 'As CPT, plus seller insures.',
  DAP: 'Seller delivers to the buyer’s door, not import cleared.',
  DPU: 'Seller delivers and unloads at the named place.',
  DDP: 'Seller delivers to the door with duty and GST paid.',
}

/** Collection at origin is ours to arrange under these terms (import: from the supplier). */
export const originPickupTerms = new Set(['EXW', 'FCA'])
/** Door delivery at destination is part of the job under these terms (export: to the consignee). */
export const doorDeliveryTerms = new Set(['DAP', 'DPU', 'DDP'])

export function missingFields(d: BookingDraft, laneLocked = false): string[] {
  const m: string[] = []
  const fcl = d.mode === 'sea' && d.load_type === 'FCL'
  if (!laneLocked && !d.origin) m.push('origin')
  if (!laneLocked && !d.destination) m.push('destination')
  if (!d.goods_description.trim()) m.push('what you are shipping')
  if (!d.cargo_ready_date) m.push('cargo ready date')
  if (!d.incoterm) m.push('incoterm')
  if (!fcl && !d.weight_kg) m.push('weight')
  if (!fcl && !d.pieces) m.push('pieces')
  if (d.direction === 'import' && !d.shipper.company.trim()) m.push('shipper')
  if (d.direction === 'export' && !d.consignee.company.trim()) m.push('consignee')
  if (d.pickup && !d.pickup_address.trim()) m.push('pickup address')
  if (d.delivery && !d.delivery_address.trim()) m.push('delivery address')
  if (d.needs_insurance && !d.cargo_value) m.push('cargo value for insurance')
  if (d.is_dg && !d.un_number.trim()) m.push('UN number')
  return m
}

const partyPayload = (p: Party) => ({ ...p, lat: p.lat ?? undefined, lng: p.lng ?? undefined })

/** Saves new parties to Contacts when asked, then sends the booking. */
export async function submitBooking(d: BookingDraft): Promise<{ booking_id: string; booking_ref: string }> {
  const saves: Promise<unknown>[] = []
  if (d.save_shipper && d.shipper.company.trim()) saves.push(saveContact({ ...d.shipper, role: 'shipper' }).catch(() => null))
  if (d.save_consignee && d.consignee.company.trim()) saves.push(saveContact({ ...d.consignee, role: 'consignee' }).catch(() => null))
  await Promise.all(saves)
  const { save_shipper: _a, save_consignee: _b, pickup, delivery, ...rest } = d
  return requestBooking({
    ...rest,
    shipper: partyPayload(d.shipper),
    consignee: partyPayload(d.consignee),
    pickup_address: pickup ? d.pickup_address : '',
    delivery_address: delivery ? d.delivery_address : '',
    cargo_value: d.needs_insurance ? d.cargo_value : '',
  })
}

/** Saved booking (portal_booking_get) back into the form's shape. */
export function draftFromBooking(b: Record<string, unknown>): BookingDraft {
  const s = (v: unknown) => (v == null ? '' : String(v))
  const party = (x: unknown) => {
    const p = (x ?? {}) as Record<string, unknown>
    return { ...EMPTY_PARTY, company: s(p.company), contact_name: s(p.contact_name), email: s(p.email), phone: s(p.phone),
      address: s(p.address), city: s(p.city), postcode: s(p.postcode), country: s(p.country) }
  }
  const [md, dir] = s(b.mode).split('_')
  const shipper = party(b.shipper)
  const consignee = party(b.consignee)
  return {
    ...EMPTY_DRAFT,
    direction: dir === 'export' ? 'export' : 'import', mode: md === 'air' ? 'air' : 'sea',
    load_type: md === 'air' ? '' : (s(b.load_type) === 'LCL' ? 'LCL' : 'FCL'),
    origin: s(b.origin), destination: s(b.destination), incoterm: s(b.incoterm), cargo_ready_date: s(b.cargo_ready_date).slice(0, 10),
    goods_description: s(b.goods_description), hs_code: s(b.hs_code), pieces: s(b.pieces), packing_type: s(b.packing_type),
    weight_kg: s(b.weight_kg), cbm: s(b.cbm), container_type: s(b.container_type) || '40HQ', container_count: s(b.container_count) || '1',
    is_dg: !!b.is_dg, un_number: s(b.un_number), dg_class: s(b.dg_class), is_temp_controlled: !!b.is_temp_controlled, temp_range: s(b.temp_range),
    shipper, consignee,
    pickup: !!b.pickup_address, pickup_address: s(b.pickup_address), delivery: !!b.delivery_address, delivery_address: s(b.delivery_address),
    needs_customs: b.needs_customs !== false, needs_insurance: !!b.needs_insurance, cargo_value: s(b.cargo_value),
    cargo_value_currency: s(b.cargo_value_currency) || 'NZD', customer_ref: s(b.customer_ref), notes: s(b.notes),
  }
}

export async function fetchBookingForEdit(id: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('portal_booking_get', { p_booking: id })
  if (error) throw new Error('Booking could not load.')
  return (data ?? null) as Record<string, unknown> | null
}

/** Saves edits (and any new contacts the customer ticked) to a booking that is not yet a shipment. */
export async function saveBookingEdit(id: string, d: BookingDraft): Promise<void> {
  if (d.save_shipper && d.shipper.company.trim()) await saveContact({ ...d.shipper, role: 'shipper' }).catch(() => null)
  if (d.save_consignee && d.consignee.company.trim()) await saveContact({ ...d.consignee, role: 'consignee' }).catch(() => null)
  const { save_shipper: _a, save_consignee: _b, pickup, delivery, rate_ref: _r, quote_response_id: _q, approve_note: _n, ...rest } = d
  const { error } = await supabase.rpc('portal_booking_update', {
    p_booking: id,
    p: { ...rest, pickup_address: pickup ? d.pickup_address : '', delivery_address: delivery ? d.delivery_address : '', cargo_value: d.needs_insurance ? d.cargo_value : '' },
  })
  if (error) throw new Error(error.message || 'Changes could not be saved.')
}
