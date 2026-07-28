import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import QuoteCargoLines from './QuoteCargoLines'
import {
  fetchQuoteCargo,
  newQuoteCargoLine,
  saveQuoteCargo,
  type QuoteCargoLine,
} from './quoteCargoApi'
import { fetchQuote, type QuoteRecord } from './quotesApi'
import { quoteStatusPill } from './quotesTableColumns'

export default function QuoteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quote, setQuote] = useState<QuoteRecord | null>(null)
  const [cargoLines, setCargoLines] = useState<QuoteCargoLine[]>([newQuoteCargoLine(0)])
  const [loading, setLoading] = useState(true)
  const [savingCargo, setSavingCargo] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [q, cargo] = await Promise.all([fetchQuote(id), fetchQuoteCargo(id)])
      setQuote(q)
      setCargoLines(cargo.length ? cargo : [newQuoteCargoLine(0)])
    } catch {
      toast.error('Failed to load quote')
      setQuote(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  function addLine() {
    setCargoLines((lines) => [...lines, newQuoteCargoLine(lines.length)])
  }

  async function handleSaveCargo() {
    if (!id) return
    setSavingCargo(true)
    try {
      await saveQuoteCargo(id, cargoLines)
      toast.success('Cargo saved')
      const refreshed = await fetchQuoteCargo(id)
      setCargoLines(refreshed.length ? refreshed : [newQuoteCargoLine(0)])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save cargo')
    } finally {
      setSavingCargo(false)
    }
  }

  if (loading) {
    return (
      <div className="quote-form-page">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="quote-form-page">
        <div className="card pad">
          <p>Quote not found.</p>
          <Link to="/quotes" className="text-link">Back to quotes</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="quote-form-page">
      <div className="card quote-form-page__card">
        <Link to="/quotes" className="text-link quote-detail__back">
          <ArrowLeft size={16} aria-hidden />
          Quotes
        </Link>
        <div className="quote-form-page__header">
          <div>
            <div className="quote-detail__title-row">
              <h1 className="quote-form-page__title">{quote.quote_no ?? 'Quotation'}</h1>
              {quoteStatusPill(quote.status)}
            </div>
            <p className="muted quote-detail__meta">
              {quote.customer_name ?? '—'}
              {quote.shipment_mode ? ` · ${quote.shipment_mode}` : ''}
            </p>
          </div>
          <button type="button" className="btn" onClick={() => navigate(`/quotes/${id}/edit`)}>
            Edit request
          </button>
        </div>
      </div>

      <section className="card booking-form-card quote-form__section">
        <h2 className="booking-form-card__title">Load Details</h2>
        <div className="booking-form-card__body">
          <QuoteCargoLines lines={cargoLines} onChange={setCargoLines} />
          <div className="quote-form-page__footer quote-detail__cargo-bar">
            <button type="button" className="cargo-table__add" onClick={addLine}>
              + Add line
            </button>
            <button type="button" className="btn" disabled={savingCargo} onClick={handleSaveCargo}>
              {savingCargo ? 'Saving…' : 'Save cargo'}
            </button>
          </div>
        </div>
      </section>

      <div className="card pad muted">Responses — coming next</div>
    </div>
  )
}
