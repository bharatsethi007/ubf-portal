import { Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { EaDetail } from './useEaBooking'

const d = (iso: string | null | undefined) => (iso ? format(parseISO(iso), 'd MMM') : '')

/** Quote → Booked → Pickup → Checked in → SLI → Consol → Exported → Departed. Derived, never typed. */
export default function EaLifecycle({ b }: { b: EaDetail }) {
  const checked = b.stage >= 2
  const steps: { title: string; sub: string; done: boolean }[] = [
    { title: 'Quote', sub: b.quote_no ?? 'No quote', done: !!b.quote_no },
    { title: 'Booked', sub: b.stage >= 0 ? d(b.created_at) : 'Draft', done: b.stage >= 0 },
    {
      title: b.collection_mode === 'dropoff' ? 'Drop-off' : 'Pickup',
      sub: b.collection_mode === 'dropoff' ? 'Supplier delivers' : b.tms_no ? `${b.tms_no}${b.picked_up_at ? ` · ${d(b.picked_up_at)}` : ''}` : 'Not booked',
      done: b.stage >= 1 || (b.collection_mode === 'dropoff' && checked),
    },
    { title: 'Checked in', sub: checked ? `${b.act_pcs ?? b.pieces ?? ''} pcs · ${b.act_kg ?? b.weight_kg ?? ''} kg` : 'Waiting', done: checked },
    { title: 'SLI', sub: b.sli_signed_at ? `Signed ${d(b.sli_signed_at)}` : b.sli_status ?? 'Not sent', done: !!b.sli_signed_at },
    { title: 'Consol', sub: b.consol_flight ? `${b.consol_flight} · ${d(b.consol_date)}` : 'Unallocated', done: !!b.consol_id },
    { title: 'Exported', sub: b.stage >= 5 ? 'In TradeWindow' : 'At consol close', done: b.stage >= 5 },
    { title: 'Departed', sub: b.stage >= 6 ? 'Confirmed by sync' : 'From TW sync', done: b.stage >= 6 },
  ]
  const cur = steps.findIndex((s) => !s.done)

  return (
    <ol aria-label="Lifecycle" className="m-0 mt-4 grid list-none grid-cols-[repeat(8,minmax(110px,1fr))] overflow-x-auto rounded-[10px] border border-[#EEF0F3] px-4 py-3.5">
      {steps.map((s, i) => {
        const isCur = i === cur
        return (
          <li key={s.title} className="flex min-w-[110px] flex-col gap-1.5 pr-2.5">
            <div className="flex items-center">
              <span
                className="grid h-4 w-4 shrink-0 place-items-center rounded-full"
                style={s.done ? { background: '#0A2472' } : isCur ? { border: '2px solid #0A2472' } : { border: '1.5px solid #D5D9E0' }}
              >
                {s.done ? <Check size={9} strokeWidth={3.5} color="#fff" /> : null}
              </span>
              {i < steps.length - 1 ? <span className="ml-1.5 h-0.5 flex-1 rounded-sm" style={{ background: s.done ? '#0A2472' : '#E6E8EE' }} /> : null}
            </div>
            <div className={`text-[12px] ${isCur ? 'font-semibold' : 'font-medium'}`} style={{ color: s.done || isCur ? '#14161A' : '#98A2B3' }}>{s.title}</div>
            <div className="text-[11px] leading-snug text-[#6B7280]">{s.sub}</div>
          </li>
        )
      })}
    </ol>
  )
}
