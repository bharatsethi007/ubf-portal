import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { cargoOf, fmtNum, SOURCE_LABEL, STAGE_LABELS, type EaRow } from './eaTypes'
import { Avatar, DueTag, eaHref, StageBar, Tag, UrgencyDot } from './eaUi'

/** Column template. Cells carry their own padding so the vertical grid lines sit between columns. */
export const EA_COLS =
  'grid grid-cols-[40px_150px_minmax(260px,1.7fr)_136px_96px_160px_minmax(220px,1.2fr)_44px] divide-x divide-[#F1F2F5]'

export function Cell({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <div className={`flex min-w-0 items-center px-3 py-[9px] ${className}`}>{children}</div>
}

type Props = { row: EaRow; selected: boolean; onToggle: () => void; onOpen?: (id: string) => void }

export default function EaBoardRow({ row: r, selected, onToggle, onOpen }: Props) {
  const c = cargoOf(r)
  const consignee = r.consignee_code_name ?? r.consignee_name ?? 'No consignee'
  const shipper = r.shipper_code_name ?? r.shipper_name ?? 'No shipper'
  const dest = r.consignee_city && r.destination && !r.consignee_city.toUpperCase().startsWith(cityOf(r.destination))
    ? `${titleCase(r.consignee_city)} via ${r.destination}`
    : titleCase(r.consignee_city ?? r.destination ?? '')
  const src = SOURCE_LABEL[r.source] ?? r.source
  const srcText = r.quote_no ? `Quote ${r.quote_no}` : r.thread_count > 0 ? `${src} · ${r.thread_count} thread${r.thread_count > 1 ? 's' : ''}` : src

  return (
    <div className={`${EA_COLS} border-t border-[#F1F2F5] ${selected ? 'bg-[#F3F5FB]' : 'hover:bg-[#F8F9FB]'}`}>
      <Cell className="justify-center">
        <input type="checkbox" aria-label={`Select ${r.booking_ref}`} checked={selected} onChange={onToggle}
          className="m-0 h-3.5 w-3.5 cursor-pointer accent-[#0A2472]" />
      </Cell>
      <Cell className="flex-col !items-start justify-center gap-0.5">
        <Link to={eaHref(r.id)} onClick={(e) => { if (!onOpen || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onOpen(r.id) }}
          className="bk-mono text-[12px] font-medium text-[#0A2472] hover:underline">{r.booking_ref}</Link>
        <span className="w-full truncate text-[11px] text-[#6B7280]">{srcText}</span>
      </Cell>
      <Cell className="flex-col !items-start justify-center gap-0.5">
        <div className="flex w-full min-w-0 items-center gap-1.5">
          <span className="truncate font-medium text-[#14161A]">{consignee}</span>
          {r.consignee_account_id
            ? <span className="bk-mono text-[10.5px] text-[#6B7280]">{r.consignee_account_id}</span>
            : <Tag tone="amber">No code</Tag>}
          {r.is_dg ? <Tag tone="red">DG</Tag> : null}
          {r.is_consolidation ? <Tag tone="amber">Buyers consol</Tag> : null}
          {r.bill_to_account_id && r.bill_to_account_id !== 'UBNAN' ? <Tag>Bills {r.bill_to_account_id}</Tag> : null}
        </div>
        <span className="w-full truncate text-[11.5px] text-[#5B616E]">from {shipper}{dest ? ` · ${dest}` : ''}</span>
      </Cell>
      <Cell className="bk-mono justify-end whitespace-nowrap text-[11.5px]">
        {fmtNum(c.pcs)} · {fmtNum(c.kg)} · <b className="ml-1 font-medium">{fmtNum(c.chg)}</b>
      </Cell>
      <Cell className="text-[12px] text-[#14161A]">{r.cargo_ready_date ? format(parseISO(r.cargo_ready_date), 'EEE d MMM') : '—'}</Cell>
      <Cell className="flex-col !items-start justify-center gap-[5px]">
        <StageBar stage={r.stage} />
        <span className="text-[11px] text-[#5B616E]">{STAGE_LABELS[r.stage] ?? '—'}</span>
      </Cell>
      <Cell className="gap-2">
        <UrgencyDot u={r.urgency} />
        <span className="truncate text-[12px] text-[#14161A]">{r.next_action}</span>
        <DueTag u={r.urgency} due={r.action_due} />
      </Cell>
      <Cell className="justify-center"><Avatar initials={r.owner_initials} title={r.owner_name} /></Cell>
    </div>
  )
}

const cityOf = (iata: string) => ({ NAN: 'NADI', SUV: 'SUVA' } as Record<string, string>)[iata] ?? iata
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())
