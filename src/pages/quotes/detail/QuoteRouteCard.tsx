import { useState, type ReactElement } from 'react'
import { AlertTriangle, ArrowRight, Boxes, Check, Pencil, Plane, Ship } from 'lucide-react'
import { toast } from 'sonner'
import SeaPortSelect from '@/components/bookings/SeaPortSelect'
import IataPortSelect from '@/components/bookings/IataPortSelect'
import { useSeaPorts } from '@/hooks/useSeaPorts'
import QuoteLaneMap from '../QuoteLaneMap'
import type { QuoteRecord } from '../quotesApi'
import type { QuoteCargoLine } from '../quoteCargoApi'
import { Card, Seg, btn, btnPrimary, iconBtn } from './qdUi'
import { MODE_TONE } from '../quoteTones'
import { applyModeChange, planModeChange, type ModePlan, type QuoteMode } from './quoteMode'

export const MODE_ICON: Record<QuoteMode, ReactElement> = {
  FCL: <Ship size={13} />, LCL: <Boxes size={13} />, Air: <Plane size={13} />,
}

type Props = {
  quote: QuoteRecord
  mode: QuoteMode
  /** Unsaved edits block a mode change so nothing saves against the wrong mode. */
  pending: boolean
  lines: QuoteCargoLine[]
  summary: string | null
  onSavePort: (which: 'from' | 'to', code: string) => void
  onChanged: () => Promise<void> | void
}

/** Mode (FCL / LCL / Air) + lane. Mode change previews its side effects, then applies in one go. */
export default function QuoteRouteCard({ quote, mode, pending, lines, summary, onSavePort, onChanged }: Props) {
  const { ports } = useSeaPorts()
  const [editing, setEditing] = useState(false)
  const [plan, setPlan] = useState<ModePlan | null>(null)
  const [busy, setBusy] = useState(false)
  const courier = quote.shipment_mode === 'courier'

  async function pick(to: QuoteMode) {
    if (to === mode) { setPlan(null); return }
    try { setPlan(await planModeChange(quote, mode, to, ports)) } catch (e) { toast.error((e as Error).message) }
  }

  async function apply() {
    if (!plan) return
    setBusy(true)
    try {
      await applyModeChange(quote.id, plan, lines)
      toast.success(`Quote switched to ${plan.to}`)
      const needsPort = !plan.origin.next || !plan.dest.next
      setPlan(null)
      await onChanged()
      if (needsPort) setEditing(true)
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  const lockReason = courier ? 'Courier quotes keep their mode' : pending ? 'Saving changes…' : undefined
  const laneMode = mode === 'Air' ? 'air' : mode === 'LCL' ? 'lcl' : 'fcl'

  return (
    <Card
      title="Route"
      aside={
        <Seg<QuoteMode> label="Freight mode" value={plan?.to ?? mode} disabled={!!lockReason || busy} title={lockReason}
          onChange={(v) => void pick(v)}
          options={(['FCL', 'LCL', 'Air'] as QuoteMode[]).map((m) => ({ value: m, label: m, icon: MODE_ICON[m], tone: MODE_TONE[m] }))} />
      }
    >
      {plan ? (
        <div className="flex flex-col gap-2 border-b border-[#FDE7C2] bg-[#FFFAEB] px-4 py-3">
          <div className="flex items-center gap-2 text-[12.5px] font-medium text-[#93370D]">
            <AlertTriangle size={14} /> Switch this quote from {plan.from} to {plan.to}?
          </div>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 pl-[22px] text-[12px] text-[#7A2E0E]">
            {plan.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
          <div className="flex gap-2 pl-[22px] pt-1">
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void apply()}>{MODE_ICON[plan.to]} Switch to {plan.to}</button>
            <button type="button" className={btn} disabled={busy} onClick={() => setPlan(null)}>Keep {plan.from}</button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        {editing ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {mode === 'Air' ? (
              <>
                <IataPortSelect value={quote.from_port_code ?? ''} onChange={(v) => onSavePort('from', v)} />
                <ArrowRight size={15} color="#98A2B3" />
                <IataPortSelect value={quote.to_port_code ?? ''} onChange={(v) => onSavePort('to', v)} />
              </>
            ) : (
              <>
                <SeaPortSelect value={quote.from_port_code ?? ''} onChange={(v) => onSavePort('from', v)} placeholder="From port" />
                <ArrowRight size={15} color="#98A2B3" />
                <SeaPortSelect value={quote.to_port_code ?? ''} onChange={(v) => onSavePort('to', v)} placeholder="To port" />
              </>
            )}
            <button type="button" className={iconBtn} title="Done" aria-label="Done" onClick={() => setEditing(false)}><Check size={14} /></button>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1"><QuoteLaneMap fromCode={quote.from_port_code} toCode={quote.to_port_code} mode={laneMode} /></div>
            <button type="button" className={iconBtn} title="Change ports" aria-label="Change ports" onClick={() => setEditing(true)}><Pencil size={13} /></button>
          </>
        )}
      </div>
      {summary ? <div className="border-t border-[#F1F2F5] px-4 py-2 text-[12px] text-[#5B616E]">{summary}</div> : null}
    </Card>
  )
}
