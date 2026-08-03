import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { Pencil, Trash2, Search, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  createQuoteResponse,
  deleteQuoteResponse,
  fetchQuoteResponses,
  type QuoteResponseSummary,
} from './quoteResponsesApi'
import { fmtDate, fmtResponseMoney, responseStatusPill } from './quoteResponseUi'
import QuoteResponseModal from './QuoteResponseModal'
import QuoteVendorRates from './QuoteVendorRates'
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
  const [tab, setTab] = useState<TabKey>('responses')

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
    toast('Rate search will be wired up soon')
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

  function openEditor(responseId: string) {
    setOpenId(responseId)
  }

  return (
    <section className="qr-panel">
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
                <article
                  key={r.id}
                  className="quote-response-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => openEditor(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') openEditor(r.id)
                  }}
                >
                  <div className="quote-response-card__top">
                    <div className="quote-response-card__title-row">
                      <h3 className="quote-response-card__title">
                        # {index + 1} - {r.response_no ?? 'Draft'}
                      </h3>
                      {responseStatusPill(r.status)}
                    </div>
                    <div className="quote-response-card__actions">
                      <button
                        type="button"
                        className="quote-response-card__icon"
                        aria-label="Edit response"
                        onClick={(e) => { e.stopPropagation(); openEditor(r.id) }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="quote-response-card__icon quote-response-card__icon--danger"
                        aria-label="Delete response"
                        onClick={(e) => handleDelete(e, r.id, r.response_no)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="quote-response-card__meta muted">
                    {fmtDate(r.quotation_date)}
                    {r.carrier ? ` · ${r.carrier}` : ''}
                  </p>
                  <div className="quote-response-card__totals">
                    <div>Quote Total NZD {fmtResponseMoney(r.total_sell)}</div>
                    <div>Total Buy Amount {fmtResponseMoney(r.total_buy)}</div>
                    <div className="quote-response-card__profit">
                      Net Profit (Margin%): {fmtResponseMoney(r.net_profit)}
                      {r.margin_pct != null ? ` (${r.margin_pct.toFixed(1)}%)` : ''}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'vendor' && (
        <QuoteVendorRates quoteId={quoteId} />
      )}
      {tab === 'preview' && (
        <Suspense fallback={<p className="qr-placeholder">Loading preview…</p>}>
          <QuotePreviewTab quoteId={quoteId} responses={responses.map((r) => ({ id: r.id, response_no: r.response_no }))} />
        </Suspense>
      )}
      {tab === 'request' && (
        <p className="qr-placeholder">Request rates from agents or vendors here.</p>
      )}
      {tab === 'audit' && (
        <p className="qr-placeholder">Response history will appear here.</p>
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
