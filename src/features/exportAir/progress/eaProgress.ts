import type { BookingProgress, Milestone } from '@/features/bookingRecord/progress/progressApi'
import type { AirConsol } from '../eaTypes'
import type { EaDetail } from '../useEaBooking'

export type EaAction =
  | 'confirm' | 'match' | 'book_pickup' | 'open_tms' | 'mail_supplier' | 'allocate' | 'open_consol' | 'edit' | 'none'

export type EaPlan = {
  title: string; why: string; tone: 'red' | 'amber' | 'blue' | 'green'
  primary: { label: string; action: EaAction } | null
  secondary: { label: string; action: EaAction } | null
}

const toneOf = (u: string | null): EaPlan['tone'] =>
  u === 'overdue' || u === 'blocked' ? 'red' : u === 'today' ? 'amber' : u === 'soon' ? 'blue' : 'green'

/** EA milestones in the same shape Import Sea's progress panel draws. Derived from facts, never typed. */
export function eaMilestones(b: EaDetail): Milestone[] {
  const late = b.urgency === 'overdue'
  const ms: Omit<Milestone, 'state'>[] = [
    { key: 'quote', label: 'Quote', owner: 'ubf', done: !!b.quote_no || b.stage >= 0, at: null, due: null, note: b.quote_no ?? 'No quote' },
    { key: 'booked', label: 'Booked', owner: 'ubf', done: b.stage >= 0, at: b.created_at, due: null, note: null },
    {
      key: 'pickup', label: b.collection_mode === 'dropoff' ? 'Drop-off' : 'Pickup', owner: b.collection_mode === 'dropoff' ? 'customer' : 'ubf',
      done: b.stage >= 2 || !!b.picked_up_at || (b.collection_mode !== 'dropoff' && b.stage >= 1),
      at: b.picked_up_at ?? null, due: b.cargo_ready_date, note: b.tms_no,
    },
    { key: 'checkin', label: 'Checked in', owner: 'ubf', done: b.stage >= 2, at: b.wms_checkin_at, due: null, note: null },
    { key: 'sli', label: 'SLI', owner: 'customer', done: !!b.sli_signed_at, at: b.sli_signed_at, due: null, note: b.sli_status },
    { key: 'consol', label: 'Consol', owner: 'ubf', done: !!b.consol_id, at: null, due: null, note: b.consol_flight },
    { key: 'exported', label: 'Exported', owner: 'ubf', done: b.stage >= 5, at: null, due: null, note: 'At consol close' },
    { key: 'departed', label: 'Departed', owner: 'carrier', done: b.stage >= 6, at: null, due: b.consol_date, note: null },
  ]
  const cur = ms.findIndex((m) => !m.done)
  return ms.map((m, i) => ({ ...m, state: m.done ? 'done' : i === cur && late ? 'late' : 'todo' }))
}

export function eaProgress(b: EaDetail): BookingProgress {
  const milestones = eaMilestones(b)
  return {
    booking_id: b.id, module: 'EA', load_type: null, ref: b.booking_ref, stage: String(b.stage), next_action: b.next_action,
    action_due: b.action_due, urgency: b.urgency, eta: null, lfd: null, depot: null, containers: 0,
    delivery_date: null, delivery_mode: null, hold: b.hold_code, milestones,
    done: milestones.filter((m) => m.done).length, total: milestones.length,
  }
}

/** Deterministic next step for export air: one reason, one button. */
export function eaPlan(b: EaDetail, best: AirConsol | undefined): EaPlan {
  const tone = toneOf(b.urgency)
  const p = (title: string, why: string, primary: EaPlan['primary'], secondary: EaPlan['secondary'] = null): EaPlan => ({ title, why, tone, primary, secondary })
  const locked = b.consol_status === 'exported' || b.consol_status === 'departed'
  if (locked) return { title: 'In TradeWindow', why: 'Consol exported. Changes now happen in TradeWindow and sync back.', tone: 'green', primary: { label: 'Open consol', action: 'open_consol' }, secondary: null }
  if (b.stage < 0) {
    const from = b.source === 'customer_portal' ? 'portal' : b.source?.startsWith('email') ? 'email' : 'manual entry'
    return p('Confirm booking', `Draft from ${from}. Check the details, then confirm.`, { label: 'Confirm booking', action: 'confirm' }, { label: 'Edit details', action: 'edit' })
  }
  if (!b.shipper_account_id || !b.consignee_account_id || !b.bill_to_account_id) {
    const miss = [!b.shipper_account_id && 'shipper', !b.consignee_account_id && 'consignee', !b.bill_to_account_id && 'bill-to'].filter(Boolean).join(', ')
    return p('Match TradeWindow accounts', `No code for ${miss}. The consol XML needs all three.`, { label: 'Match accounts', action: 'match' })
  }
  if (b.stage === 0 && b.collection_mode !== 'dropoff') return p('Book pickup', b.cargo_ready_date ? `Cargo ready ${b.cargo_ready_date}. No TMS job yet.` : 'No TMS job yet.', { label: 'Book pickup', action: 'book_pickup' })
  if (b.stage === 0) return p('Await supplier drop-off', 'Supplier is delivering to Mangere.', { label: 'Email supplier', action: 'mail_supplier' })
  if (b.stage === 1) return p('Pickup booked', `${b.tms_no ?? 'TMS job'} is with dispatch.`, { label: 'Open TMS job', action: 'open_tms' })
  if (!b.consol_id) {
    return best
      ? p('Allocate to consol', `Best match ${best.flight_no}, ${best.houses} houses on it.`, { label: `Allocate to ${best.flight_no}`, action: 'allocate' }, { label: 'Other consol', action: 'open_consol' })
      : p('Allocate to consol', 'No consol planned for this lane yet.', null)
  }
  return p(`On ${b.consol_flight}`, 'Ready for close. Goes to TradeWindow with the consol.', { label: 'Open consol', action: 'open_consol' })
}
