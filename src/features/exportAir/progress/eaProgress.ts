import type { BookingProgress, Milestone } from '@/features/bookingRecord/progress/progressApi'
import type { AirConsol } from '../eaTypes'
import type { EaDetail, TmsJob } from '../useEaBooking'

export type EaAction =
  | 'confirm' | 'match' | 'book_pickup' | 'open_tms' | 'mail_supplier' | 'allocate' | 'open_consol' | 'edit'
  | 'attach_quote' | 'get_quote' | 'view_quote' | 'send_bc' | 'open_sli' | 'view_checkin' | 'none'
  | 'tab_pickup' | 'tab_checkin' | 'tab_sli' | 'tab_first' | 'add_sub' | 'tab_master'

export type StepCta = { label: string; action: EaAction; disabled?: boolean; title?: string; tone?: 'primary' | 'quiet' }
export type EaMilestone = Milestone & { ctas: StepCta[] }

export type EaPlan = {
  title: string; why: string; tone: 'red' | 'amber' | 'blue' | 'green'
  primary: { label: string; action: EaAction } | null
  secondary: { label: string; action: EaAction } | null
}

/** Facts, not stage numbers: a booking can sit on a planned consol before the cargo is in. */
export function eaFacts(b: EaDetail, tms: TmsJob | null) {
  const checkedIn = b.act_pcs != null || !!(tms?.wms_checkin_at ?? b.wms_checkin_at)
  const pickupMode = b.collection_mode !== 'dropoff'
  const pickupBooked = !!(tms ?? b.tms_no)
  const sliIn = b.sli_status === 'endorsed' || !!b.sli_signed_at
  const sliSent = !!b.sli_status && b.sli_status !== 'expired'
  const exported = b.consol_status === 'exported' || b.consol_status === 'departed'
  return { checkedIn, pickupMode, pickupBooked, sliIn, sliSent, exported, departed: b.consol_status === 'departed' }
}

const toneOf = (u: string | null): EaPlan['tone'] =>
  u === 'overdue' || u === 'blocked' ? 'red' : u === 'today' ? 'amber' : u === 'soon' ? 'blue' : 'green'

/** Eight EA milestones, each with the button that moves it on. */
export function eaMilestones(b: EaDetail, tms: TmsJob | null): EaMilestone[] {
  const f = eaFacts(b, tms)
  const booked = b.stage >= 0
  const ms: Omit<EaMilestone, 'state'>[] = [
    {
      key: 'quote', label: 'Quote', owner: 'ubf', done: !!b.quote_no, at: null, due: null, note: b.quote_no ?? 'No quote',
      ctas: b.quote_no ? [{ label: 'View', action: 'view_quote', tone: 'quiet' }]
        : [{ label: 'Attach', action: 'attach_quote' }, { label: 'Get quote', action: 'get_quote', tone: 'quiet' }],
    },
    {
      key: 'booked', label: 'Booked', owner: 'ubf', done: booked, at: booked ? b.created_at : null, due: null,
      note: !booked ? 'Draft' : b.bc_sent_at ? `BC sent ${new Date(b.bc_sent_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}` : 'BC not sent',
      ctas: booked ? [{ label: b.bc_sent_at ? 'Resend BC' : 'Send BC', action: 'send_bc', tone: b.bc_sent_at ? 'quiet' : 'primary' }]
        : [{ label: 'Confirm', action: 'confirm' }],
    },
    f.pickupMode ? {
      key: 'pickup', label: 'Pickup', owner: 'ubf', done: f.pickupBooked || f.checkedIn, at: tms?.picked_up_at ?? b.picked_up_at ?? null,
      due: b.cargo_ready_date, note: tms?.consignment_no ?? b.tms_no ?? (f.pickupBooked ? null : 'Not booked'),
      ctas: f.pickupBooked ? [{ label: 'Open job', action: 'open_tms', tone: 'quiet' }] : [{ label: 'Book pickup', action: 'book_pickup' }],
    } : {
      key: 'pickup', label: 'Drop-off', owner: 'customer', done: f.checkedIn, at: null, due: b.cargo_ready_date, note: 'Supplier delivers',
      ctas: f.checkedIn ? [] : [{ label: 'Email supplier', action: 'mail_supplier' }],
    },
    {
      key: 'checkin', label: 'Checked in', owner: 'ubf', done: f.checkedIn, at: tms?.wms_checkin_at ?? b.wms_checkin_at ?? null, due: null,
      note: f.checkedIn ? (b.act_pcs != null ? `${b.act_pcs} pcs · ${b.act_kg ?? '—'} kg` : null) : 'Warehouse',
      ctas: f.checkedIn && tms ? [{ label: 'Check-in sheet', action: 'view_checkin', tone: 'quiet' }] : [],
    },
    {
      key: 'sli', label: 'SLI', owner: 'customer', done: f.sliIn, at: b.sli_signed_at, due: null,
      note: f.sliIn ? 'Received' : f.sliSent ? (b.sli_status === 'viewed' ? 'Opened, not signed' : 'Sent') : 'Not sent',
      ctas: f.sliIn ? [{ label: 'View', action: 'open_sli', tone: 'quiet' }]
        : f.sliSent ? [{ label: 'Resend link', action: 'open_sli' }] : [{ label: 'Send SLI link', action: 'open_sli' }],
    },
    {
      key: 'consol', label: 'Consol', owner: 'ubf', done: !!b.consol_id, at: null, due: null, note: b.consol_flight ?? 'Unallocated',
      ctas: b.consol_id ? [{ label: 'Open', action: 'open_consol', tone: 'quiet' }] : [{ label: 'Allocate', action: 'allocate' }],
    },
    {
      key: 'exported', label: 'Exported', owner: 'ubf', done: f.exported, at: null, due: null, note: f.exported ? 'In TradeWindow' : 'At consol close',
      ctas: b.consol_id && !f.exported ? [{ label: 'Close consol', action: 'open_consol', tone: 'quiet' }] : [],
    },
    { key: 'departed', label: 'Departed', owner: 'carrier', done: f.departed, at: null, due: b.consol_date, note: null, ctas: [] },
  ]
  const late = b.urgency === 'overdue'
  const cur = ms.findIndex((m) => !m.done)
  return ms.map((m, i) => ({ ...m, state: m.done ? 'done' : i === cur && late ? 'late' : 'todo' }))
}

export function eaProgress(b: EaDetail, milestones: EaMilestone[]): BookingProgress {
  return {
    booking_id: b.id, module: 'EA', load_type: null, ref: b.booking_ref, stage: String(b.stage), next_action: b.next_action,
    action_due: b.action_due, urgency: b.urgency, eta: null, lfd: null, depot: null, containers: 0,
    delivery_date: null, delivery_mode: null, hold: b.hold_code, milestones,
    done: milestones.filter((m) => m.done).length, total: milestones.length,
  }
}

/** Deterministic next step for export air: one reason, one button. */
export function eaPlan(b: EaDetail, tms: TmsJob | null, best: AirConsol | undefined): EaPlan {
  const f = eaFacts(b, tms)
  const tone = toneOf(b.urgency)
  const p = (title: string, why: string, primary: EaPlan['primary'], secondary: EaPlan['secondary'] = null): EaPlan => ({ title, why, tone, primary, secondary })
  if (f.exported) return { title: 'In TradeWindow', why: 'Consol exported. Changes now happen in TradeWindow and sync back.', tone: 'green', primary: { label: 'Open consol', action: 'open_consol' }, secondary: null }
  if (b.stage < 0) {
    const from = b.source === 'customer_portal' ? 'portal' : b.source?.startsWith('email') ? 'email' : 'manual entry'
    return p('Confirm booking', `Draft from ${from}. Check the details, then confirm.`, { label: 'Confirm booking', action: 'confirm' }, { label: 'Edit details', action: 'edit' })
  }
  if (!b.shipper_account_id || !b.consignee_account_id || !b.bill_to_account_id) {
    const miss = [!b.shipper_account_id && 'shipper', !b.consignee_account_id && 'consignee', !b.bill_to_account_id && 'bill-to'].filter(Boolean).join(', ')
    return p('Match TradeWindow accounts', `No code for ${miss}. The consol XML needs all three.`, { label: 'Match accounts', action: 'match' })
  }
  if (f.pickupMode && !f.pickupBooked && !f.checkedIn) return p('Book pickup', b.cargo_ready_date ? `Cargo ready ${b.cargo_ready_date}. No TMS job yet.` : 'No TMS job yet.', { label: 'Book pickup', action: 'book_pickup' })
  if (!f.checkedIn) {
    return f.pickupMode
      ? p('Waiting for check-in', `${tms?.consignment_no ?? b.tms_no ?? 'Pickup'} is with dispatch. Warehouse checks it in on arrival.`, { label: 'Open TMS job', action: 'open_tms' })
      : p('Await supplier drop-off', 'Supplier is delivering to Mangere. Warehouse checks it in on arrival.', { label: 'Email supplier', action: 'mail_supplier' })
  }
  if (!f.sliIn) return p(f.sliSent ? 'Chase the SLI' : 'Send SLI link', f.sliSent ? 'SLI sent, not signed yet.' : 'Supplier needs to sign the SLI before export.', { label: f.sliSent ? 'Resend SLI link' : 'Send SLI link', action: 'open_sli' })
  if (!b.consol_id) {
    return best
      ? p('Allocate to consol', `Best match ${best.flight_no}, ${best.houses} houses on it.`, { label: `Allocate to ${best.flight_no}`, action: 'allocate' }, { label: 'Other consol', action: 'open_consol' })
      : p('Allocate to consol', 'No consol planned for this lane yet.', null)
  }
  return p(`On ${b.consol_flight}`, 'Ready for close. Goes to TradeWindow with the consol.', { label: 'Open consol', action: 'open_consol' })
}
