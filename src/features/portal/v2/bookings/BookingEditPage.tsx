import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileText, Info, Loader2 } from 'lucide-react'
import { useContacts } from '../contacts/useContacts'
import { useMessageDock } from '../messages/MessagesDock'
import BookingPartiesServices from './BookingPartiesServices'
import BookingRouteCargo from './BookingRouteCargo'
import { EMPTY_DRAFT, draftFromBooking, fetchBookingForEdit, missingFields, saveBookingEdit, type BookingDraft } from './bookingModel'
import '../rates/rates.css'
import '../contacts/contacts.css'

/** Edit a booking request until UB Freight has created the shipment. */
export default function BookingEditPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const contacts = useContacts()
  const { openMessages } = useMessageDock()
  const [f, setF] = useState<BookingDraft>(EMPTY_DRAFT)
  const [meta, setMeta] = useState<{ ref: string; editable: boolean; fromQuote: boolean; quoteId: string | null } | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false)
  const set = <K extends keyof BookingDraft>(k: K, v: BookingDraft[K]) => setF((s) => ({ ...s, [k]: v }))

  useEffect(() => {
    fetchBookingForEdit(id)
      .then((b) => {
        if (!b) { setLoadErr('Booking not found.'); return }
        setF(draftFromBooking(b))
        setMeta({ ref: String(b.booking_ref ?? ''), editable: !!b.editable, fromQuote: !!b.quote_response_id, quoteId: (b.quote_id as string) ?? null })
      })
      .catch((e) => setLoadErr(e instanceof Error ? e.message : 'Could not load'))
  }, [id])

  const setMode = (m: 'sea' | 'air') => setF((s) => ({ ...s, mode: m, load_type: m === 'sea' ? (s.load_type || 'FCL') : '', origin: '', destination: '' }))

  async function save() {
    const missing = missingFields(f, !!meta?.fromQuote)
    if (missing.length) { setErr(`Please add ${missing.join(', ')}.`); return }
    setBusy(true); setErr('')
    try { await saveBookingEdit(id, f); setSaved(true) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not save') }
    finally { setBusy(false) }
  }

  const back = <button type="button" className="pv3-textbtn pv3-back" onClick={() => navigate(`/portal/bookings?b=${id}`)}><ArrowLeft size={14} /> Bookings</button>

  if (loadErr) return <div className="pv3-page pv3-page--narrow">{back}<div className="pv3-error">{loadErr}</div></div>
  if (!meta) return <div className="pv3-page pv3-page--narrow">{back}<div className="pv3-card pv3-form"><span className="pv3-skel" /><span className="pv3-skel" /></div></div>

  if (saved) {
    return (
      <div className="pv3-page">
        <div className="pv3-card pv3-done pv3-rise">
          <CheckCircle2 size={40} className="pv3-done__ico" />
          <h1>Booking updated</h1>
          <p>Our team sees your changes on <b className="pv3-mono">{meta.ref}</b> straight away.</p>
          <div className="pv3-done__actions">
            <Link to={`/portal/bookings?b=${id}`} className="pv3-btn pv3-btn--primary">Back to bookings</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pv3-page pv3-page--narrow">
      {back}
      <div className="pv3-head pv3-rise">
        <div>
          <h1>Edit booking <span className="pv3-mono">{meta.ref}</span></h1>
          <p>Change anything until we create the shipment. Our team sees updates immediately.</p>
        </div>
      </div>

      {!meta.editable ? (
        <div className="pv3-notice pv3-notice--amber" role="note">
          <Info size={17} /><span><b>This booking can no longer be edited.</b> It is already a shipment or was declined. <button type="button" className="pv3-link pv3-textbtn" onClick={() => openMessages({ subject: `Change booking ${meta.ref}` })}>Message us</button> to change anything.</span>
        </div>
      ) : (
        <>
          {meta.fromQuote && (
            <div className="pv3-notice pv3-notice--green" role="note">
              <FileText size={17} /><span>Booked from an approved quote, so the route is fixed. <Link to={`/portal/rates?tab=quotes&q=${meta.quoteId ?? ''}`} className="pv3-link">View the quote</Link>.</span>
            </div>
          )}
          <BookingRouteCargo f={f} set={set} setMode={setMode} laneLocked={meta.fromQuote} />
          <BookingPartiesServices f={f} set={set} contacts={contacts} autoServices={false} />
          <div className="pv3-form__submit">
            {err && <span className="pv3-form__err" role="alert">{err}</span>}
            <button type="button" className="pv3-textbtn" onClick={() => navigate(`/portal/bookings?b=${id}`)}>Cancel</button>
            <button type="button" className="pv3-btn pv3-btn--primary pv3-btn--lg" disabled={busy} onClick={() => void save()}>
              {busy && <Loader2 size={16} className="pv3-spin" />} Save changes
            </button>
          </div>
        </>
      )}
    </div>
  )
}
