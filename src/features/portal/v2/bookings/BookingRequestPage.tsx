import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, CheckCircle2, Info, Loader2 } from 'lucide-react'
import { useContacts } from '../contacts/useContacts'
import { directionOf, fetchRateOption, money, type RateOption } from '../rates/ratesApi'
import BookingPartiesServices from './BookingPartiesServices'
import BookingRouteCargo from './BookingRouteCargo'
import { EMPTY_DRAFT, missingFields, submitBooking, type BookingDraft } from './bookingModel'
import '../rates/rates.css'
import '../contacts/contacts.css'

export default function BookingRequestPage() {
  const navigate = useNavigate()
  const contacts = useContacts()
  const [f, setF] = useState<BookingDraft>(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<{ ref: string; priced: boolean } | null>(null)
  const set = <K extends keyof BookingDraft>(k: K, v: BookingDraft[K]) => setF((s) => ({ ...s, [k]: v }))
  const [params] = useSearchParams()
  const [rate, setRate] = useState<RateOption | null>(null)

  // Booking from a rate search: prefill the lane and hold the rate ref (priced again on the server).
  useEffect(() => {
    const ref = params.get('rate')
    if (!ref) return
    void fetchRateOption(ref).then((o) => {
      if (!o || !o.origin || !o.destination) return
      setRate(o)
      setF((s) => ({
        ...s,
        rate_ref: o.ref,
        mode: o.product === 'AIR' ? 'air' : 'sea',
        load_type: o.product === 'AIR' ? '' : o.product,
        direction: directionOf(o.origin!, o.destination!),
        origin: o.origin!, destination: o.destination!,
        container_type: o.container_type ?? s.container_type,
        container_count: params.get('boxes') ?? s.container_count,
        weight_kg: params.get('kg') ?? s.weight_kg,
        cbm: params.get('cbm') ?? s.cbm,
      }))
    })
  }, [params])

  const priced = !!(rate && rate.sell != null)
  const dropRate = () => { setRate(null); setF((s) => ({ ...s, rate_ref: undefined })) }
  const setMode = (m: 'sea' | 'air') => { setRate(null); setF((s) => ({ ...s, rate_ref: undefined, mode: m, load_type: m === 'sea' ? (s.load_type || 'FCL') : '', origin: '', destination: '' })) }

  async function submit() {
    const missing = missingFields(f)
    if (missing.length) { setErr(`Please add ${missing.join(', ')}.`); return }
    setBusy(true)
    setErr('')
    try {
      const r = await submitBooking(f)
      setDone({ ref: r.booking_ref, priced })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not submit booking')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="pv3-page">
        <div className="pv3-card pv3-done pv3-rise">
          <CheckCircle2 size={40} className="pv3-done__ico" />
          <h1>Booking request sent</h1>
          <p>Your reference is <b className="pv3-mono">{done.ref}</b>. Quote it in any message to us.</p>
          <ol className="pv3-done__steps">
            {!done.priced && <li><b>We price it.</b> A quote lands in Rates, My quotes for you to approve.</li>}
            <li><b>UB Freight confirms</b> space{done.priced ? ' at the agreed price' : ' once you approve the quote'}, usually within one business day.</li>
            <li><b>Your shipment appears</b> with live tracking once we create the job.</li>
          </ol>
          <div className="pv3-done__actions">
            <Link to="/portal/bookings" className="pv3-btn pv3-btn--primary">View my bookings</Link>
            <button type="button" className="pv3-btn pv3-btn--ghost" onClick={() => { setF(EMPTY_DRAFT); setRate(null); setDone(null) }}>Book another</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pv3-page pv3-page--narrow">
      <button type="button" className="pv3-textbtn pv3-back" onClick={() => navigate('/portal/bookings')}><ArrowLeft size={14} /> Bookings</button>
      <div className="pv3-head pv3-rise">
        <div>
          <h1>Request a booking</h1>
          <p>Tell us what you're moving and who is involved. We confirm space and price before anything is final.</p>
        </div>
      </div>

      {priced ? (
        <div className="pv3-ratebanner pv3-rise">
          <BadgeCheck size={18} color="#15803D" />
          <span>Booking at <b>{money(rate!.sell, rate!.currency)}</b> {rate!.unit} with {rate!.carrier ?? 'the carrier'}
            {rate!.valid_to ? `, valid to ${new Date(`${rate!.valid_to}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}` : ''}.
            {' '}Local charges and duties are confirmed with your booking.</span>
          <button type="button" className="pv3-textbtn" onClick={dropRate}>Book without this rate</button>
        </div>
      ) : (
        <div className="pv3-notice pv3-notice--amber pv3-rise" role="note">
          <Info size={17} />
          <span><b>No agreed price yet.</b> Sending this booking also sends a quote request to our team. You approve the price in Rates, My quotes before we confirm.
            {' '}Want a price first? <Link to="/portal/rates?tab=search" className="pv3-link">Search rates</Link>.</span>
        </div>
      )}

      <BookingRouteCargo f={f} set={set} setMode={setMode} laneLocked={false} />
      <BookingPartiesServices f={f} set={set} contacts={contacts} />

      <div className="pv3-form__submit">
        {err && <span className="pv3-form__err" role="alert">{err}</span>}
        <button type="button" className="pv3-btn pv3-btn--primary pv3-btn--lg" disabled={busy} onClick={() => void submit()}>
          {busy ? <Loader2 size={16} className="pv3-spin" /> : null} {priced ? 'Send booking request' : 'Send booking and quote request'}
        </button>
      </div>
    </div>
  )
}
