import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { cargoOf, fmtNum, SOURCE_LABEL, STAGE_LABELS, type EaRow } from './eaTypes'
import { Avatar, DueTag, eaHref, StageBar, Tag, UrgencyDot } from './eaUi'

export const EA_GRID =
  'grid grid-cols-[28px_132px_minmax(240px,1.7fr)_120px_92px_150px_130px_minmax(200px,1.2fr)_30px] items-center gap-x-3'

type Props = { row: EaRow; selected: boolean; onToggle: () => void }

export default function EaBoardRow({ row: r, selected, onToggle }: Props) {
  const c = cargoOf(r)
  const consignee = r.consignee_code_name ?? r.consignee_name ?? 'No consignee'
  const shipper = r.shipper_code_name ?? r.shipper_name ?? 'No shipper'
  const dest = r.consignee_city && r.destination && !r.consignee_city.toUpperCase().startsWith(cityOf(r.destination))
    ? `${titleCase(r.consignee_city)} via ${r.destination}`
    : titleCase(r.consignee_city ?? r.destination ?? '')
  const src = SOURCE_LABEL[r.source] ?? r.source
  const srcText = r.quote_no ? `Quote ${r.quote_no}` : r.thread_count > 0 ? `${src} · ${r.thread_count} thread${r.thread_count > 1 ? 's' : ''}` : src

  return (
    <div className={`${EA_GRID} border-t border-[#F1F2F5] px-3 py-[9px] hover:bg-[#F8F9FB] ${selected ? 'bg-[#F3F5FB]' : ''}`}>
      <input
        type="checkbox"
        aria-label={`Select ${r.booking_ref}`}
        checked={selected}
        onChange={onToggle}
        className="m-0 h-3.5 w-3.5 cursor-pointer accent-[#0A2472]"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link to={eaHref(r.id)} className="bk-mono text-[12px] font-medium text-[#0A2472] hover:underline">{r.booking_ref}</Link>
        <span className="truncate text-[11px] text-[#6B7280]">{srcText}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium text-[#14161A]">{consignee}</span>
          {r.consignee_account_id
            ? <span className="bk-mono text-[10.5px] text-[#6B7280]">{r.consignee_account_id}</span>
            : <Tag tone="amber">No code</Tag>}
          {r.is_dg ? <Tag tone="red">DG</Tag> : null}
          {r.is_consolidation ? <Tag tone="amber">Buyers consol</Tag> : null}
          {r.bill_to_account_id && r.bill_to_account_id !== 'UBNAN' ? <Tag>Bills {r.bill_to_account_id}</Tag> : null}
        </div>
        <span className="truncate text-[11.5px] text-[#5B616E]">from {shipper}{dest ? ` · ${dest}` : ''}</span>
      </div>
      <div className="bk-mono whitespace-nowrap text-right text-[11.5px]">
        {fmtNum(c.pcs)} · {fmtNum(c.kg)} · <b className="font-medium">{fmtNum(c.chg)}</b>
      </div>
      <div className="text-[12px] text-[#14161A]">{r.cargo_ready_date ? format(parseISO(r.cargo_ready_date), 'EEE d') : '—'}</div>
      <div className="flex flex-col gap-[5px]">
        <StageBar stage={r.stage} />
        <span className="text-[11px] text-[#5B616E]">{STAGE_LABELS[r.stage] ?? '—'}</span>
      </div>
      <div>
        {r.consol_flight
          ? <Link to={`/bookings/export-air/consol/${r.consol_id}`} className="bk-mono text-[11.5px] font-medium text-[#14161A] hover:underline">{r.consol_flight} · {r.consol_date ? format(parseISO(r.consol_date), 'EEE d') : ''}</Link>
          : <span className="text-[11.5px] text-[#98A2B3]">Unallocated</span>}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <UrgencyDot u={r.urgency} />
        <span className="truncate text-[12px] text-[#14161A]">{r.next_action}</span>
        <DueTag u={r.urgency} due={r.action_due} />
      </div>
      <Avatar initials={r.owner_initials} title={r.owner_name} />
    </div>
  )
}

const cityOf = (iata: string) => ({ NAN: 'NADI', SUV: 'SUVA' } as Record<string, string>)[iata] ?? iata
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())
