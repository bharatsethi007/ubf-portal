import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Link2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import QuoteLinkDialog from '@/features/quoteBooking/QuoteLinkDialog'
import {
  fetchBookingQuote, unlinkQuote, money,
  type LinkedQuote, type QuoteResponseLine, type QuoteResponseSummary,
} from '@/features/quoteBooking/quoteBookingApi'
import FinanceQuoteLines, { vendorCosts } from './FinanceQuoteLines'

type Props = { bookingId: string; onChanged: () => void }

const iconFilled: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'auto', height: 32, padding: '0 10px' }

export default function BookingFinanceTab({ bookingId, onChanged }: Props) {
  const [quote, setQuote] = useState<LinkedQuote | null>(null)
  const [resp, setResp] = useState<QuoteResponseSummary | null>(null)
  const [lines, setLines] = useState<QuoteResponseLine[]>([])
  const [loading, setLoading] = useState(true)
  const [linkOpen, setLinkOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetchBookingQuote(bookingId)
      setQuote(r.quote); setResp(r.response); setLines(r.lines)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load finance')
    } finally { setLoading(false) }
  }, [bookingId])

  useEffect(() => { void load() }, [load])

  async function unlink() {
    if (!window.confirm(`Unlink ${quote?.quote_no ?? 'quote'} from this booking?`)) return
    try {
      await unlinkQuote(bookingId)
      toast.success('Quote unlinked')
      await load(); onChanged()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Unlink failed') }
  }

  if (loading) return <div className="bk-card" style={{ padding: 16 }}><p className="text-muted-foreground">Loading…</p></div>

  const costs = vendorCosts(lines)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="bk-card">
        <div className="bk-card__toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500 }}>Quote</span>
            {quote && (
              <>
                <Link to={`/quotes/${quote.id}`} className="mono">{quote.quote_no ?? 'Quote'}</Link>
                <span className={quote.status === 'won' ? 'bk-pill bk-pill--green' : 'bk-pill'}>{quote.status}</span>
                {resp?.response_no && <span className="bk-pill">{resp.response_no}</span>}
                {resp?.carrier && <span className="text-muted-foreground text-sm">{resp.carrier}</span>}
              </>
            )}
          </div>
          {quote ? (
            <button className="icon-btn" title="Unlink quote" aria-label="Unlink quote" onClick={() => void unlink()}><Unlink size={15} /></button>
          ) : (
            <button className="btn btn--inline" style={iconFilled} title="Link quote" aria-label="Link quote" onClick={() => setLinkOpen(true)}><Link2 size={15} /></button>
          )}
        </div>

        {!quote && <p className="text-muted-foreground pad-inline" style={{ padding: 16 }}>No quote linked. Link one to see quoted sell and expected costs.</p>}

        {quote && (
          <div style={{ padding: 16, display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <Kpi label="Quoted sell" value={money(resp?.total_sell, resp?.currency)} />
              <Kpi label="Quoted buy" value={money(resp?.total_buy, resp?.currency)} />
              <Kpi label="Profit" value={money(resp?.net_profit, resp?.currency)} />
              <Kpi label="Margin" value={resp?.margin_pct != null ? `${Number(resp.margin_pct).toFixed(1)}%` : '-'} />
              <Kpi label="Lane" value={`${quote.from_port_code ?? '?'} → ${quote.to_port_code ?? '?'}`} />
              <Kpi label="Valid till" value={resp?.valid_till ?? '-'} />
            </div>
            {!resp && <p className="text-muted-foreground">Quote has no response yet.</p>}
            {resp && <FinanceQuoteLines lines={lines} currency={resp.currency} />}
          </div>
        )}
      </section>

      {quote && (
        <section className="bk-card">
          <div className="bk-card__toolbar"><span style={{ fontWeight: 500 }}>Expected costs</span>
            <span className="text-muted-foreground text-sm" style={{ marginLeft: 8 }}>from quote buy lines</span></div>
          {costs.length === 0 ? (
            <p className="text-muted-foreground" style={{ padding: 16 }}>No buy costs on the quote.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Vendor</th><th style={{ textAlign: 'right' }}>Expected ({resp?.currency ?? 'NZD'})</th></tr></thead>
                <tbody>
                  {costs.map((c) => (
                    <tr key={c.vendor}><td>{c.vendor}</td><td style={{ textAlign: 'right' }}>{money(c.total)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <QuoteLinkDialog bookingId={bookingId} open={linkOpen} onOpenChange={setLinkOpen}
        onLinked={() => { void load(); onChanged() }} />
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 12px', background: '#fff' }}>
      <div className="text-muted-foreground" style={{ fontSize: 11 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  )
}
