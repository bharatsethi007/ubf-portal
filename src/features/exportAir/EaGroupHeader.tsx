import { Link } from 'react-router-dom'
import { ChevronRight, Pencil, Plus, Star } from 'lucide-react'
import { differenceInMinutes, format, parseISO } from 'date-fns'
import { awbOk, fmtAwb, fmtNum, type AirConsol } from './eaTypes'
import { Tag } from './eaUi'

const iconBtn = 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0 text-[#98A2B3] hover:bg-[#F2F4F7] hover:text-[#14161A]'

function Chevron({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`} title={open ? 'Collapse' : 'Expand'} onClick={onClick} className={iconBtn}>
      <ChevronRight size={14} className="transition-transform" style={{ transform: open ? 'rotate(90deg)' : undefined }} />
    </button>
  )
}

function cutoffText(iso: string | null) {
  if (!iso) return null
  const d = parseISO(iso)
  const mins = differenceInMinutes(d, new Date())
  if (mins < 0) return { text: `Cut ${format(d, 'EEE HH:mm')} · passed`, tone: '#B42318' }
  if (mins < 24 * 60) return { text: `Cut in ${Math.floor(mins / 60)}h ${mins % 60}m`, tone: '#B54708' }
  return { text: `Cut ${format(d, 'EEE d HH:mm')}`, tone: '#5B616E' }
}

type ConsolProps = {
  c: AirConsol
  open: boolean
  starred: boolean
  shown: number
  onToggle: () => void
  onStar: () => void
  onEdit: () => void
}

/** Consol group bar: collapse, star, flight, cutoff, MAWB, totals, details. */
export function ConsolGroupHeader({ c, open, starred, shown, onToggle, onStar, onEdit }: ConsolProps) {
  const cut = cutoffText(c.cutoff_at)
  const exported = c.status === 'exported'
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#EEF0F3] bg-[#FAFBFC] px-2 py-2">
      <Chevron open={open} onClick={onToggle} label={c.flight_no} />
      <button type="button" aria-pressed={starred} aria-label={starred ? 'Unstar consol' : 'Star consol'} title={starred ? 'Unstar' : 'Star to keep on top'} onClick={onStar} className={iconBtn}>
        <Star size={14} fill={starred ? '#F79009' : 'none'} color={starred ? '#F79009' : 'currentColor'} />
      </button>
      <Link to={`/bookings/export-air/consol/${c.id}`} className="bk-mono text-[12.5px] font-semibold text-[#0A2472] hover:underline">{c.flight_no}</Link>
      <span className="text-[12px] text-[#14161A]">{format(parseISO(c.flight_date), 'EEE d MMM')}</span>
      <span className="text-[11.5px] text-[#6B7280]">AKL → {c.destination}{c.transit_port ? ` via ${c.transit_port}` : ''}</span>
      {cut ? <span className="text-[11.5px]" style={{ color: cut.tone }}>{cut.text}</span> : null}
      {c.mawb
        ? <span className="bk-mono text-[11.5px]" style={{ color: awbOk(c.mawb) ? '#14161A' : '#B54708' }} title={awbOk(c.mawb) ? 'MAWB' : 'MAWB check digit looks wrong'}>{fmtAwb(c.mawb)}</span>
        : <Tag tone="amber">No MAWB</Tag>}
      <Tag tone={exported ? 'green' : c.status === 'confirmed' ? 'navy' : 'grey'}>{exported ? 'Exported' : c.status === 'confirmed' ? 'Confirmed' : 'Planned'}</Tag>
      <span className="ml-auto flex items-center gap-3">
        <span className="bk-mono text-[11.5px] text-[#5B616E]">
          {c.houses} {c.houses === 1 ? 'house' : 'houses'} · {fmtNum(c.pieces)} pcs · {fmtNum(c.kg)} kg · <b className="font-medium text-[#14161A]">{fmtNum(c.chg_kg)}</b> chg
          {shown !== c.houses ? <span className="text-[#98A2B3]"> · {shown} in view</span> : null}
        </span>
        <button type="button" aria-label={`Edit consol ${c.flight_no}`} title="Consol details" onClick={onEdit} className={iconBtn}><Pencil size={13} /></button>
      </span>
    </div>
  )
}

type LaneProps = { dest: string; count: number; open: boolean; onToggle: () => void; onPlan?: () => void }

/** Unallocated bookings for one lane. */
export function LaneGroupHeader({ dest, count, open, onToggle, onPlan }: LaneProps) {
  const unset = dest === 'UNSET'
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#EEF0F3] bg-[#FAFBFC] px-2 py-2">
      <Chevron open={open} onClick={onToggle} label={unset ? 'no destination' : `unallocated ${dest}`} />
      <span className="text-[12.5px] font-semibold text-[#14161A]">{unset ? 'No destination' : <>Unallocated · AKL → {dest}</>}</span>
      <span className="text-[11.5px]" style={{ color: unset ? '#B54708' : '#6B7280' }}>
        {count} booking{count === 1 ? '' : 's'}{unset ? ' · set a destination to plan a consol' : ''}
      </span>
      {onPlan ? (
        <button type="button" onClick={onPlan} title="Plan consol" className="ml-auto inline-flex w-auto items-center gap-1 rounded-md border-0 bg-transparent px-1.5 py-0.5 text-[11.5px] font-medium text-[#0A2472] hover:bg-[#EEF1F9]">
          <Plus size={12} strokeWidth={2.4} /> Plan consol
        </button>
      ) : null}
    </div>
  )
}
