import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Plus, Send, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createQuoteResponse,
  deleteQuoteResponse,
  duplicateQuoteResponse,
  fetchQuoteResponses,
  sendQuoteForApproval,
  withdrawQuoteApproval,
  type QuoteResponseSummary,
} from './quoteResponsesApi'
import { canSendToPortal } from './quoteResponseUi'
import QuoteResponseCard from './QuoteResponseCard'
import { fetchRatesForBase } from '../setup/fxRatesApi'
import { withLiveFx } from './responseFx'
import QuoteResponseModal from './QuoteResponseModal'
import QuoteVendorRates from './QuoteVendorRates'
import QuoteRequestRates from './QuoteRequestRates'
import QuoteAudit from './QuoteAudit'
import { saveQuoteResponseLines } from './quoteResponseLinesApi'
import RateSearchModal from '../rates/RateSearchModal'
import { buildBuyLinesFromOption, buildLclBuyLinesFromOption } from '../rates/quoteFromRate'
import type { RateOption, QuoteLane } from '../rates/rateSearchApi'
import { fetchLclQuoteLane, type LclRateOption, type LclQuoteLane } from '../rates/lclRateSearchApi'
import './quoteResponsesPanel.css'

import { lazy, Suspense } from 'react'
const QuotePreviewTab = lazy(() => import('./QuotePreviewTab'))

type Props = { quoteId: string }

type TabKey = 'responses' | 'vendor' | 'preview' | 'request' | 'audit'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'responses', label: 'Responses' },
  { key: 'vendor', label: 'Vendor rates' },
  { key: 'preview', label: 'Preview' },
  { key: 'request', label: 'Request rates' },
  { key: 'audit', label: 'Audit' },
]

export default function QuoteResponsesPanel({ quoteId }: Props) {
  const [responses, setResponses] = useState<QuoteResponseSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [params] = useSearchParams()
  const [tab, setTab] = useState<TabKey>(() => (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'responses'))
  const [searchOpen, setSearchOpen] = useState(false)
  const [lclWm, setLclWm] = useState<number | undefined>(undefined)
  const [nzdRates, setNzdRates] = useState<Map<string, number>>(new Map())

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setResponses(await fetchQuoteResponses(quoteId))
    } catch {
      toast.error('Failed to load responses')
      setResponses([])
    } finally {
      setLoading(false)
    }
  }, [quoteId])

  useEffect(() => {
    reload()
  }, [reload])

  // NZD per 1 unit of each foreign response currency, for the "≈ NZD" line on cards.
  const needsFx = responses.some((r) => r.currency !== 'NZD')
  useEffect(() => {
    if (!needsFx) return
    fetchRatesForBase('NZD')
      .then((rows) => setNzdRates(new Map(rows.map((x) => [x.quote_currency, x.rate]))))
      .catch(() => {})
  }, [needsFx])

  useEffect(() => {
    let live = true
    fetchLclQuoteLane(quoteId)
      .then((l) => { if (live) setLclWm(l.wm > 0 ? l.wm : undefined) })
      .catch(() => {})
    return () => { live = false }
  }, [quoteId])

  async function handleAdd() {
    setCreating(true)
    try {
      const { id } = await createQuoteResponse(quoteId)
      await reload()
      setOpenId(id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create response')
    } finally {
      setCreating(false)
    }
  }

  function handleSearchRates() {
    setSearchOpen(true)
  }

  async function handleDelete(e: MouseEvent, responseId: string, responseNo: string | null) {
    e.stopPropagation()
    const label = responseNo ?? 'this response'
    if (!confirm(`Delete ${label}?`)) return
    try {
      await deleteQuoteResponse(responseId)
      toast.success('Response deleted')
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete response')
    }
  }

  async function handleCopy(e: MouseEvent, responseId: string) {
    e.stopPropagation()
    try {
      const id = await duplicateQuoteResponse(responseId)
      toast.success('Response copied')
      await reload()
      setOpenId(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to copy response')
    }
  }

  const sendable = responses.filter((r) => canSendToPortal(r.status, r.total_sell)).length
  const waiting = responses.filter((r) => r.status === 'sent_for_approval').length
  const decided = responses.some((r) => r.status === 'approved')
  const [portalBusy, setPortalBusy] = useState(false)

  async function handlePortal(action: 'send' | 'withdraw') {
    const msg = action === 'send'
      ? `Send ${sendable} option${sendable === 1 ? '' : 's'} to the customer portal for approval?`
      : `Withdraw ${waiting} option${waiting === 1 ? '' : 's'} from the customer portal?`
    if (!confirm(msg)) return
    setPortalBusy(true)
    try {
      const n = await (action === 'send' ? sendQuoteForApproval(quoteId) : withdrawQuoteApproval(quoteId))
      toast.success(action === 'send' ? `${n} option${n === 1 ? '' : 's'} sent for approval` : 'Withdrawn from portal')
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setPortalBusy(false)
    }
  }

  function openEditor(responseId: string) {
    setOpenId(responseId)
  }

  async function useRateFromChat(o: RateOption, lane: QuoteLane) {
    const { id: responseId } = await createQuoteResponse(quoteId)
    await saveQuoteResponseLines(responseId, await withLiveFx(buildBuyLinesFromOption(o, lane.containers)))
    await reload()
    setSearchOpen(false)
    setTab('responses')
    setOpenId(responseId)
  }

  async function useLclRateFromChat(o: LclRateOption, _lane: LclQuoteLane) {
    const { id: responseId } = await createQuoteResponse(quoteId)
    await saveQuoteResponseLines(responseId, await withLiveFx(buildLclBuyLinesFromOption(o)))
    await reload()
    setSearchOpen(false)
    setTab('responses')
    setOpenId(responseId)
  }

  return (
    <section className="qr-panel">
      {searchOpen && (
        <RateSearchModal onUseRate={useRateFromChat} onUseLclRate={useLclRateFromChat} initialWm={lclWm} onClose={() => setSearchOpen(false)} />
      )}
      <div className="qr-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`qr-tab${tab === t.key ? ' qr-tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'responses' && (
        <>
          <div className="qr-head">
            <h2 className="qr-head__title">Quote Responses</h2>
            <div className="qr-actions">
              {waiting > 0 && (
                <button type="button" className="nqd-btn nqd-btn--ghost" disabled={portalBusy} onClick={() => handlePortal('withdraw')}>
                  <Undo2 size={15} /> Withdraw
                </button>
              )}
              {sendable > 0 && !decided && (
                <button type="button" className="nqd-btn nqd-btn--ghost" disabled={portalBusy} onClick={() => handlePortal('send')}>
                  <Send size={15} /> Send for approval{sendable > 1 ? ` (${sendable})` : ''}
                </button>
              )}
              <button type="button" className="nqd-btn nqd-btn--ghost" onClick={handleSearchRates}>
                <Search size={15} /> Search Rates
              </button>
              <button type="button" className="nqd-btn nqd-btn--accent" disabled={creating} onClick={handleAdd}>
                <Plus size={15} /> {creating ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>

          {loading ? (
            <p className="qr-placeholder">Loading responses…</p>
          ) : responses.length === 0 ? (
            <p className="qr-placeholder">No responses yet — add one to start pricing.</p>
          ) : (
            <div className="quote-responses__list">
              {responses.map((r, index) => (
                <QuoteResponseCard
                  key={r.id}
                  r={r}
                  index={index}
                  nzdRate={nzdRates.get(r.currency)}
                  onOpen={openEditor}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'vendor' && (
        <QuoteVendorRates
          quoteId={quoteId}
          responses={responses}
          onChanged={(openId) => { reload(); setTab('responses'); if (openId) setOpenId(openId) }}
        />
      )}
      {tab === 'preview' && (
        <Suspense fallback={<p className="qr-placeholder">Loading preview…</p>}>
          <QuotePreviewTab quoteId={quoteId} responses={responses.map((r) => ({ id: r.id, response_no: r.response_no }))} />
        </Suspense>
      )}
      {tab === 'request' && (
        <QuoteRequestRates quoteId={quoteId} />
      )}
      {tab === 'audit' && (
        <QuoteAudit quoteId={quoteId} />
      )}

      {openId && (
        <QuoteResponseModal
          quoteId={quoteId}
          responseId={openId}
          onClose={() => setOpenId(null)}
          onSaved={reload}
        />
      )}
    </section>
  )
}
