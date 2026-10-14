import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, Pencil, Plus, Star } from 'lucide-react'
import { differenceInMinutes, format, parseISO } from 'date-fns'
import { awbOk, fmtAwb, fmtNum, type AirConsol } from './eaTypes'
import { Avatar, Tag } from './eaUi'
import { AirlineMark, Route } from './eaVisual'
import type { StaffOption } from '@/hooks/useStaffList'

const iconBtn = 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0 text-[#7A8394] hover:bg-white/70 hover:text-[#14161A]'

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

const initialsOf = (n: string) => n.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')

/** Consol owner. Click the avatar to assign or change. */
export function OwnerPicker({ ownerId, staff, onChange, disabled }: { ownerId: string | null; staff: StaffOption[]; onChange: (id: string | null) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const me = staff.find((x) => x.user_id === ownerId)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [open])
  return (
    <div ref={box} className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        title={me ? `Handled by ${me.name}` : 'Assign consol owner'}
        className="inline-flex w-auto items-center gap-1.5 rounded-md border-0 bg-transparent px-1 py-0.5 text-[11.5px] font-medium text-[#344054] hover:bg-white/70 disabled:opacity-60">
        <Avatar initials={me ? initialsOf(me.name) : null} title={me?.name} />
        <span className="max-w-[90px] truncate">{me ? me.name.split(' ')[0] : 'Assign'}</span>
      </button>
      {open ? (
        <ul role="listbox" className="absolute right-0 top-full z-30 m-0 mt-1 max-h-[260px] w-[200px] list-none overflow-y-auto rounded-lg border border-[#E6E8EE] bg-white p-1 shadow-[0_12px_32px_rgba(15,23,42,.14)] duration-150 animate-in fade-in-0">
          {[{ user_id: '', name: 'Unassigned' }, ...staff].map((x) => (
            <li key={x.user_id || 'none'} role="option" aria-selected={(ownerId ?? '') === x.user_id}
              onClick={() => { setOpen(false); onChange(x.user_id || null) }}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-[#F3F5FB]">
              <Avatar initials={x.user_id ? initialsOf(x.name) : null} title={x.user_id ? x.name : null} />
              <span className="flex-1 truncate">{x.name}</span>
              {(ownerId ?? '') === x.user_id ? <Check size={13} className="text-[#0A2472]" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

type ConsolProps = {
  staff: StaffOption[]
  onOwner: (id: string | null) => void
  c: AirConsol
  open: boolean
  starred: boolean
  shown: number
  onToggle: () => void
  onStar: () => void
  onEdit: () => void
}

/** Consol group bar: collapse, star, flight, cutoff, MAWB, totals, details. */
export function ConsolGroupHeader({ c, open, starred, shown, onToggle, onStar, onEdit, staff, onOwner }: ConsolProps) {
  const cut = cutoffText(c.cutoff_at)
  const exported = c.status === 'exported'
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#DCE2EC] bg-[#E9EDF4] px-2 py-2">
      <Chevron open={open} onClick={onToggle} label={c.flight_no} />
      <button type="button" aria-pressed={starred} aria-label={starred ? 'Unstar consol' : 'Star consol'} title={starred ? 'Unstar' : 'Star to keep on top'} onClick={onStar} className={iconBtn}>
        <Star size={14} fill={starred ? '#F79009' : 'none'} color={starred ? '#F79009' : 'currentColor'} />
      </button>
      <span className="flex items-center gap-1.5">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-white shadow-[0_0_0_1px_#DCE2EC]"><AirlineMark flight={c.flight_no} name={c.airline} size={16} /></span>
        <Link to={`/bookings/export-air/consol/${c.id}`} className="bk-mono text-[12.5px] font-semibold text-[#0A2472] hover:underline">{c.flight_no}</Link>
      </span>
      <span className="text-[12px] font-medium text-[#14161A]">{format(parseISO(c.flight_date), 'EEE d MMM')}</span>
      <Route dest={c.destination} via={c.transit_port} className="text-[11.5px] text-[#475467]" />
      {cut ? <span className="text-[11.5px]" style={{ color: cut.tone }}>{cut.text}</span> : null}
      {c.mawb
        ? <span className="bk-mono text-[11.5px]" style={{ color: awbOk(c.mawb) ? '#14161A' : '#B54708' }} title={awbOk(c.mawb) ? 'MAWB' : 'MAWB check digit looks wrong'}>{fmtAwb(c.mawb)}</span>
        : <Tag tone="amber">No MAWB</Tag>}
      <Tag tone={exported ? 'green' : c.status === 'confirmed' ? 'navy' : 'grey'}>{exported ? 'Exported' : c.status === 'confirmed' ? 'Confirmed' : 'Planned'}</Tag>
      <span className="ml-auto flex items-center gap-3">
        <span className="bk-mono text-[11.5px] text-[#475467]">
          {c.houses} {c.houses === 1 ? 'house' : 'houses'} · {fmtNum(c.pieces)} pcs · {fmtNum(c.kg)} kg · <b className="font-medium text-[#14161A]">{fmtNum(c.chg_kg)}</b> chg
          {shown !== c.houses ? <span className="text-[#98A2B3]"> · {shown} in view</span> : null}
        </span>
        <OwnerPicker ownerId={c.handled_by} staff={staff} onChange={onOwner} />
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
