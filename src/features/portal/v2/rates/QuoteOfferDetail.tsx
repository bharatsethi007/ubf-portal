import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Loader2, MessageSquare, Package, X } from 'lucide-react'
import { fmtDay } from '../homeModel'
import { money } from './ratesApi'
import QuoteBookingModal from './QuoteBookingModal'
import { daysLeft, groupLines, listOfferLines, respondToOffer, type OfferLine, type QuoteOffer } from './quotesApi'

type Props = { o: QuoteOffer; open: number; onAnswered: () => void }

const fmtQty = (n: number | null) => (n == null ? '' : n.toLocaleString('en-NZ', { maximumFractionDigits: 2 }))

/** Charges, terms and the approve / reject step for one quote. */
export default function QuoteOfferDetail({ o, open, onAnswered }: Props) {
  const multi = open > 1
  const [lines, setLines] = useState<OfferLine[] | null>(null)
  const [err, setErr] = useState('')
  const [step, setStep] = useState<'idle' | 'approve' | 'reject'>('idle')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [terms, setTerms] = useState(false)
  const [booking, setBooking] = useState(false)
  const cur = o.currency ?? 'NZD'
  const left = daysLeft(o.valid_till)

  useEffect(() => {
    listOfferLines(o.id).then(setLines).catch((e) => setErr(e instanceof Error ? e.message : 'Could not load'))
  }, [o.id])

  async function answer(decision: 'approve' | 'reject') {
    if (decision === 'reject' && !note.trim()) { setErr('Tell us why so we can improve it.'); return }
    setBusy(true)
    setErr('')
    try {
      await respondToOffer(o.id, decision, note.trim())
      onAnswered()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save your answer')
      setBusy(false)
    }
  }

  const facts: [string, string | null][] = [
    ['Carrier', o.carrier], ['Via', o.via_port], ['Transit', o.transit_time_days ? `${o.transit_time_days} days` : null],
    ['ETD', o.etd ? fmtDay(o.etd) : null], ['ETA', o.eta ? fmtDay(o.eta) : null], ['Incoterm', o.incoterms],
    ['Free time at origin', o.origin_free_time_days ? `${o.origin_free_time_days} days` : null],
    ['Free time at destination', o.detention_free_time_dest ? `${o.detention_free_time_dest} days` : null],
    ['Valid', o.valid_till ? `${o.valid_from ? `${fmtDay(o.valid_from)} to ` : 'Until '}${fmtDay(o.valid_till)}` : null],
    ['Your reference', o.customer_po], ['Quote', `${o.quote_no}${o.response_no ? ` · ${o.response_no}` : ''}`], ['Booking', o.booking_ref],
  ]

  return (
    <div className="pv3-qdetail">
      <dl className="pv3-peek__facts">
        {facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd title={v ?? ''}>{v}</dd></div>)}
      </dl>

      {lines === null && !err && <span className="pv3-skel" />}
      {lines && (
        <div className="pv3-qlines">
          {groupLines(lines).map((g) => (
            <section key={g.key}>
              <header><span>{g.label}</span><span className="pv3-mono">{money(g.total, cur)}</span></header>
              {g.lines.map((l) => (
                <div key={l.id} className="pv3-qline">
                  <span>{l.description ?? 'Charge'}</span>
                  <span className="pv3-muted pv3-mono">
                    {l.qty != null && l.qty !== 1 ? `${fmtQty(l.qty)} × ` : ''}{money(l.sell_rate, l.sell_currency ?? cur)}{l.unit ? ` ${l.unit.toLowerCase()}` : ''}
                  </span>
                  <span className="pv3-mono">{money(l.total_sell, cur)}</span>
                </div>
              ))}
            </section>
          ))}
          <div className="pv3-qtotal">
            {!!o.total_tax && <div><span>Tax</span><span className="pv3-mono">{money(o.total_tax, cur)}</span></div>}
            <div className="pv3-qtotal__grand"><span>Total</span><span className="pv3-mono">{money(o.total_sell, cur)}</span></div>
          </div>
        </div>
      )}

      {o.customer_notes && <p className="pv3-qnote">{o.customer_notes}</p>}
      {o.terms_conditions && (
        <div className="pv3-qterms">
          <button type="button" className="pv3-textbtn" onClick={() => setTerms((t) => !t)}>
            Terms and conditions <ChevronDown size={14} className={`pv3-chev${terms ? ' pv3-chev--open' : ''}`} />
          </button>
          {terms && <p>{o.terms_conditions}</p>}
        </div>
      )}

      {o.portal_status !== 'pending' && o.decision_note && (
        <p className="pv3-qnote">{o.portal_status === 'rejected' ? 'Your reason' : 'Your note'}: {o.decision_note}</p>
      )}

      {o.portal_status === 'pending' && (
        <div className="pv3-qact">
          {step === 'idle' ? (
            <>
              <span className="pv3-muted">{left != null && left <= 3 ? `Expires ${left <= 0 ? 'today' : `in ${left} day${left === 1 ? '' : 's'}`}. ` : ''}{multi ? 'Choose this option to lock in its price.' : 'Approve to lock in this price.'}</span>
              <button type="button" className="pv3-btn pv3-btn--ghost" onClick={() => setStep('reject')}><X size={14} /> {multi ? 'None of these' : 'Reject'}</button>
              <button type="button" className="pv3-btn pv3-btn--ok" onClick={() => (o.booking_id ? setStep('approve') : setBooking(true))}>
                <Check size={14} /> {o.booking_id ? (multi ? 'Choose this option' : 'Approve') : (multi ? 'Choose and book' : 'Approve and book')}
              </button>
            </>
          ) : (
            <div className="pv3-qconfirm">
              <label htmlFor={`qn-${o.id}`}>
                {step === 'approve'
                  ? `${multi ? 'Choose' : 'Approve'} ${o.carrier ?? o.response_no ?? o.quote_no} for ${money(o.total_sell, cur)}?${multi ? ' The other options close.' : ''} Add a note if you like.`
                  : `${multi ? `This rejects all ${open} options. ` : ''}Why is this not right? Price, timing, routing?`}
              </label>
              <textarea id={`qn-${o.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder={step === 'approve' ? 'e.g. Cargo ready 12 Oct, please book' : 'e.g. Need a lower price or a faster sailing'} />
              <div className="pv3-qconfirm__btns">
                <button type="button" className="pv3-textbtn" disabled={busy} onClick={() => { setStep('idle'); setErr('') }}>Cancel</button>
                <button type="button" className={`pv3-btn ${step === 'approve' ? 'pv3-btn--ok' : 'pv3-btn--primary'}`} disabled={busy} onClick={() => void answer(step)}>
                  {busy && <Loader2 size={14} className="pv3-spin" />}{step === 'approve' ? 'Confirm approval' : 'Send rejection'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {o.portal_status === 'approved' && !o.booking_id && (
        <div className="pv3-qact">
          <span className="pv3-muted">Approved. Add the shipment details to book it.</span>
          <button type="button" className="pv3-btn pv3-btn--ok" onClick={() => setBooking(true)}><Package size={14} /> Book this quote</button>
        </div>
      )}
      {o.portal_status === 'expired' && (
        <div className="pv3-qact">
          <span className="pv3-muted">This price has expired.</span>
          <Link className="pv3-btn pv3-btn--ghost" to={`/portal/messages?new=1&subject=${encodeURIComponent(`Refresh quote ${o.response_no ?? o.quote_no}`)}`}><MessageSquare size={14} /> Ask for a refresh</Link>
        </div>
      )}
      {booking && <QuoteBookingModal o={o} closesOthers={multi} onClose={() => setBooking(false)} onBooked={() => { setBooking(false); onAnswered() }} />}
      {err && <div className="pv3-form__err" role="alert">{err}</div>}
    </div>
  )
}
