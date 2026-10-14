import type { DragEvent } from 'react'
import { ChevronLeft, ChevronRight, Inbox, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cargoOf, fmtNum, type AirConsol, type EaRow } from './eaTypes'
import { eaHref, Tag } from './eaUi'
import { NextIcon } from './EaBoardRow'
import { DestFlag } from './eaVisual'
import { statusFor } from './eaRowStatus'
import { masterTotals } from './eaMaster'
import type { EaGroup } from './eaGroups'

type Lane = Extract<EaGroup, { kind: 'lane' }>
type Dnd = {
  dragIds: string[]; over: string | null
  start: (r: EaRow) => (e: DragEvent) => void; end: () => void
  target: (g: EaGroup) => Record<string, (e: DragEvent) => void>
}
type Props = {
  lanes: Lane[]; consols: AirConsol[]; subsOf: Map<string, EaRow[]>; open: boolean; onToggle: () => void
  collapsed: Set<string>; onToggleLane: (key: string) => void; searching: boolean
  dnd: Dnd; onOpen: (id: string) => void; onPlan: (dest: string) => void
}

/** Card for one unallocated booking. Drag onto a consol on the left. */
function Card({ r, consols, subsOf, dnd, onOpen }: { r: EaRow; consols: AirConsol[]; subsOf: Map<string, EaRow[]>; dnd: Dnd; onOpen: (id: string) => void }) {
  const c = r.is_consolidation ? masterTotals(subsOf.get(r.id) ?? []) : cargoOf(r)
  const s = statusFor(r, consols, subsOf)
  return (
    <div draggable onDragStart={dnd.start(r)} onDragEnd={dnd.end}
      className={`cursor-grab rounded-lg border border-[#EEF0F3] bg-white px-2.5 py-2 transition hover:border-[#D0D5DD] hover:shadow-[0_2px_8px_rgba(15,23,42,.06)] active:cursor-grabbing ${dnd.dragIds.includes(r.id) ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-2">
        <Link to={eaHref(r.id)} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); onOpen(r.id) }}
          className="bk-mono text-[11.5px] font-medium text-[#0A2472] hover:underline">{r.booking_ref}</Link>
        {r.is_dg ? <Tag tone="red">DG</Tag> : null}
        {r.is_consolidation ? <Tag tone="navy">Consol · {subsOf.get(r.id)?.length ?? 0}</Tag> : null}
        <span className="bk-mono ml-auto text-[11px] text-[#5B616E]">{fmtNum(c.pcs)} · {fmtNum(c.kg)} kg</span>
      </div>
      <div className="mt-0.5 truncate text-[12px] font-medium text-[#14161A]">{r.consignee_code_name ?? r.consignee_name ?? 'No consignee'}</div>
      <div className="truncate text-[11px] text-[#6B7280]">from {r.shipper_code_name ?? r.shipper_name ?? 'No shipper'}</div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[11px] text-[#5B616E]" title={[s.text, ...s.more].join('\n')}>{s.text}{s.more.length ? ` +${s.more.length}` : ''}</span>
        <NextIcon s={s} r={r} onOpen={() => onOpen(r.id)} />
      </div>
    </div>
  )
}

/** Right-hand tray of unallocated bookings. Collapsed to a slim rail by default; still a drop target. */
export default function EaUnallocPanel({ lanes, consols, subsOf, open, onToggle, collapsed, onToggleLane, searching, dnd, onOpen, onPlan }: Props) {
  const total = lanes.reduce((n, l) => n + l.rows.length, 0)
  const tray: EaGroup = { kind: 'lane', key: 'l:*', dest: '*', rows: [] }
  const hot = dnd.over === 'l:*' || lanes.some((l) => dnd.over === l.key)
  const dragging = dnd.dragIds.length > 0

  if (!open) {
    return (
      <button type="button" {...dnd.target(tray)} onClick={onToggle} title="Show unallocated bookings"
        className={`sticky top-3 flex w-[44px] shrink-0 flex-col items-center gap-2 self-start rounded-[10px] border px-0 py-3 transition ${hot ? 'border-[#0A2472] bg-[#F3F6FD]' : dragging ? 'border-[#C9D4EA] bg-white' : 'border-[#EEF0F3] bg-white hover:bg-[#F8F9FB]'}`}>
        <ChevronLeft size={14} className="text-[#5B616E]" />
        <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10.5px] font-semibold ${total ? 'bg-[#0A2472] text-white' : 'bg-[#F2F4F7] text-[#5B616E]'}`}>{total}</span>
        <span className="text-[11.5px] font-medium text-[#14161A] [writing-mode:vertical-rl] rotate-180">{hot ? 'Drop to unallocate' : 'Unallocated'}</span>
      </button>
    )
  }

  return (
    <aside {...dnd.target(tray)} aria-label="Unallocated bookings"
      className={`sticky top-3 flex max-h-[calc(100vh-120px)] w-[320px] shrink-0 flex-col self-start overflow-hidden rounded-[10px] border transition duration-200 animate-in fade-in-0 slide-in-from-right-4 ${hot ? 'border-[#0A2472] shadow-[inset_0_0_0_1px_#0A2472]' : 'border-[#EEF0F3]'}`}>
      <header className="flex items-center gap-2 border-b border-[#EEF0F3] bg-[#FAFBFC] px-3 py-2">
        <Inbox size={14} className="text-[#5B616E]" />
        <span className="text-[12.5px] font-semibold">Unallocated</span>
        <span className="bk-mono text-[11px] text-[#98A2B3]">{total}</span>
        <button type="button" onClick={onToggle} aria-label="Collapse unallocated" title="Collapse"
          className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md border-0 bg-transparent text-[#98A2B3] hover:bg-[#F2F4F7] hover:text-[#14161A]"><ChevronRight size={14} /></button>
      </header>
      {hot ? <div className="bg-[#0A2472] px-3 py-1 text-center text-[11px] font-medium text-white">Drop to unallocate</div> : null}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#FCFCFD] p-2">
        {lanes.length === 0 ? <div className="px-2 py-8 text-center text-[12px] text-[#98A2B3]">Everything is on a consol.</div> : null}
        {lanes.map((l) => {
          const isOpen = !collapsed.has(l.key) || searching
          const unset = l.dest === 'UNSET'
          return (
            <section key={l.key} className="mb-2 last:mb-0">
              <div className="flex items-center gap-1.5 px-1 py-1">
                <button type="button" onClick={() => onToggleLane(l.key)} aria-expanded={isOpen}
                  className="inline-flex w-auto items-center gap-1 border-0 bg-transparent p-0 text-[11.5px] font-semibold text-[#14161A]">
                  <ChevronRight size={12} className="text-[#98A2B3] transition-transform" style={{ transform: isOpen ? 'rotate(90deg)' : undefined }} />
                  {unset ? 'No destination' : <span className="inline-flex items-center gap-1">AKL → <DestFlag iata={l.dest} size={11} /> {l.dest}</span>}
                  <span className="bk-mono font-normal text-[#98A2B3]">{l.rows.length}</span>
                </button>
                {!unset ? (
                  <button type="button" onClick={() => onPlan(l.dest)} title={`Plan a ${l.dest} consol`}
                    className="ml-auto inline-flex w-auto items-center gap-0.5 rounded border-0 bg-transparent px-1 text-[11px] font-medium text-[#0A2472] hover:bg-[#EEF1F9]"><Plus size={11} strokeWidth={2.4} /> Consol</button>
                ) : null}
              </div>
              {isOpen ? <div className="flex flex-col gap-1.5">{l.rows.map((r) => <Card key={r.id} r={r} consols={consols} subsOf={subsOf} dnd={dnd} onOpen={onOpen} />)}</div> : null}
            </section>
          )
        })}
      </div>
    </aside>
  )
}
