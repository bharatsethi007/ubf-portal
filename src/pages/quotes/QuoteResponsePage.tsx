import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import QuoteResponseHeaderFields from './QuoteResponseHeaderFields'
import {
  fetchQuoteResponse,
  updateQuoteResponseHeader,
  type QuoteResponseHeader,
  type QuoteResponseRecord,
} from './quoteResponsesApi'
import { fetchQuote, type QuoteRecord } from './quotesApi'

function headerFromRecord(record: QuoteResponseRecord): QuoteResponseHeader {
  const {
    id: _id,
    response_no: _no,
    quote_id: _qid,
    status: _s,
    ...header
  } = record
  return header
}

export default function QuoteResponsePage() {
  const { id, responseId } = useParams()
  const [quote, setQuote] = useState<QuoteRecord | null>(null)
  const [response, setResponse] = useState<QuoteResponseRecord | null>(null)
  const [header, setHeader] = useState<QuoteResponseHeader | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id || !responseId) return
    setLoading(true)
    try {
      const [q, r] = await Promise.all([fetchQuote(id), fetchQuoteResponse(responseId)])
      setQuote(q)
      setResponse(r)
      setHeader(r ? headerFromRecord(r) : null)
    } catch {
      toast.error('Failed to load response')
      setQuote(null)
      setResponse(null)
      setHeader(null)
    } finally {
      setLoading(false)
    }
  }, [id, responseId])

  useEffect(() => {
    load()
  }, [load])

  function patch(p: Partial<QuoteResponseHeader>) {
    setHeader((h) => (h ? { ...h, ...p } : h))
  }

  async function handleSave() {
    if (!responseId || !header) return
    setSaving(true)
    try {
      await updateQuoteResponseHeader(responseId, header)
      toast.success('Response saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save response')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="quote-form-page">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  if (!quote || !response || !header) {
    return (
      <div className="quote-form-page">
        <div className="card pad">
          <p>Response not found.</p>
          {id && (
            <Link to={`/quotes/${id}`} className="text-link">Back to quote</Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="quote-form-page">
      <div className="card quote-form-page__card">
        <Link to={`/quotes/${id}`} className="text-link quote-detail__back">
          <ArrowLeft size={16} aria-hidden />
          {quote.quote_no ?? 'Quote'}
        </Link>
        <div className="quote-form-page__header">
          <div>
            <h1 className="quote-form-page__title">
              Quotation Response {response.response_no ?? ''}
            </h1>
            <p className="muted quote-detail__meta">
              {quote.quote_no ?? '—'} · {quote.customer_name ?? '—'}
            </p>
          </div>
          <button type="button" className="btn" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <section className="card booking-form-card quote-form__section">
        <h2 className="booking-form-card__title">General</h2>
        <div className="booking-form-card__body">
          <QuoteResponseHeaderFields header={header} onPatch={patch} />
          <div className="quote-form-page__footer">
            <button type="button" className="btn" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </section>

      <div className="card pad muted">Rate lines — coming next</div>
    </div>
  )
}
