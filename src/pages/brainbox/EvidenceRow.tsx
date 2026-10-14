import { useState } from 'react'
import { ArrowRight, ChevronDown, ChevronUp, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { applyToCard, describeCard, describeEvidence, suggestPayerRule, type Evidence, type Lane } from './evidenceApi'
import { money } from './sourceMeta'

type Props = { e: Evidence; lane: Lane; canApprove: boolean; onDone: () => void }

/** One charge that needs action: evidence on the left, card on the right, one button. */
export default function EvidenceRow({ e, lane, canApprove, onDone }: Props) {
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const isAdd = e.verdict === 'add'
  const showAction = e.verdict === 'add' || e.verdict === 'update'

  const apply = async () => {
    setBusy(true)
    try {
      await applyToCard(e, lane)
      toast.success(`${e.label} ${isAdd ? 'added to' : 'updated on'} ${e.sheet_title}`)
      onDone()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not update card') } finally { setBusy(false) }
  }
  const payerRule = async (i: number) => {
    const p = e.exceptions[i]
    try {
      await suggestPayerRule(e, p, lane)
      toast.success(`Customer rule suggested for ${p.name}. Approve it under Rules.`)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not suggest rule') }
  }

  return (
    <div className="rounded-[10px] border border-[#E6E9F0] bg-white">
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_24px_minmax(0,1.3fr)_auto] items-center gap-x-4 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{e.label}</div>
          <div className="text-[11px] text-[#8A93A5]">ERP {e.erp_code} · {e.payers} customers</div>
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-[#6B7486]">Billed</div>
          <div className="truncate text-[13px]">{describeEvidence(e, money)}</div>
        </div>
        <ArrowRight size={14} className="text-[#B4BCCB]" aria-hidden />
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-[#6B7486]">Card now</div>
          <div className={`truncate text-[13px] ${e.line_id ? 'text-[#8A4A17]' : 'text-[#8A93A5]'}`}>{describeCard(e, money)}</div>
        </div>
        <div className="flex items-center gap-2">
          {e.exceptions.length > 0 && (
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-[#3D4757] hover:bg-[#F3F4F7]">
              {e.exceptions.length} pay differently {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
          {showAction && (canApprove
            ? <button type="button" disabled={busy} onClick={() => void apply()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0A2472] px-3 text-xs font-medium text-white hover:bg-[#13308F] disabled:opacity-60">
                {isAdd ? <Plus size={13} /> : <RefreshCw size={13} />}{isAdd ? 'Add to card' : 'Update card'}
              </button>
            : <span className="text-xs text-[#6B7486]">Pricing lead to apply</span>)}
        </div>
      </div>
      {open && (
        <div className="border-t border-[#ECEEF4] bg-[#F7F8FC] px-4 py-2">
          {e.exceptions.map((p, i) => (
            <div key={p.account_id} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
              <span className="min-w-0 truncate">{p.name} <span className="text-[11px] text-[#8A93A5]">{p.account_id}</span></span>
              <span className="shrink-0 text-[#3D4757]">NZD {money(p.price)} on {Math.round(p.share * 100)}% of {p.jobs} jobs</span>
              <button type="button" onClick={() => void payerRule(i)}
                className="h-7 shrink-0 rounded-md border border-[#2F4FD8] bg-white px-2.5 text-xs text-[#2F4FD8]">Customer rule</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
