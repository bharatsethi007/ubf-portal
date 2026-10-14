import { AlertCircle, CheckCircle2, Layers, Plus } from 'lucide-react'
import { fmtNum, type EaRow } from '../eaTypes'
import { masterTotals, subIssues, supplierOf } from '../eaMaster'

type Props = { master: EaRow; subs: EaRow[]; active: string; onPick: (id: string) => void; onAdd: () => void }

/** Master + sub-HAWB tabs across the top of a buyers consolidation. "!" marks a sub with something missing. */
export default function EaFamilyTabs({ master, subs, active, onPick, onAdd }: Props) {
  const t = masterTotals(subs)
  const open = subs.filter((s) => subIssues(s).length).length
  const masterGaps = [!master.consignee_account_id && 'Consignee code', !master.bill_to_account_id && 'Bill-to code'].filter(Boolean) as string[]
  const base = 'relative flex h-[46px] min-w-0 shrink-0 items-center gap-2 rounded-t-[9px] border border-b-0 px-3 text-left transition-colors'
  const on = 'z-[1] border-[#E3E6EB] bg-white text-[#14161A]'
  const off = 'border-transparent bg-transparent text-[#5B616E] hover:bg-[#F6F7F9] hover:text-[#14161A]'

  return (
    <div className="relative mb-3 before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-[#E3E6EB]">
    <div role="tablist" aria-label="Buyers consolidation" className="relative z-[1] flex items-end gap-1 overflow-x-auto overflow-y-hidden pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button type="button" role="tab" aria-selected={active === master.id} onClick={() => onPick(master.id)} className={`${base} ${active === master.id ? on : off}`}>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#0A2472] text-white"><Layers size={13} /></span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">Main <span className="bk-mono text-[11.5px] font-medium text-[#0A2472]">{master.booking_ref}</span></span>
          <span className="bk-mono text-[10.5px] text-[#6B7280]">{subs.length} HAWB{subs.length === 1 ? '' : 's'} · {fmtNum(t.pcs)} pcs · {fmtNum(t.kg)} kg</span>
        </span>
        {masterGaps.length || open
          ? <Bang title={[...masterGaps.map((g) => `Main: ${g} missing`), open ? `${open} sub-HAWB${open > 1 ? 's' : ''} incomplete` : ''].filter(Boolean).join('\n')} />
          : <CheckCircle2 size={14} className="shrink-0 text-[#17B26A]" aria-label="Complete" />}
      </button>

      <span aria-hidden className="mx-1 mb-3 h-5 w-px shrink-0 bg-[#E3E6EB]" />

      {subs.map((s, i) => {
        const issues = subIssues(s)
        return (
          <button key={s.id} type="button" role="tab" aria-selected={active === s.id} onClick={() => onPick(s.id)} title={`${supplierOf(s)} · ${s.booking_ref}`}
            className={`${base} max-w-[220px] ${active === s.id ? on : off}`}>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#F2F4F7] text-[10px] font-semibold text-[#5B616E]">{i + 1}</span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[12.5px] font-medium">{supplierOf(s)}</span>
              <span className="bk-mono truncate text-[10.5px] text-[#6B7280]">{s.booking_ref}</span>
            </span>
            {issues.length ? <Bang title={issues.join('\n')} /> : <CheckCircle2 size={14} className="shrink-0 text-[#17B26A]" aria-label="Complete" />}
          </button>
        )
      })}

      <button type="button" onClick={onAdd} title="Add a sub-HAWB"
        className="mb-1.5 ml-1 inline-flex h-[30px] w-auto shrink-0 items-center gap-1 rounded-[7px] border border-dashed border-[#C9D0DB] bg-white px-2.5 text-[12px] font-medium text-[#0A2472] hover:border-[#0A2472] hover:bg-[#F3F5FB]">
        <Plus size={13} strokeWidth={2.4} /> Add HAWB
      </button>
    </div>
    </div>
  )
}

function Bang({ title }: { title: string }) {
  return (
    <span title={title} aria-label={title} className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[#FFFAEB] text-[#DC6803] ring-1 ring-[#FEDF89]">
      <AlertCircle size={12} strokeWidth={2.4} />
    </span>
  )
}
