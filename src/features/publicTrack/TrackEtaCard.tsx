import { CalendarPlus } from 'lucide-react'
import type { PublicTrack } from './trackApi'
import { STATUS_LABEL, daysAway, etaIcs, fmtDay, fmtTime, progress, scheduleNote } from './trackFormat'

const TONE = { good: 'text-emerald-300', warn: 'text-amber-300', bad: 'text-rose-300' } as const

function downloadIcs(t: PublicTrack) {
  const ics = etaIcs(t)
  if (!ics) return
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url; a.download = `${t.ref ?? 'shipment'}-arrival.ics`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Navy header: status, the one big date, and the journey bar. */
export default function TrackEtaCard({ t }: { t: PublicTrack }) {
  const arrived = Boolean(t.eta.actual)
  const deliveredAt = t.status === 'delivered' ? t.milestones.find((m) => m.key === 'delivered')?.at ?? null : null
  const when = deliveredAt ?? t.eta.actual ?? t.eta.predicted
  const note = !arrived ? scheduleNote(t) : null
  const away = !arrived ? daysAway(when) : null
  const pct = Math.round(progress(t) * 100)
  const label = t.status === 'delivered' ? 'Delivered' : arrived ? `Arrived ${t.destination.name ?? ''}` : `Estimated arrival ${t.destination.name ?? ''}`

  return (
    <div className="bg-[#0A2472] px-5 pb-5 pt-4 text-white">
      <div className="flex items-center justify-between">
        <img src="/ub-freight-logo-white.png" alt="UB Freight" className="h-8 w-auto" />
        <span className="rounded-full bg-[#F7941D] px-2.5 py-0.5 text-xs font-medium text-[#3a2100]">{STATUS_LABEL[t.status]}</span>
      </div>

      <p className="mt-5 text-xs uppercase tracking-wider text-blue-200/80">{label.trim()}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div>
          <p className="text-[28px] font-medium leading-tight">{fmtDay(when)}</p>
          <p className="text-sm text-blue-100/90">
            {[fmtTime(when), away].filter(Boolean).join(' · ') || ' '}
          </p>
        </div>
        {!arrived && when ? (
          <button type="button" onClick={() => downloadIcs(t)} title="Add arrival to calendar" aria-label="Add arrival to calendar"
            className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20">
            <CalendarPlus size={17} />
          </button>
        ) : null}
      </div>
      {note ? <p className={`mt-1 text-xs ${TONE[note.tone]}`}>{note.text}</p> : null}

      <div className="mt-5 flex justify-between text-[11px] font-medium tracking-wide text-blue-100/80">
        <span>{t.origin.name ?? 'Origin'}</span>
        <span>{t.destination.name ?? 'Destination'}</span>
      </div>
      <div className="relative mt-1.5 h-1.5 rounded-full bg-white/15">
        <div className="absolute inset-y-0 left-0 rounded-full bg-[#F7941D] transition-all duration-700" style={{ width: `${pct}%` }} />
        <div className="absolute -top-[5px] h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-[#F7941D] transition-all duration-700"
          style={{ left: `${pct}%` }} />
      </div>
    </div>
  )
}
