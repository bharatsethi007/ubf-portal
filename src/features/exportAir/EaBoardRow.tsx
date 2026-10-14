import type { DragEvent, ReactNode } from 'react'
import { ChevronRight, CornerDownRight, GripVertical } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import '@/features/bookingsWorkspace/bookingsTheme.css'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cargoOf, fmtNum, SOURCE_LABEL, type AirConsol, type EaRow } from './eaTypes'
import { DueTag, eaHref, Tag } from './eaUi'
import { ACTION_ICON, DoneIcon, masterRowStatus, rowStatus, subRowStatus, type RowStatus } from './eaRowStatus'
import { masterTotals, supplierOf } from './eaMaster'

/** Column template. Cells carry their own padding so the vertical grid lines sit between columns. */
export const EA_COLS =
  'grid grid-cols-[38px_150px_minmax(260px,1.7fr)_132px_92px_minmax(210px,1fr)_112px] divide-x divide-[#F1F2F5]'

export function Cell({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <div className={`flex min-w-0 items-center px-3 py-[9px] ${className}`}>{children}</div>
}

/** Column headings, shown inside every open consol. */
export function EaColHeads({ checked, onToggleAll, disabled }: { checked: boolean; onToggleAll: () => void; disabled?: boolean }) {
  return (
    <div className={`${EA_COLS} border-t border-[#F1F2F5] bg-white text-[10px] uppercase tracking-[.05em] text-[#98A2B3]`}>
      <Cell className="justify-center !py-1.5">
        <input type="checkbox" aria-label="Select all in consol" checked={checked} disabled={disabled} onChange={onToggleAll} className="m-0 h-3.5 w-3.5 cursor-pointer accent-[#0A2472]" />
      </Cell>
      <Cell className="!py-1.5">HAWB</Cell><Cell className="!py-1.5">Consignee · shipper</Cell>
      <Cell className="justify-end !py-1.5">Pcs · Kg · Chg</Cell><Cell className="!py-1.5">Ready</Cell>
      <Cell className="!py-1.5">Status</Cell><Cell className="justify-center !py-1.5">Next</Cell>
    </div>
  )
}

const TONE: Record<RowStatus['plan']['tone'], string> = { red: 'red', amber: 'amber', blue: 'blue', green: 'green' }

/** Milestone track from the HAWB panel plus the first thing still missing. */
export function StatusCell({ s }: { s: RowStatus }) {
  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <span className="flex gap-[2px]" aria-hidden>
        {s.steps.map((m) => (
          <span key={m.key} title={`${m.label}${m.done ? ' ✓' : ''}`} className="h-1 w-[16px] rounded-sm"
            style={{ background: m.done ? '#0A2472' : m.late ? '#F04438' : '#E6E8EE' }} />
        ))}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-[11.5px]">
        <span className={`truncate ${s.text === 'Ready for close' || s.text === 'In TradeWindow' ? 'text-[#067647]' : 'text-[#14161A]'}`}>{s.text}</span>
        {s.more.length ? <span title={s.more.join('\n')} className="shrink-0 cursor-default rounded bg-[#F2F4F7] px-1 text-[10.5px] leading-[16px] text-[#5B616E]">+{s.more.length}</span> : null}
      </span>
    </div>
  )
}

/** Next step as an icon. Hover shows the suggested action; click opens the HAWB. */
export function NextIcon({ s, r, onOpen, noDue }: { s: RowStatus; r: EaRow; onOpen: () => void; noDue?: boolean }) {
  const Icon = s.plan.action ? ACTION_ICON[s.plan.action] ?? DoneIcon : DoneIcon
  const tone = s.plan.action ? TONE[s.plan.tone] : 'green'
  return (
    <span className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger delay={120} render={
          <button type="button" className={`bk-todo bk-todo--${tone}`} aria-label={`Next: ${s.plan.title}`}
            onClick={(e) => { e.stopPropagation(); onOpen() }} />
        }>
          <Icon size={14} strokeWidth={2} />
        </TooltipTrigger>
        <TooltipContent className="!max-w-[260px] !flex-col !items-start !gap-0.5 !rounded-lg !px-3 !py-2">
          <span className="text-[12px] font-semibold">{s.plan.title}</span>
          <span className="text-[11.5px] opacity-80">{s.plan.why}</span>
        </TooltipContent>
      </Tooltip>
      {noDue || !s.plan.action ? null : <DueTag u={r.urgency} due={r.action_due} />}
    </span>
  )
}

type Props = {
  row: EaRow; consols: AirConsol[]; selected: boolean; onToggle: () => void; onOpen?: (id: string) => void
  /** Sub-HAWBs when this row is a buyers-consol master; nested = drawn as a sub line under its main HAWB. */
  subs?: EaRow[]; nested?: boolean
  /** Main HAWB rows: show or hide the sub-HAWB lines underneath. */
  subsOpen?: boolean; onToggleSubs?: () => void
  drag?: { onStart: (e: DragEvent) => void; onEnd: () => void; dragging: boolean; locked: boolean }
}

export default function EaBoardRow({ row: r, consols, selected, onToggle, onOpen, drag, subs, nested, subsOpen, onToggleSubs }: Props) {
  const master = !!r.is_consolidation
  const c = master ? masterTotals(subs ?? []) : cargoOf(r)
  const s = master ? masterRowStatus(r, subs ?? []) : nested ? subRowStatus(r) : rowStatus(r, consols)
  const consignee = r.consignee_code_name ?? r.consignee_name ?? 'No consignee'
  const shipper = master ? `${r.shipper_name ?? 'Various Shippers'} · ${subs?.length ?? 0} supplier${subs?.length === 1 ? '' : 's'}` : r.shipper_code_name ?? r.shipper_name ?? 'No shipper'
  const dest = r.consignee_city && r.destination && !r.consignee_city.toUpperCase().startsWith(cityOf(r.destination))
    ? `${titleCase(r.consignee_city)} via ${r.destination}`
    : titleCase(r.consignee_city ?? r.destination ?? '')
  const src = SOURCE_LABEL[r.source] ?? r.source
  const srcText = r.quote_no ? `Quote ${r.quote_no}` : r.thread_count > 0 ? `${src} · ${r.thread_count} thread${r.thread_count > 1 ? 's' : ''}` : src

  if (nested) {
    return (
      <div className={`group/row ${EA_COLS} border-t border-dashed border-[#EEF0F3] bg-[#FCFCFD] text-[12px] hover:bg-[#F8F9FB]`}>
        <Cell className="justify-end !pr-1"><CornerDownRight size={13} className="text-[#C4C9D2]" /></Cell>
        <Cell>
          <Link to={eaHref(r.id)} onClick={(e) => { if (!onOpen || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onOpen(r.id) }}
            className="bk-mono text-[11.5px] text-[#0A2472] hover:underline">{r.booking_ref}</Link>
        </Cell>
        <Cell><span className="truncate text-[12px] text-[#14161A]">{supplierOf(r)}</span></Cell>
        <Cell className="bk-mono justify-end whitespace-nowrap text-[11px] text-[#5B616E]">{fmtNum(c.pcs)} · {fmtNum(c.kg)} · {fmtNum(c.chg)}</Cell>
        <Cell className="text-[11.5px] text-[#5B616E]">{r.cargo_ready_date ? format(parseISO(r.cargo_ready_date), 'EEE d MMM') : '—'}</Cell>
        <Cell className="!py-[7px]"><StatusCell s={s} /></Cell>
        <Cell className="justify-center !py-[7px]"><NextIcon s={s} r={r} onOpen={() => onOpen?.(r.id)} /></Cell>
      </div>
    )
  }

  return (
    <div draggable={!!drag && !drag.locked} onDragStart={drag?.onStart} onDragEnd={drag?.onEnd}
      title={drag?.locked ? 'Exported to TradeWindow, locked' : undefined}
      className={`group/row relative ${EA_COLS} border-t border-[#F1F2F5] transition-opacity ${selected ? 'bg-[#F3F5FB]' : 'hover:bg-[#F8F9FB]'} ${drag?.dragging ? 'opacity-40' : ''} ${drag && !drag.locked ? 'cursor-grab active:cursor-grabbing' : ''}`}>
      {drag && !drag.locked ? (
        <GripVertical aria-hidden size={13} className="pointer-events-none absolute left-0.5 top-1/2 -translate-y-1/2 text-[#C4C9D2] opacity-0 transition-opacity group-hover/row:opacity-100" />
      ) : null}
      <Cell className="justify-center">
        <input type="checkbox" aria-label={`Select ${r.booking_ref}`} checked={selected} onChange={onToggle}
          className="m-0 h-3.5 w-3.5 cursor-pointer accent-[#0A2472]" />
      </Cell>
      <Cell className="flex-col !items-start justify-center gap-0.5">
        <span className="flex items-center gap-1">
          {master && onToggleSubs ? (
            <button type="button" onClick={onToggleSubs} aria-expanded={subsOpen} title={subsOpen ? 'Hide sub-HAWBs' : 'Show sub-HAWBs'}
              className="-ml-1 inline-flex h-5 w-5 items-center justify-center rounded border-0 bg-transparent p-0 text-[#7A8394] hover:bg-[#EEF1F6] hover:text-[#14161A]">
              <ChevronRight size={13} className="transition-transform" style={{ transform: subsOpen ? 'rotate(90deg)' : undefined }} />
            </button>
          ) : null}
          <Link to={eaHref(r.id)} onClick={(e) => { if (!onOpen || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onOpen(r.id) }}
            className="bk-mono text-[12px] font-medium text-[#0A2472] hover:underline">{r.booking_ref}</Link>
        </span>
        <span className="w-full truncate text-[11px] text-[#6B7280]">{master ? `Main · ${subs?.length ?? 0} sub${subs?.length === 1 ? "" : "s"}` : srcText}</span>
      </Cell>
      <Cell className="flex-col !items-start justify-center gap-0.5">
        <div className="flex w-full min-w-0 items-center gap-1.5">
          <span className="truncate font-medium text-[#14161A]">{consignee}</span>
          {r.consignee_account_id
            ? <span className="bk-mono text-[10.5px] text-[#6B7280]">{r.consignee_account_id}</span>
            : <Tag tone="amber">No code</Tag>}
          {r.is_dg ? <Tag tone="red">DG</Tag> : null}
          {master ? <Tag tone="navy">Buyers consol</Tag> : null}
          {r.bill_to_account_id && r.bill_to_account_id !== 'UBNAN' ? <Tag>Bills {r.bill_to_account_id}</Tag> : null}
        </div>
        <span className="w-full truncate text-[11.5px] text-[#5B616E]">from {shipper}{dest ? ` · ${dest}` : ''}</span>
      </Cell>
      <Cell className="bk-mono justify-end whitespace-nowrap text-[11.5px]">
        {fmtNum(c.pcs)} · {fmtNum(c.kg)} · <b className="ml-1 font-medium">{fmtNum(c.chg)}</b>
      </Cell>
      <Cell className="text-[12px] text-[#14161A]">{r.cargo_ready_date ? format(parseISO(r.cargo_ready_date), 'EEE d MMM') : '—'}</Cell>
      <Cell><StatusCell s={s} /></Cell>
      <Cell className="justify-center"><NextIcon s={s} r={r} onOpen={() => onOpen?.(r.id)} noDue={master} /></Cell>
    </div>
  )
}

const cityOf = (iata: string) => ({ NAN: 'NADI', SUV: 'SUVA' } as Record<string, string>)[iata] ?? iata
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())
