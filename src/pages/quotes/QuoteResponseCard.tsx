import type { MouseEvent } from 'react'
import { AlertTriangle, Pencil, Trash2, Copy, Sparkles } from 'lucide-react'
import type { QuoteResponseSummary } from './quoteResponsesApi'
import { fmtDate, fmtResponseMoney, responseStatusPill } from './quoteResponseUi'
import { AI_TIP } from './quoteUnsent'
import ResponseSources from '../brainbox/ResponseSources'

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
          {!r.sent_to_portal_at && r.gaps && r.gaps.length > 0 && (
            <span className="quote-response-pill quote-response-pill--gap" title={`${r.gaps.join('. ')}. Add before sending for approval.`}>
              <AlertTriangle size={11} /> {r.gaps.length === 1 ? r.gaps[0] : 'Not a full quote'}
            </span>
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
      <div className="mt-1 flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="w-[300px] max-w-full shrink-0">
          <p className="quote-response-card__meta muted" style={{ marginTop: 0 }}>
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
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-[#6B7486]">Quote total</span>
              <span className="font-mono text-base font-medium tabular-nums">{cur} {fmtResponseMoney(r.total_sell)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-[#6B7486]">Buy</span>
              <span className="font-mono text-[13px] tabular-nums text-[#3D4757]">{cur} {fmtResponseMoney(r.total_buy)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6B7486]">Profit</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-[13px] font-medium tabular-nums text-[#0F7A4F]">{cur} {fmtResponseMoney(r.net_profit)}</span>
                {r.margin_pct != null && (
                  <span className="rounded-full bg-[#E6F4EC] px-2 py-px text-[11px] text-[#0F5E3D]">{r.margin_pct.toFixed(1)}%</span>
                )}
              </span>
            </div>
            {foreign && nzd(r.total_sell) != null && (
              <div className="mt-1 border-t border-dashed border-[#E6E9F0] pt-1.5 text-[11px] text-[#8A93A5]">
                About NZD {fmtResponseMoney(nzd(r.total_sell))} total, NZD {fmtResponseMoney(nzd(r.net_profit))} profit at today's rate
              </div>
            )}
          </div>
        </div>
        <ResponseSources responseId={r.id} refreshKey={`${r.total_sell}|${r.total_buy}`} />
      </div>
    </article>
  )
}
