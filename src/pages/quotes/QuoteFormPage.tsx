import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { CustomerPickerValue } from '../../components/bookings/CustomerPicker'
import { useStaffList } from '../../hooks/useStaffList'
import QuoteBasicFields from './QuoteBasicFields'
import QuoteLocationSection from './QuoteLocationSection'
import {
  createQuote,
  emptyQuoteDraft,
  fetchQuote,
  updateQuote,
  type QuoteDraft,
  type QuoteRecord,
} from './quotesApi'

function recordToDraft(record: QuoteRecord): QuoteDraft {
  const { id: _id, quote_no: _no, status: _s, created_at: _c, ...draft } = record
  return draft
}

function customerFromDraft(draft: QuoteDraft): CustomerPickerValue | null {
  if (!draft.customer_account_id && !draft.customer_name) return null
  return {
    account_id: draft.customer_account_id ?? '',
    name: draft.customer_name ?? '',
  }
}

export default function QuoteFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { staff, loading: staffLoading } = useStaffList()

  const [draft, setDraft] = useState<QuoteDraft>(emptyQuoteDraft)
  const [customer, setCustomer] = useState<CustomerPickerValue | null>(null)
  const [quoteNo, setQuoteNo] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  const patch = useCallback((p: Partial<QuoteDraft>) => {
    setDraft((d) => ({ ...d, ...p }))
  }, [])

  const onCustomerChange = useCallback((c: CustomerPickerValue | null) => {
    setCustomer(c)
    patch({
      customer_account_id: c?.account_id ?? null,
      customer_name: c?.name ?? null,
    })
  }, [patch])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const record = await fetchQuote(id)
        if (cancelled) return
        if (!record) {
          toast.error('Quote not found')
          navigate('/quotes')
          return
        }
        setDraft(recordToDraft(record))
        setCustomer(customerFromDraft(record))
        setQuoteNo(record.quote_no)
      } catch {
        if (!cancelled) toast.error('Failed to load quote')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, navigate])

  async function handleSave() {
    if (!draft.shipment_mode?.trim()) {
      toast.error('Shipment Mode is required')
      return
    }
    if (!draft.customer_account_id && !draft.customer_name?.trim()) {
      toast.error('Customer is required')
      return
    }

    setSaving(true)
    try {
      if (isEdit && id) {
        await updateQuote(id, draft)
        toast.success('Quote saved')
        navigate(`/quotes/${id}`)
      } else {
        const { id: newId } = await createQuote(draft)
        toast.success('Quote created')
        navigate(`/quotes/${newId}`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save quote')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="quote-form-page"><p className="muted">Loading…</p></div>
  }

  const title = isEdit ? (quoteNo ?? 'Edit Quotation') : 'New Quotation'

  return (
    <div className="quote-form-page">
      <div className="card quote-form-page__card">
        <div className="quote-form-page__header">
          <h1 className="quote-form-page__title">{title}</h1>
          <div className="quote-form-page__actions">
            <Link to="/quotes" className="btn booking-form__cancel">Cancel</Link>
            <button type="button" className="btn" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <section className="quote-form__section card booking-form-card">
          <h2 className="booking-form-card__title">Basic</h2>
          <div className="booking-form-card__body">
            <QuoteBasicFields
              draft={draft}
              customer={customer}
              staff={staff}
              staffLoading={staffLoading}
              onPatch={patch}
              onCustomerChange={onCustomerChange}
            />
          </div>
        </section>

        <div className="quote-form__locations">
          <QuoteLocationSection side="origin" draft={draft} onPatch={patch} />
          <QuoteLocationSection side="destination" draft={draft} onPatch={patch} />
        </div>

        <section className="quote-form__section card booking-form-card">
          <h2 className="booking-form-card__title">Cargo Value</h2>
          <div className="booking-form-card__body quote-form__cargo-row">
            <label className="filter-field booking-form-field">
              <span className="filter-field__label">Currency</span>
              <input
                type="text"
                className="input input--sm"
                value={draft.cargo_value_currency ?? 'NZD'}
                onChange={(e) => patch({ cargo_value_currency: e.target.value || null })}
              />
            </label>
            <label className="filter-field booking-form-field">
              <span className="filter-field__label">Cargo Value</span>
              <input
                type="number"
                className="input input--sm"
                value={draft.cargo_value ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  patch({ cargo_value: v === '' ? null : Number(v) })
                }}
              />
            </label>
          </div>
        </section>

        <section className="quote-form__section card booking-form-card">
          <h2 className="booking-form-card__title">Flags</h2>
          <div className="booking-form-card__body quote-form__flags">
            <label className="check-row">
              <input
                type="checkbox"
                checked={draft.need_insurance}
                onChange={(e) => patch({ need_insurance: e.target.checked })}
              />
              Need Insurance
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={draft.need_refrigeration}
                onChange={(e) => patch({ need_refrigeration: e.target.checked })}
              />
              Need Refrigeration
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={draft.is_hazardous}
                onChange={(e) => patch({ is_hazardous: e.target.checked })}
              />
              Is Hazardous
            </label>
            {draft.is_hazardous && (
              <label className="filter-field booking-form-field quote-form__hazard">
                <span className="filter-field__label">Comments / Special Instruction</span>
                <textarea
                  className="input input--sm quote-form__textarea"
                  rows={3}
                  value={draft.hazard_comments ?? ''}
                  onChange={(e) => patch({ hazard_comments: e.target.value || null })}
                />
              </label>
            )}
          </div>
        </section>

        <div className="quote-form-page__footer">
          <button type="button" className="btn" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
