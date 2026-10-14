// Buyers consolidation: a main HAWB (shipper "Various Shippers") over sub-HAWBs from different suppliers.
// Subs keep their own pickup, check-in, SLI, docs and emails. Only the main HAWB goes to TradeWindow.
import { supabase } from '@/supabase'
import { cargoOf, type EaRow } from './eaTypes'
import type { EaDetail } from './useEaBooking'
import { eaFacts, eaMilestones, eaPlan, type EaAction, type EaMilestone, type EaPlan } from './progress/eaProgress'
import type { TmsJob } from './useEaBooking'

export const isMaster = (r: { is_consolidation: boolean | null }) => !!r.is_consolidation
export const supplierOf = (r: EaRow) => r.shipper_code_name ?? r.shipper_name ?? 'Supplier?'

/** What a sub-HAWB still needs before the main HAWB can be exported. Empty = complete. */
export function subIssues(r: EaRow): string[] {
  const b = r as unknown as EaDetail
  const f = eaFacts(b, null)
  const c = cargoOf(r)
  const out: string[] = []
  if (r.stage < 0) out.push('Draft, not confirmed')
  if (!r.shipper_name && !r.shipper_account_id) out.push('Supplier name missing')
  if (!c.pcs) out.push('Pieces missing')
  if (!c.kg) out.push('Weight missing')
  if (!f.checkedIn) out.push(f.pickupMode ? (f.pickupBooked ? 'Not checked in' : 'Pickup not booked') : 'Not dropped off yet')
  if (!f.sliIn) out.push(f.sliSent ? 'SLI not signed' : 'SLI not sent')
  return out
}

/** Master figures are the sum of its subs (warehouse actuals win per sub). */
export function masterTotals(subs: EaRow[]) {
  let pcs = 0, kg = 0, cbm = 0, chg = 0
  for (const s of subs) {
    const c = cargoOf(s)
    pcs += Number(c.pcs ?? 0); kg += Number(c.kg ?? 0); cbm += Number(c.cbm ?? 0); chg += Number(c.chg ?? 0)
  }
  return { pcs, kg: Math.round(kg * 10) / 10, cbm: Math.round(cbm * 1000) / 1000, chg: Math.ceil(chg) }
}

/** The main HAWB as a single TW house: totals and goods taken from the subs. */
export function masterAsHouse<T extends EaRow>(m: T, subs: EaRow[]): T {
  const t = masterTotals(subs)
  const goods = (m as unknown as { goods_description?: string | null }).goods_description
    || [...new Set(subs.map((s) => (s as unknown as { goods_description?: string | null }).goods_description).filter(Boolean))].join(', ')
  return { ...m, pieces: t.pcs, weight_kg: t.kg, volume_m3: t.cbm, act_pcs: t.pcs, act_kg: t.kg, act_cbm: t.cbm, chargeable_weight_kg: t.chg, goods_description: goods }
}

const count = (subs: EaRow[], ok: (s: EaRow) => boolean) => subs.filter(ok).length

/** Master milestone track: its own quote/booked/consol/export steps, sub steps rolled up as "x of y". */
export function masterMilestones(m: EaDetail, subs: EaRow[]): EaMilestone[] {
  const own = eaMilestones(m, null)
  const facts = subs.map((s) => eaFacts(s as unknown as EaDetail, null))
  const n = subs.length
  const roll = (key: string, label: string, done: number, verb: string, action: EaAction, cta: string): EaMilestone => ({
    key, label, owner: key === 'sli' ? 'customer' : 'ubf', done: n > 0 && done === n, at: null, due: null, state: 'todo',
    note: n ? `${done} of ${n} ${verb}` : 'No sub-HAWBs',
    ctas: n && done < n ? [{ label: cta, action }] : [],
  })
  const pick = facts.filter((f) => f.pickupBooked || f.checkedIn || !f.pickupMode).length
  const rolled: Record<string, EaMilestone> = {
    pickup: roll('pickup', 'Pickups', pick, 'arranged', 'tab_pickup', 'Next missing'),
    checkin: roll('checkin', 'Checked in', facts.filter((f) => f.checkedIn).length, 'in', 'tab_checkin', 'Next missing'),
    sli: roll('sli', 'SLIs', facts.filter((f) => f.sliIn).length, 'signed', 'tab_sli', 'Next missing'),
  }
  const ms = own.map((x) => rolled[x.key] ?? x)
  const cur = ms.findIndex((x) => !x.done)
  const late = subs.some((s) => s.urgency === 'overdue')
  return ms.map((x, i) => ({ ...x, state: x.done ? 'done' : i === cur && late ? 'late' : 'todo' }))
}

/** One next step for the whole consolidation. */
export function masterPlan(m: EaDetail, subs: EaRow[]): EaPlan {
  // The main HAWB's own SQL urgency is about its (empty) cargo; the subs decide how urgent this is.
  const tone: EaPlan['tone'] = subs.some((s) => s.urgency === 'overdue') ? 'red' : subs.some((s) => s.urgency === 'today') ? 'amber' : 'blue'
  if (!subs.length) return { title: 'Add sub-HAWBs', why: 'This main HAWB has no suppliers yet. Add HAWBs from the consol or enter one.', tone: 'amber', primary: { label: 'Add HAWB', action: 'add_sub' }, secondary: null }
  if (!m.consignee_account_id || !m.bill_to_account_id) return { title: 'Match TradeWindow accounts', why: 'The main HAWB needs consignee and bill-to codes for the consol XML.', tone, primary: { label: 'Match accounts', action: 'match' }, secondary: null }
  const open = subs.map((s) => ({ s, issues: subIssues(s) })).filter((x) => x.issues.length)
  if (open.length) {
    const low = (t: string) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t)
    const lead = open.slice(0, 2).map((x) => `${supplierOf(x.s)}: ${low(x.issues[0])}`).join(' · ')
    return { title: `${open.length} of ${subs.length} sub-HAWBs need attention`, why: `${lead}${open.length > 2 ? ` · +${open.length - 2} more` : ''}`, tone, primary: { label: `Open ${open[0].s.booking_ref}`, action: 'tab_first' }, secondary: { label: 'Add HAWB', action: 'add_sub' } }
  }
  if (!m.consol_id) return { title: 'Allocate to consol', why: 'All suppliers are in. Put the main HAWB on a flight.', tone, primary: { label: 'Allocate', action: 'allocate' }, secondary: null }
  if (m.consol_status === 'exported' || m.consol_status === 'departed') return { title: 'In TradeWindow', why: 'Consol exported. Changes now happen in TradeWindow.', tone: 'green', primary: { label: 'Open consol', action: 'open_consol' }, secondary: null }
  return { title: `All ${subs.length} suppliers in`, why: 'Ready for consol close. Goes to TradeWindow as one house.', tone: 'green', primary: { label: 'Open consol', action: 'open_consol' }, secondary: null }
}

/** Plan for a sub-HAWB: TW codes and the consol belong to the main HAWB, so those steps are skipped. */
export function subPlan(b: EaDetail, tms: TmsJob | null, master: EaRow): EaPlan {
  const filled = { ...b, shipper_account_id: b.shipper_account_id ?? 'SUB', consignee_account_id: b.consignee_account_id ?? 'SUB', bill_to_account_id: b.bill_to_account_id ?? 'SUB', consol_id: b.consol_id ?? master.consol_id ?? 'SUB', consol_flight: b.consol_flight ?? master.consol_flight }
  const p = eaPlan(filled, tms, undefined)
  if (p.primary?.action === 'open_consol' || p.primary?.action === 'allocate' || !p.primary)
    return { title: 'Supplier complete', why: `Checked in and SLI signed. Goes to TradeWindow inside ${master.booking_ref}.`, tone: 'green', primary: { label: `Open main ${master.booking_ref}`, action: 'tab_master' }, secondary: null }
  return p
}

/** First sub that is missing a given thing, for the "Next missing" buttons. */
export function firstMissing(subs: EaRow[], what: 'pickup' | 'checkin' | 'sli' | 'any') {
  return subs.find((s) => {
    const f = eaFacts(s as unknown as EaDetail, null)
    if (what === 'pickup') return f.pickupMode && !f.pickupBooked && !f.checkedIn
    if (what === 'checkin') return !f.checkedIn
    if (what === 'sli') return !f.sliIn
    return subIssues(s).length > 0
  })
}

// ---- API ----
async function rpc<T>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}
export const consolidate = (ids: string[], master: string | null = null) => rpc<string>('ea_consolidate', { p_children: ids, p_master: master })
export const unconsolidate = (child: string) => rpc<void>('ea_unconsolidate', { p_child: child })
export const dissolve = (master: string) => rpc<void>('ea_dissolve', { p_master: master })

export type ManualSub = {
  shipper_account_id: string; shipper_name: string; shipper_address: string; shipper_city: string; shipper_contact: string; shipper_phone: string; shipper_email: string
  pieces: string; weight_kg: string; volume_m3: string; goods_description: string; cargo_ready_date: string; collection_mode: 'pickup' | 'dropoff'
}

/** Sub-HAWB typed in by staff: supplier and cargo here, buyer and flight copied from the main HAWB. */
export async function addManualSub(m: EaDetail, f: ManualSub) {
  const n = (v: string) => (v.trim() ? Number(v) : null)
  const t = (v: string) => v.trim() || null
  const { data: auth } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('bookings').insert({
    module: 'EA', source: 'manual', status: 'confirmed', account_id: m.account_id, origin: 'AKL', destination: m.destination,
    incoterm: m.incoterm, master_booking_id: m.id, consol_id: m.consol_id,
    consignee_account_id: m.consignee_account_id, consignee_name: m.consignee_name, consignee_address: m.consignee_address,
    consignee_city: m.consignee_city, bill_to_account_id: m.bill_to_account_id,
    shipper_account_id: t(f.shipper_account_id), shipper_name: t(f.shipper_name), shipper_address: t(f.shipper_address), shipper_city: t(f.shipper_city),
    shipper_contact: t(f.shipper_contact), shipper_phone: t(f.shipper_phone), shipper_email: t(f.shipper_email),
    pieces: n(f.pieces), weight_kg: n(f.weight_kg), gross_weight_kg: n(f.weight_kg), volume_m3: n(f.volume_m3), cbm: n(f.volume_m3),
    goods_description: t(f.goods_description), cargo_ready_date: f.cargo_ready_date || null,
    collection_mode: f.collection_mode, pickup_address: f.collection_mode === 'pickup' ? t(f.shipper_address) : null,
    created_by: auth.user?.id ?? null,
  }).select('id').single()
  if (error) throw new Error(error.message)
  if (n(f.pieces) || n(f.weight_kg)) {
    await supabase.from('booking_cargo_lines').insert({ booking_id: data.id, ord: 1, kind: 'booked', pieces: n(f.pieces), weight: n(f.weight_kg), cbm: n(f.volume_m3), goods_desc: t(f.goods_description) })
  }
  return data.id as string
}
