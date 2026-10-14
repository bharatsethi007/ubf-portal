// Board-row status, same rules as the HAWB progress panel: milestone track, what's outstanding, next step.
import type { LucideIcon } from 'lucide-react'
import { CircleCheck, ClipboardCheck, FilePen, Layers, Link2, Mail, Pencil, Plane, PlaneTakeoff, Plus, Receipt, Truck, Warehouse } from 'lucide-react'
import type { AirConsol, EaRow } from './eaTypes'
import type { EaDetail } from './useEaBooking'
import { eaFacts, eaMilestones, eaPlan, type EaAction } from './progress/eaProgress'
import { masterMilestones, masterPlan, subIssues, supplierOf } from './eaMaster'

export type RowStatus = {
  steps: { key: string; label: string; done: boolean; late: boolean }[]
  text: string            // first outstanding item, e.g. "Not checked in"
  more: string[]          // further outstanding items
  plan: { title: string; why: string; action: EaAction | null; tone: 'red' | 'amber' | 'blue' | 'green' }
}

/** Short "what's missing" list, in the order work happens. */
function outstanding(b: EaDetail): string[] {
  const f = eaFacts(b, null)
  if (b.stage < 0) return ['Draft, needs review']
  if (f.departed) return ['Departed']
  if (f.exported) return ['In TradeWindow']
  const out: string[] = []
  if (!b.shipper_account_id || !b.consignee_account_id || !b.bill_to_account_id) out.push('Accounts not matched')
  if (!f.checkedIn) out.push(f.pickupMode ? (f.pickupBooked ? 'Not checked in' : 'Pickup not booked') : 'Awaiting drop-off')
  if (!f.sliIn) out.push(f.sliSent ? (b.sli_status === 'viewed' ? 'SLI opened, not signed' : 'Waiting for SLI') : 'SLI not sent')
  if (!b.bc_sent_at) out.push('BC not sent')
  if (!b.consol_id) out.push('Not allocated')
  return out.length ? out : ['Ready for close']
}

export function rowStatus(r: EaRow, consols: AirConsol[]): RowStatus {
  const b = r as unknown as EaDetail
  const ms = eaMilestones(b, null)
  const lane = consols.filter((c) => c.destination === (r.destination || 'NAN').toUpperCase() && !['exported', 'departed', 'closed', 'cancelled'].includes(c.status))
  const best = lane.find((c) => !c.cutoff_at || Date.parse(c.cutoff_at) > Date.now()) ?? lane[0]
  const p = eaPlan(b, null, best)
  const list = outstanding(b)
  return {
    steps: ms.map((m) => ({ key: m.key, label: m.label, done: m.done, late: m.state === 'late' })),
    text: list[0], more: list.slice(1),
    plan: { title: p.title, why: p.why, action: p.primary?.action ?? null, tone: p.tone },
  }
}

export const ACTION_ICON: Partial<Record<EaAction, LucideIcon>> = {
  confirm: ClipboardCheck, edit: Pencil, match: Link2, book_pickup: Truck, open_tms: Warehouse,
  mail_supplier: Mail, open_sli: FilePen, allocate: PlaneTakeoff, open_consol: Plane, send_bc: Receipt,
  tab_first: Layers, add_sub: Plus, tab_pickup: Truck, tab_checkin: Warehouse, tab_sli: FilePen,
}
export const DoneIcon = CircleCheck

/** Main HAWB on the board: track and status rolled up from its sub-HAWBs. */
export function masterRowStatus(m: EaRow, subs: EaRow[]): RowStatus {
  const b = m as unknown as EaDetail
  const ms = masterMilestones(b, subs)
  const p = masterPlan(b, subs)
  const open = subs.map((s) => ({ s, i: subIssues(s) })).filter((x) => x.i.length)
  const text = !subs.length ? 'No suppliers yet' : open.length ? `${open.length} of ${subs.length} suppliers incomplete` : `All ${subs.length} suppliers in`
  return {
    steps: ms.map((x) => ({ key: x.key, label: `${x.label}${x.note ? ` · ${x.note}` : ''}`, done: x.done, late: x.state === 'late' })),
    text: open.length || !subs.length ? text : m.consol_id ? 'Ready for close' : text,
    more: open.map((x) => `${supplierOf(x.s)}: ${x.i.join(', ')}`),
    plan: { title: p.title, why: p.why, action: p.primary?.action ?? null, tone: p.tone },
  }
}

export const statusFor = (r: EaRow, consols: AirConsol[], subsOf: Map<string, EaRow[]>) =>
  r.is_consolidation ? masterRowStatus(r, subsOf.get(r.id) ?? []) : rowStatus(r, consols)

/** Sub-HAWB of a buyers consol: TW codes and allocation belong to the main HAWB, so only supplier-side work counts. */
export function subRowStatus(r: EaRow): RowStatus {
  const b = r as unknown as EaDetail
  const issues = subIssues(r)
  const first = issues[0] ?? ''
  const action: EaAction | null = /draft/i.test(first) ? 'confirm' : /pickup not booked/i.test(first) ? 'book_pickup'
    : /checked in|dropped/i.test(first) ? 'open_tms' : /SLI/.test(first) ? 'open_sli' : issues.length ? 'edit' : null
  return {
    steps: eaMilestones(b, null).filter((m) => ['pickup', 'checkin', 'sli'].includes(m.key)).map((m) => ({ key: m.key, label: m.label, done: m.done, late: m.state === 'late' })),
    text: first || 'Complete', more: issues.slice(1),
    plan: { title: first || 'Supplier complete', why: issues.length ? `${supplierOf(r)} · ${issues.join(', ')}` : 'Checked in and SLI signed.', action, tone: r.urgency === 'overdue' ? 'red' : issues.length ? 'amber' : 'green' },
  }
}
