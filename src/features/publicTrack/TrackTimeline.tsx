import { useState } from 'react'
import { Check, ChevronDown, Ship } from 'lucide-react'
import type { Milestone, PublicTrack } from './trackApi'
import { fmtStamp } from './trackFormat'

function Dot({ m }: { m: Milestone }) {
  if (m.done) return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Check size={12} strokeWidth={3} /></span>
  )
  if (m.current) return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F7941D] text-white ring-4 ring-[#F7941D]/20"><Ship size={11} /></span>
  )
  return <span className="block h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-slate-300 bg-white" />
}

function Row({ m, last }: { m: Milestone; last: boolean }) {
  const [open, setOpen] = useState(m.current)
  const expandable = m.details.some((d) => d.at)
  const title = m.key === 'released' || !m.place ? m.title
    : m.key.startsWith('ts-') ? `${m.title} · ${m.place}` : `${m.title} ${m.place}`
  const when = m.at ? `${fmtStamp(m.at)}${m.estimated && !m.done ? ' · expected' : ''}` : m.done ? '' : 'Pending'

  return (
    <li className="relative flex gap-3 pb-5">
      {!last ? <span className={`absolute left-[9px] top-6 h-[calc(100%-18px)] w-0.5 ${m.done ? 'bg-emerald-600/60' : 'bg-slate-200'}`} /> : null}
      <div className="relative z-10 pt-0.5"><Dot m={m} /></div>
      <div className="min-w-0 flex-1">
        <button type="button" disabled={!expandable} onClick={() => setOpen(!open)} aria-expanded={open}
          className="flex w-full items-start justify-between gap-2 text-left disabled:cursor-default">
          <span>
            <span className={`block text-sm font-medium ${m.done || m.current ? 'text-slate-900' : 'text-slate-400'}`}>{title}</span>
            <span className={`block text-xs ${m.estimated && !m.done ? 'text-amber-700' : 'text-slate-500'}`}>{when}</span>
          </span>
          {expandable ? <ChevronDown size={15} className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} /> : null}
        </button>
        {open && expandable ? (
          <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs">
            {m.details.map((d) => (
              <li key={d.label} className="flex justify-between gap-3">
                <span className={d.done ? 'text-slate-600' : 'text-slate-400'}>{d.label}</span>
                <span className={`tabular-nums ${d.estimated ? 'text-amber-700' : d.done ? 'text-slate-700' : 'text-slate-400'}`}>
                  {d.at ? `${fmtStamp(d.at)}${d.estimated ? ' (est.)' : ''}` : 'Pending'}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  )
}

export default function TrackTimeline({ t }: { t: PublicTrack }) {
  return (
    <ol className="px-5 pt-4">
      {t.milestones.map((m, i) => <Row key={m.key} m={m} last={i === t.milestones.length - 1} />)}
    </ol>
  )
}
