import { Suspense, lazy, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import '@/features/bookingsWorkspace/bookingsTheme.css'
import { useStaffList } from '../../hooks/useStaffList'
import { useCustomerQuoteStats } from '../../hooks/useCustomerQuoteStats'
import { updateQuote } from './quotesApi'
import QuoteResponsesPanel from './QuoteResponsesPanel'
import FreightIntelligence from './FreightIntelligence'
import QuotePreviewBubble from './QuotePreviewBubble'
import QuoteMailBubble from './QuoteMailBubble'
import LostReasonModal from './LostReasonModal'
import { useQuoteDetail } from './detail/useQuoteDetail'
import QuoteHeader, { type QuoteOutcome } from './detail/QuoteHeader'
import QuoteRouteCard from './detail/QuoteRouteCard'
import QuoteLoadsCard from './detail/QuoteLoadsCard'
import QuoteDetailsCard from './detail/QuoteDetailsCard'
import QuoteNotesCard from './detail/QuoteNotesCard'
import './quoteDetailPage.css'

const QuoteEmailDialog = lazy(() => import('./email/QuoteEmailDialog'))

const SERVICE_SHORT: Record<string, string> = {
  'Door to Door': 'Door to door', 'Port to Port': 'Port to port', 'Door to Port': 'Door to port', 'Port to Door': 'Port to door',
}

/** Quote record. Export Air skin: white canvas, cards, segmented controls, autosave. */
export default function QuoteDetailPage() {
  const { id } = useParams()
  const { staff } = useStaffList()
  const d = useQuoteDetail(id)
  const { stats } = useCustomerQuoteStats(d.quote?.customer_account_id)
  const [lostOpen, setLostOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [respKey, setRespKey] = useState(0)

  if (d.loading) return <div className="bk-root p-6 text-[#6B7280]">Loading…</div>
  const { quote, fields, cargo } = d
  if (!quote || !fields || !cargo) {
    return (
      <div className="bk-root p-6">
        <p className="m-0 text-[13px]">Quote not found.</p>
        <Link to="/quotes" className="text-[12px] text-[#0A2472] hover:underline">Back to quotes</Link>
      </div>
    )
  }

  const summary = [
    fields.movement_type === 'import' ? 'Import' : fields.movement_type === 'export' ? 'Export' : fields.movement_type === 'crosstrade' ? 'Cross trade' : null,
    fields.incoterms,
    fields.service_type ? SERVICE_SHORT[fields.service_type] ?? fields.service_type : null,
  ].filter(Boolean).join(' · ') || null

  async function mark(next: QuoteOutcome) {
    if (next === 'lost') { setLostOpen(true); return }
    await d.mark(next)
  }

  return (
    <div className="bk-root mx-auto w-full max-w-[1440px] bg-white text-[12.5px] text-[#14161A]">
      <QuoteHeader quote={quote} status={d.status} movementType={fields.movement_type} stats={stats}
        saveState={d.saveState} pending={d.pending} statusBusy={d.statusBusy}
        onCustomer={(v) => void d.changeCustomer(v)} onContactSaved={d.patchQuote}
        onEmail={() => setEmailOpen(true)} onMark={(s) => void mark(s)} />

      <QuoteRouteCard quote={quote} mode={d.mode} pending={d.pending} lines={d.cargoLines} summary={summary}
        onSavePort={(w, c) => void d.savePort(w, c)} onChanged={d.reload} />
      <QuoteLoadsCard mode={d.mode} groups={d.groups} onPatch={d.containers.patch} onAdd={d.containers.add} onRemove={d.containers.remove}
        entryMode={d.cargoMode} onEntryMode={d.setCargoMode} lines={d.cargoLines} onLines={d.setCargoLines} onAddLine={d.addCargoLine} />
      <QuoteDetailsCard fields={fields} isAir={d.isAir} staff={staff} customerPick={d.customerPick}
        patch={d.patch} cargo={cargo} patchCargo={d.patchCargo} onDirection={d.setDirection} />

      <section className="min-w-0 overflow-hidden rounded-[10px] border border-[#EEF0F3] bg-white">
        <QuoteResponsesPanel key={respKey} quoteId={quote.id} />
      </section>

      {quote.from_port_code && quote.to_port_code ? (
        <FreightIntelligence
          from={quote.from_port_code} to={quote.to_port_code} mode={d.isAir ? 'air' : 'sea'}
          direction={fields.movement_type ?? null} incoterm={fields.incoterms ?? null}
          loadType={d.isAir ? null : d.mode === 'LCL' ? 'LCL' : 'FCL'}
          quoteId={quote.id} customerId={quote.customer_account_id ?? null} customerName={quote.customer_name ?? null}
          weightKg={d.cargoSize.w} volumeM3={d.cargoSize.v}
          containers={d.mode !== 'FCL' ? [] : d.groups.map((g) => ({ size: g.container_size.startsWith('40') ? '40' as const : '20' as const, qty: g.qty || 0, kgPer: (g.weight_per_container_mt || 0) * 1000 }))}
          onLinesChanged={() => setRespKey((k) => k + 1)}
          onAddNote={(line) => {
            const existing = fields.external_notes ?? ''
            const next = existing ? `${line}\n${existing}` : line
            d.patch({ external_notes: next })
            void updateQuote(quote.id, { external_notes: next })
          }}
        />
      ) : null}

      <QuoteNotesCard internal={fields.internal_notes} external={fields.external_notes}
        onInternal={(v) => d.patch({ internal_notes: v })} onExternal={(v) => d.patch({ external_notes: v })} />

      <QuotePreviewBubble quoteId={quote.id} quoteNo={quote.quote_no} />
      <QuoteMailBubble quoteId={quote.id} quoteNo={quote.quote_no} />
      {emailOpen ? (
        <Suspense fallback={null}><QuoteEmailDialog quoteId={quote.id} onClose={() => setEmailOpen(false)} /></Suspense>
      ) : null}
      <LostReasonModal open={lostOpen} busy={d.statusBusy} onClose={() => setLostOpen(false)}
        onConfirm={(info) => void d.mark('lost', info).then((ok) => ok && setLostOpen(false))} />
    </div>
  )
}
