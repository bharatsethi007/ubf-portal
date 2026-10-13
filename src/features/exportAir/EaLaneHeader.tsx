import { useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import DateField from '@/components/DateField'
import { fmtNum, type AirConsol } from './eaTypes'
import { btn, btnPrimary } from './eaUi'
import { planConsol } from './useEaBoard'

type Props = {
  dest: string
  count: number
  unallocated: number
  consols: AirConsol[]
  onPlanned: () => void
}

/** Lane group header: AKL → dest, open consols as chips, inline "Plan consol". */
export default function EaLaneHeader({ dest, count, unallocated, consols, onPlanned }: Props) {
  const [open, setOpen] = useState(false)
  if (dest === 'UNSET') {
    return (
      <div className="flex items-center gap-3.5 px-3 pb-2 pt-3.5">
        <span className="text-[12.5px] font-semibold text-[#14161A]">No destination</span>
        <span className="text-[11.5px] text-[#B54708]">{count} booking{count === 1 ? '' : 's'} · set a destination to plan a consol</span>
      </div>
    )
  }
  return (
    <div className="relative flex flex-wrap items-center gap-3.5 px-3 pb-2 pt-3.5">
      <span className="text-[12.5px] font-semibold text-[#14161A]">AKL → {dest}</span>
      <span className="text-[11.5px] text-[#6B7280]">{count} booking{count === 1 ? '' : 's'} · {unallocated} unallocated</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {consols.map((c) => <ConsolChip key={c.id} c={c} />)}
        <button type="button" onClick={() => setOpen((o) => !o)} className="w-auto border-0 bg-transparent p-0 text-[11.5px] font-medium text-[#0A2472] hover:underline">
          + Plan consol
        </button>
      </div>
      {open ? <PlanForm dest={dest} onClose={() => setOpen(false)} onDone={() => { setOpen(false); onPlanned() }} /> : null}
    </div>
  )
}

function ConsolChip({ c }: { c: AirConsol }) {
  const live = c.status !== 'planned' || c.houses > 0
  const cut = c.cutoff_at ? ` · cut ${format(parseISO(c.cutoff_at), 'EEE HH:mm')}` : ''
  const meta = c.houses > 0 ? `${cut} · ${c.houses} houses · ${fmtNum(c.chg_kg)} kg` : `${cut} · planned`
  return (
    <Link
      to={`/bookings/export-air/consol/${c.id}`}
      title={c.mawb ? `MAWB ${c.mawb}` : 'No MAWB yet. Open consol'}
      className="whitespace-nowrap rounded-[5px] px-2 py-[3px] text-[11px] no-underline hover:brightness-95"
      style={live ? { color: '#0A2472', background: '#EEF1F9' } : { color: '#5B616E', border: '1px dashed #D5D9E0' }}
    >
      <span className="bk-mono font-medium">{c.flight_no}</span> {format(parseISO(c.flight_date), 'EEE d')}{meta}
    </Link>
  )
}

function PlanForm({ dest, onClose, onDone }: { dest: string; onClose: () => void; onDone: () => void }) {
  const [flight, setFlight] = useState('')
  const [date, setDate] = useState<string | null>(null)
  const [cutDate, setCutDate] = useState<string | null>(null)
  const [cutTime, setCutTime] = useState('14:00')
  const [busy, setBusy] = useState(false)
  const input = 'h-[30px] rounded-[7px] border border-[#E3E6EB] px-2 text-[12px] outline-none focus:border-[#0A2472]'

  async function save() {
    if (!flight.trim() || !date) return toast.error('Flight and date needed')
    setBusy(true)
    try {
      const cutoff = cutDate ? new Date(`${cutDate}T${cutTime || '00:00'}:00`).toISOString() : null
      const code = flight.trim().toUpperCase().replace(/\s+/g, '')
      await planConsol({ destination: dest, airline: code.slice(0, 2), flight_no: code, flight_date: date, cutoff_at: cutoff })
      toast.success(`${code} planned`)
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="absolute left-3 top-full z-20 mt-1 flex flex-wrap items-end gap-2 rounded-[10px] border border-[#E3E6EB] bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,.10)]">
      <label className="flex flex-col gap-1 text-[10.5px] uppercase tracking-[.04em] text-[#6B7280]">
        Flight
        <input autoFocus value={flight} onChange={(e) => setFlight(e.target.value)} placeholder="NZ952" className={`${input} bk-mono w-[90px] normal-case`} />
      </label>
      <div className="flex flex-col gap-1 text-[10.5px] uppercase tracking-[.04em] text-[#6B7280]">
        Flight date
        <DateField value={date} onChange={setDate} width={130} />
      </div>
      <div className="flex flex-col gap-1 text-[10.5px] uppercase tracking-[.04em] text-[#6B7280]">
        Cutoff
        <div className="flex gap-1">
          <DateField value={cutDate} onChange={setCutDate} width={130} />
          <input aria-label="Cutoff time" value={cutTime} onChange={(e) => setCutTime(e.target.value)} className={`${input} bk-mono w-[64px]`} />
        </div>
      </div>
      <button type="button" className={btn} onClick={onClose}>Cancel</button>
      <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}>Plan</button>
    </div>
  )
}
