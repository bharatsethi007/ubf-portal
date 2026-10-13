import type { MouseEvent } from 'react'
import { Pencil, Trash2, Copy, Sparkles } from 'lucide-react'
import type { QuoteResponseSummary } from './quoteResponsesApi'
import { fmtDate, fmtResponseMoney, responseStatusPill } from './quoteResponseUi'
import { AI_TIP } from './quoteUnsent'

type Props = {
  r: QuoteResponseSummary
  index: number
  /** NZD per 1 unit of the response currency (mid rate). Undefined when unknown or NZD. */
  nzdRate?: number
  onOpen: (id: string) => void
  onCopy: (e: MouseEvent, id: string) => void
  onDelete: (e: MouseEvent, id: string, responseNo: string | null) => void
}

const FX_PILL = { color: '#92400E', background: '#FFFBEB', border: '1px solid #FCD34D' }

export default function QuoteResponseCard({ r, index, nzdRate, onOpen, onCopy, onDelete }: Props) {
  const cur = r.currency || 'NZD'
  const foreign = cur !== 'NZD'
  const nzd = (n: number | null) => (n == null || !nzdRate ? null : n * nzdRate)

  return (
    <article
      className="quote-response-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(r.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(r.id) }}
    >
      <div className="quote-response-card__top">
        <div className="quote-response-card__title-row">
          <h3 className="quote-response-card__title"># {index + 1} - {r.response_no ?? 'Draft'}</h3>
          {foreign && (
            <span className="quote-response-pill" style={FX_PILL} title={`Quote priced in ${cur}`}>{cur}</span>
          )}
          {r.ai_generated && !r.sent_to_portal_at && (
            <span className="quote-response-pill quote-response-pill--ai" title={AI_TIP}><Sparkles size={11} /> UBF Intelligence</span>
          )}
          {r.status !== 'draft' && responseStatusPill(r.status)}
        </div>
        <div className="quote-response-card__actions">
          <button type="button" className="quote-response-card__icon" aria-label="Edit response" title="Edit"
            onClick={(e) => { e.stopPropagation(); onOpen(r.id) }}>
            <Pencil size={14} />
          </button>
          <button type="button" className="quote-response-card__icon" aria-label="Copy response" title="Copy response"
            onClick={(e) => onCopy(e, r.id)}>
            <Copy size={14} />
          </button>
          <button type="button" className="quote-response-card__icon quote-response-card__icon--danger" aria-label="Delete response" title="Delete"
            onClick={(e) => onDelete(e, r.id, r.response_no)}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <p className="quote-response-card__meta muted">
        {fmtDate(r.quotation_date)}
        {r.carrier ? ` · ${r.carrier}` : ''}
        {r.sent_to_portal_at ? ` · Sent to portal ${fmtDate(r.sent_to_portal_at)}` : ''}
        {r.decided_at ? ` · ${r.status === 'approved' ? 'Approved' : r.status === 'crosswin' ? 'Customer chose another option' : 'Rejected'} ${fmtDate(r.decided_at)}` : ''}
      </p>
      {r.decision_note && (r.status === 'approved' || r.status === 'rejected') && (
        <p className="quote-response-card__meta" style={{ color: r.status === 'rejected' ? '#B91C1C' : '#047857' }}>
          Customer: {r.decision_note}
        </p>
      )}
      <div className="quote-response-card__totals">
        <div>Quote Total {cur} {fmtResponseMoney(r.total_sell)}</div>
        <div>Total Buy Amount {cur} {fmtResponseMoney(r.total_buy)}</div>
        <div className="quote-response-card__profit">
          Net Profit (Margin%): {cur} {fmtResponseMoney(r.net_profit)}
          {r.margin_pct != null ? ` (${r.margin_pct.toFixed(1)}%)` : ''}
        </div>
        {foreign && nzd(r.total_sell) != null && (
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            ≈ NZD {fmtResponseMoney(nzd(r.total_sell))} total · NZD {fmtResponseMoney(nzd(r.net_profit))} profit (today's rate)
          </div>
        )}
      </div>
    </article>
  )
}
