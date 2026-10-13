import type { ReactNode } from 'react'
import { Eye } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import DateField from '@/components/DateField'
import CustomerPicker from '@/components/bookings/CustomerPicker'
import EaCargoLines from '@/pages/inbox/EaCargoLines'
import type { EaForm } from '@/pages/inbox/eaBookingApi'
import type { EmailAttachment } from '@/pages/inbox/inboxApi'
import type { AirConsol } from '../eaTypes'
import EaIntakeParty from './EaIntakeParty'
import type { Accounts, Matched } from './useIntake'

const INCOTERMS = ['', 'EXW', 'FCA', 'FOB', 'CPT', 'CIP', 'DAP', 'DDP']
const DESTS = ['NAN', 'SUV', 'APW', 'TBU', 'VLI', 'HIR', 'RAR']
const inp = 'h-[30px] w-full rounded-[7px] border border-[#E3E6EB] bg-white px-2 text-[12.5px] text-[#14161A] outline-none focus:border-[#0A2472]'
const lbl = 'text-[10.5px] uppercase tracking-[.04em] text-[#6B7280]'

type Props = {
  form: EaForm
  accounts: Accounts
  matched: Matched
  consols: AirConsol[]
  consolId: string
  atts: EmailAttachment[]
  picked: Set<number>
  onForm: (p: Partial<EaForm>) => void
  onAccounts: (p: Partial<Accounts>) => void
  onConsol: (id: string) => void
  onPicked: (s: Set<number>) => void
  onView: (i: number) => void
}

export default function EaIntakeForm(p: Props) {
  const { form: f, accounts: a } = p
  const dest = (f.destination ?? '').toUpperCase()
  const low = new Set((f._low_confidence ?? []).map((x) => x.split(/[:.\s[]/)[0]))
  return (
    <div className="flex flex-col gap-3.5">
      {f._low_confidence?.length ? (
        <div className="rounded-lg bg-[#FFFAEB] px-3 py-2 text-[12px] text-[#93370D]">
          <b className="font-semibold">Check before creating:</b> {f._low_confidence.slice(0, 4).join(' · ')}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5">
        <EaIntakeParty label="Shipper · NZ supplier" account={a.shipper} matched={p.matched.shipper} party={f.shipper}
          quick={{ code: 'VARIFJ', name: 'VARIOUS KNOWN SHIPPER', text: 'Use VARIFJ' }}
          onAccount={(v) => p.onAccounts({ shipper: v })} onParty={(x) => p.onForm({ shipper: x })} />
        <EaIntakeParty label="Consignee" account={a.consignee} matched={p.matched.consignee} party={f.consignee}
          onAccount={(v) => p.onAccounts({ consignee: v })} onParty={(x) => p.onForm({ consignee: x })} />
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        <Field label="Destination" span="col-span-4" warn={low.has('destination')}>
          <div className="flex flex-wrap items-center gap-1">
            {DESTS.map((d) => (
              <button key={d} type="button" aria-pressed={dest === d} onClick={() => p.onForm({ destination: d })}
                className={`bk-mono h-[28px] w-auto rounded-[6px] border px-2 text-[11.5px] ${dest === d ? 'border-[#0A2472] bg-[#0A2472] text-white' : 'border-[#E3E6EB] bg-white text-[#14161A] hover:bg-[#F6F7F9]'}`}>{d}</button>
            ))}
            <input aria-label="Other destination" maxLength={3} placeholder="Other" value={DESTS.includes(dest) ? '' : dest}
              onChange={(e) => p.onForm({ destination: e.target.value.toUpperCase() })} className={`${inp} bk-mono w-[64px] uppercase`} />
          </div>
        </Field>
        <Field label="Bill to" span="col-span-2">
          {a.billTo ? (
            <div className="flex h-[30px] items-center gap-1.5 rounded-[7px] border border-[#E3E6EB] px-2">
              <span className="bk-mono rounded bg-[#EEF1F9] px-1 text-[10.5px] text-[#0A2472]">{a.billTo.account_id}</span>
              <span className="min-w-0 truncate text-[12px]">{a.billTo.name}</span>
              <button type="button" onClick={() => p.onAccounts({ billTo: null })} className="ml-auto w-auto border-0 bg-transparent p-0 text-[11px] font-medium text-[#0A2472] hover:underline">Change</button>
            </div>
          ) : <CustomerPicker compact value={null} onChange={(v) => p.onAccounts({ billTo: v })} />}
        </Field>
        <Field label="Incoterm">
          <select value={f.incoterm ?? ''} onChange={(e) => p.onForm({ incoterm: e.target.value || null })} className={inp}>
            {INCOTERMS.map((i) => <option key={i} value={i}>{i || 'Not set'}</option>)}
          </select>
        </Field>
        <Field label="Cargo ready"><DateField value={f.ready_date} onChange={(v) => p.onForm({ ready_date: v })} width="100%" /></Field>
        <Field label="PO / refs" span="col-span-2"><input value={f.po_refs ?? ''} onChange={(e) => p.onForm({ po_refs: e.target.value })} className={inp} /></Field>
        <Field label="Consol" span="col-span-2">
          <select value={p.consolId} onChange={(e) => p.onConsol(e.target.value)} className={inp}>
            <option value="">Leave unallocated</option>
            {p.consols.map((c) => <option key={c.id} value={c.id}>{c.flight_no} · {format(parseISO(c.flight_date), 'EEE d MMM')} · {c.houses} houses</option>)}
          </select>
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={lbl}>Cargo</span>
        <EaCargoLines lines={f.lines} onChange={(lines) => p.onForm({ lines })} />
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        <Field label="Goods" span="col-span-3"><input value={f.goods ?? ''} onChange={(e) => p.onForm({ goods: e.target.value })} className={inp} /></Field>
        <Field label="Dangerous goods">
          <label className="flex h-[30px] items-center gap-2 text-[12px]"><input type="checkbox" checked={f.is_dg} onChange={(e) => p.onForm({ is_dg: e.target.checked })} className="accent-[#0A2472]" /> DG
            {f.is_dg ? <input aria-label="UN number" placeholder="UN" value={f.un_number ?? ''} onChange={(e) => p.onForm({ un_number: e.target.value })} className={`${inp} bk-mono`} /> : null}
          </label>
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className={lbl}>How does it get to UBF?</span>
          <div role="radiogroup" aria-label="Collection" className="flex gap-0.5 rounded-[7px] bg-[#F2F4F7] p-0.5">
            {([[true, 'UBF collects'], [false, 'Supplier drops off']] as const).map(([v, t]) => (
              <button key={t} type="button" role="radio" aria-checked={f.pickup.needed === v} onClick={() => p.onForm({ pickup: { ...f.pickup, needed: v } })}
                className={`w-auto rounded-[5px] border-0 px-2.5 py-1 text-[11.5px] ${f.pickup.needed === v ? 'bg-white font-medium text-[#14161A] shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'bg-transparent text-[#5B616E]'}`}>{t}</button>
            ))}
          </div>
          {f.pickup.needed == null ? <span className="text-[11px] text-[#B54708]">Pick one</span> : null}
        </div>
        {f.pickup.needed ? (
          <div className="grid grid-cols-4 gap-2.5">
            <Field label="Pickup address" span="col-span-4">
              <input value={f.pickup.address ?? ''} placeholder={[a.shipper?.address1, a.shipper?.address2, a.shipper?.city].filter(Boolean).join(', ') || 'Street, suburb, city'}
                onChange={(e) => p.onForm({ pickup: { ...f.pickup, address: e.target.value } })} className={inp} />
            </Field>
            <Field label="Ready time"><input value={f.pickup.ready_time ?? ''} placeholder="09:00" onChange={(e) => p.onForm({ pickup: { ...f.pickup, ready_time: e.target.value } })} className={`${inp} bk-mono`} /></Field>
            <Field label="Site contact"><input value={f.pickup.contact ?? ''} onChange={(e) => p.onForm({ pickup: { ...f.pickup, contact: e.target.value } })} className={inp} /></Field>
            <Field label="Site phone" span="col-span-2"><input value={f.pickup.phone ?? ''} onChange={(e) => p.onForm({ pickup: { ...f.pickup, phone: e.target.value } })} className={inp} /></Field>
          </div>
        ) : null}
      </div>

      {p.atts.length ? (
        <div className="flex flex-col gap-1">
          <span className={lbl}>Save files to the booking</span>
          <ul className="m-0 flex list-none flex-col rounded-[8px] border border-[#EEF0F3] p-0">
            {p.atts.map((x, i) => (
              <li key={x.id} className="flex items-center gap-2 border-t border-[#F6F7F9] px-2.5 py-1 first:border-t-0">
                <input type="checkbox" aria-label={`Save ${x.name}`} checked={p.picked.has(x.id)} className="accent-[#0A2472]"
                  onChange={(e) => { const n = new Set(p.picked); if (e.target.checked) n.add(x.id); else n.delete(x.id); p.onPicked(n) }} />
                <span className="min-w-0 flex-1 truncate text-[12px]">{x.name}</span>
                <button type="button" title="View on the left" aria-label={`View ${x.name}`} onClick={() => p.onView(i)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border-0 bg-transparent text-[#98A2B3] hover:bg-[#F2F4F7] hover:text-[#0A2472]"><Eye size={14} /></button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Field label="Notes for ops">
        <textarea rows={2} value={f.notes ?? ''} onChange={(e) => p.onForm({ notes: e.target.value })} className={`${inp} h-auto py-1.5`} />
      </Field>
    </div>
  )
}

function Field({ label, span = '', warn, children }: { label: string; span?: string; warn?: boolean; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${span}`}>
      <span className={lbl} style={warn ? { color: '#B54708' } : undefined}>{label}{warn ? ' · check' : ''}</span>
      {children}
    </div>
  )
}
