import type { QuoteRow } from './quotesTableColumns'

export const AI_TIP = 'UBF Intelligence has quoted this. Please check, approve and send for approval.'

/**
 * Unsent flag for the list dot.
 * Portal requests: until any option is sent for approval.
 * Email requests: until sent for approval or emailed to the customer.
 * 'ai' = same, but UBF Intelligence already drafted an option.
 */
export function quoteUnsentFlag(r: QuoteRow): 'ai' | 'unsent' | null {
  if (r.status !== 'open' || r.sent_for_approval_at) return null
  const src = (r.source ?? '').toLowerCase()
  const portal = src.includes('portal')
  const email = src.includes('email')
  if (!portal && !email) return null
  if (email && r.last_reminded_at) return null
  return r.ai_priced_at ? 'ai' : 'unsent'
}

export function QuoteNoCell({ row }: { row: QuoteRow }) {
  const flag = quoteUnsentFlag(row)
  const tip = flag === 'ai' ? AI_TIP
    : flag ? `New ${(row.source ?? '').toLowerCase().includes('portal') ? 'portal' : 'email'} request, not sent to the customer yet`
    : undefined
  return (
    <span className="quote-no">
      <span className={`quote-no__dot${flag ? ` quote-no__dot--${flag}` : ''}`} title={tip} aria-label={tip} />
      {row.quote_no ?? '—'}
    </span>
  )
}
