import { useCallback, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import RefSelect from '../../components/common/RefSelect'
import { useShippingLines, useCurrencies, useTaxRates } from '../../hooks/useQuoteRefData'
import { useSeaPorts } from '../../hooks/useSeaPorts'
import {
  fetchQuoteResponse,
  updateQuoteResponseHeader,
  type QuoteResponseHeader,
  type QuoteResponseRecord,
} from './quoteResponsesApi'
import { fetchQuote, type QuoteRecord } from './quotesApi'
import QuoteResponseLinesGrid from './QuoteResponseLinesGrid'
import {
  fetchQuoteResponseLines,
  saveQuoteResponseLines,
  updateResponseTotals,
  computeResponseTotals,
  type QuoteResponseLine,
} from './quoteResponseLinesApi'
import './quoteResponseModal.css'

type Props = {
  quoteId: string
  responseId: string
  onClose: () => void
  onSaved: () => void
}

function headerFromRecord(r: QuoteResponseRecord): QuoteResponseHeader {
  const { id: _i, response_no: _n, quote_id: _q, status: _s, ...header } = r
  return header
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="qrm-field">
      <span className="qrm-field__label">{label}</span>
      {children}
    </label>
  )
}

export default function QuoteResponseModal({ quoteId, responseId, onClose, onSaved }: Props) {
  const [quote, setQuote] = useState<QuoteRecord | null>(null)
  const [response, setResponse] = useState<QuoteResponseRecord | null>(null)
  const [header, setHeader] = useState<QuoteResponseHeader | null>(null)
  const [lines, setLines] = useState<QuoteResponseLine[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const { items: shippingLines } = useShippingLines()
  const { items: currencies } = useCurrencies()
  const { ports } = useSeaPorts()

  const shippingLineOptions = useMemo(
    () => shippingLines.map((s) => ({ value: s.name, label: s.name })),
    [shippingLines],
  )
  const currencyOptions = useMemo(
    () => currencies.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` })),
    [currencies],
  )
  const portOptions = useMemo(
    () => ports.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` })),
    [ports],
  )

  const { items: taxes } = useTaxRates()
  const taxRateByCode = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of taxes) m[t.code] = t.rate_pct
    return m
  }, [taxes])
  const totals = useMemo(() => computeResponseTotals(lines, taxRateByCode), [lines, taxRateByCode])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [q, r, ls] = await Promise.all([
        fetchQuote(quoteId),
        fetchQuoteResponse(responseId),
        fetchQuoteResponseLines(responseId),
      ])
      setQuote(q)
      setResponse(r)
      setHeader(r ? headerFromRecord(r) : null)
      setLines(ls)
    } catch {
      toast.error('Failed to load response')
    } finally {
      setLoading(false)
    }
  }, [quoteId, responseId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function patch(p: Partial<QuoteResponseHeader>) {
    setHeader((h) => (h ? { ...h, ...p } : h))
  }

  async function persist(): Promise<boolean> {
    if (!header) return false
    setSaving(true)
    try {
      await updateQuoteResponseHeader(responseId, header)
      await saveQuoteResponseLines(responseId, lines)
      await updateResponseTotals(responseId, totals)
      onSaved()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save response')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (await persist()) { toast.success('Response saved'); onClose() }
  }
  async function handleSaveStay() {
    if (await persist()) toast.success('Response saved')
  }

  return (
    <div className="qrm-overlay" onClick={onClose}>
      <div className="qrm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qrm-head">
          <div>
            <div className="qrm-title">
              Quotation Response {response?.response_no ?? ''}
            </div>
            <div className="qrm-sub">
              {quote?.quote_no ?? '—'} · {quote?.customer_name ?? '—'}
            </div>
          </div>
          <button type="button" className="qrm-close" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="qrm-body">
          {loading || !header ? (
            <p className="muted">Loading…</p>
          ) : (
            <>
              <p className="qrm-section-title">General</p>
              <div className="qrm-grid">
                <Field label="Quote Response No.">
                  <input className="nqd-input qrm-input--ro" value={response?.response_no ?? ''} readOnly disabled />
                </Field>
                <Field label="Quote No.">
                  <input className="nqd-input qrm-input--ro" value={quote?.quote_no ?? ''} readOnly disabled />
                </Field>
                <Field label="Quotation Date">
                  <input type="date" className="nqd-input" value={header.quotation_date ?? ''} onChange={(e) => patch({ quotation_date: e.target.value || null })} />
                </Field>
                <Field label="Valid Till">
                  <input type="date" className="nqd-input" value={header.valid_till ?? ''} onChange={(e) => patch({ valid_till: e.target.value || null })} />
                </Field>

                <Field label="ETD">
                  <input type="date" className="nqd-input" value={header.etd ?? ''} onChange={(e) => patch({ etd: e.target.value || null })} />
                </Field>
                <Field label="ETA">
                  <input type="date" className="nqd-input" value={header.eta ?? ''} onChange={(e) => patch({ eta: e.target.value || null })} />
                </Field>
                <Field label="Shipping Line">
                  <RefSelect className="nqd-input" value={header.carrier} options={shippingLineOptions} placeholder="Select line…" onChange={(v) => patch({ carrier: v })} />
                </Field>
                <Field label="Via Port">
                  <RefSelect className="nqd-input" value={header.via_port} options={portOptions} placeholder="Select port…" onChange={(v) => patch({ via_port: v })} />
                </Field>

                <Field label="Transit Time (Days)">
                  <input type="number" className="nqd-input" value={header.transit_time_days ?? ''} onChange={(e) => patch({ transit_time_days: e.target.value })} />
                </Field>
                <Field label="Free Days">
                  <input type="number" className="nqd-input" value={header.origin_free_time_days ?? ''} onChange={(e) => patch({ origin_free_time_days: e.target.value })} />
                </Field>
                <Field label="Currency">
                  <RefSelect className="nqd-input" value={header.currency} options={currencyOptions} allowEmpty={false} onChange={(v) => patch({ currency: v ?? 'NZD' })} />
                </Field>
              </div>

              <QuoteResponseLinesGrid lines={lines} currency={header.currency ?? 'NZD'} onChange={setLines} />

              <div className="qrm-totals">
                <div className="qrm-totrow"><span>Sub Total</span><span>{header.currency ?? 'NZD'} {fmtMoney(totals.subTotal)}</span></div>
                <div className="qrm-totrow"><span>Total Tax</span><span>{header.currency ?? 'NZD'} {fmtMoney(totals.totalTax)}</span></div>
                <div className="qrm-totrow qrm-totrow--strong"><span>Total Sell Amount</span><span>{header.currency ?? 'NZD'} {fmtMoney(totals.totalSell)}</span></div>
                <div className="qrm-totrow qrm-totrow--buy"><span>Total Buy Amount</span><span>{header.currency ?? 'NZD'} {fmtMoney(totals.totalBuy)}</span></div>
                <div className="qrm-totrow qrm-totrow--profit"><span>Net Profit (Margin %)</span><span>{header.currency ?? 'NZD'} {fmtMoney(totals.netProfit)} ({totals.marginPct.toFixed(1)}%)</span></div>
              </div>
            </>
          )}
        </div>

        <div className="qrm-foot">
          <button type="button" className="nqd-btn nqd-btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="nqd-btn nqd-btn--ghost" onClick={handleSaveStay} disabled={saving || loading}>{saving ? 'Saving…' : 'Save and Stay'}</button>
          <button type="button" className="nqd-btn nqd-btn--accent" onClick={handleSave} disabled={saving || loading}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}
