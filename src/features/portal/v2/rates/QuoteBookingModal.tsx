import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Loader2, Ship, Plane, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useContacts } from '../contacts/useContacts'
import BookingPartiesServices from '../bookings/BookingPartiesServices'
import BookingRouteCargo from '../bookings/BookingRouteCargo'
import { EMPTY_DRAFT, missingFields, submitBooking, type BookingDraft } from '../bookings/bookingModel'
import { shortCode } from '../homeModel'
import { directionOf, money } from './ratesApi'
import type { QuoteOffer } from './quotesApi'
import '../contacts/contacts.css'

type Props = { o: QuoteOffer; closesOthers: boolean; onClose: () => void; onBooked: (ref: string) => void }

/** Quote container label ("40HC reefer") to the booking container codes. */
function containerCode(label: string | null): string {
  if (!label) return '40HQ'
  const [size, kind] = label.split(' ')
  const s = size.startsWith('20') ? '20' : '40'
  if (kind === 'reefer') return `${s}RF`
  if (kind === 'opentop') return `${s}OT`
  if (kind === 'flatrack') return `${s}FR`
  return size.endsWith('HC') ? '40HQ' : `${s}GP`
}

function draftFrom(o: QuoteOffer): BookingDraft {
  const air = o.shipment_mode === 'air'
  const lt = air ? '' : (o.shipment_type ?? '').toUpperCase() === 'LCL' ? 'LCL' : 'FCL'
  const n = (v: number | null) => (v == null ? '' : String(v))
  return {
    ...EMPTY_DRAFT,
    quote_response_id: o.id,
    direction: o.direction ?? directionOf(o.from_port_code ?? '', o.to_port_code ?? ''),
    mode: air ? 'air' : 'sea', load_type: lt,
    origin: o.from_port_code ?? '', destination: o.to_port_code ?? '',
    incoterm: o.incoterms ?? '', cargo_ready_date: o.cargo_ready_date ?? '',
    goods_description: o.goods ?? '', weight_kg: n(o.weight_kg), cbm: n(o.cbm), pieces: n(o.pieces),
    container_type: containerCode(o.container_type), container_count: n(o.container_count) || '1',
    is_dg: !!o.is_hazardous, is_temp_controlled: !!o.need_refrigeration, customer_ref: o.customer_po ?? '',
  }
}

/** Approving a quote books it: the customer confirms cargo, parties and terms in one step. */
export default function QuoteBookingModal({ o, closesOthers, onClose, onBooked }: Props) {
  const contacts = useContacts()
  const [f, setF] = useState<BookingDraft>(() => draftFrom(o))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const set = <K extends keyof BookingDraft>(k: K, v: BookingDraft[K]) => setF((s) => ({ ...s, [k]: v }))
  const approving = o.portal_status === 'pending'
  const cur = o.currency ?? 'NZD'

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [busy, onClose])

  async function submit() {
    const missing = missingFields(f, true)
    if (missing.length) { setErr(`Please add ${missing.join(', ')}.`); return }
    setBusy(true); setErr('')
    try { const r = await submitBooking(f); setDone(r.booking_ref) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not book'); setBusy(false) }
  }

  return createPortal(
    <div className="pv3-modal" role="dialog" aria-modal="true" aria-label="Book this quote">
      <button type="button" className="pv3-modal__scrim" aria-label="Close" onClick={() => { if (!busy) (done ? onBooked(done) : onClose()) }} />
      <div className="pv3-modal__panel pv3-modal__panel--wide">
        {done ? (
          <div className="pv3-done" style={{ margin: 0, maxWidth: 'none' }}>
            <CheckCircle2 size={40} className="pv3-done__ico" />
            <h1>{approving ? 'Approved and booked' : 'Booked'}</h1>
            <p>Booking <b className="pv3-mono">{done}</b> is linked to quote {o.quote_no}. We confirm space and send updates as it moves.</p>
            <div className="pv3-done__actions">
              <Link to="/portal/bookings" className="pv3-btn pv3-btn--primary">View my bookings</Link>
              <button type="button" className="pv3-btn pv3-btn--ghost" onClick={() => onBooked(done)}>Back to quotes</button>
            </div>
          </div>
        ) : (
          <>
            <header className="pv3-modal__head">
              <div>
                <h2>{approving ? 'Approve and book' : 'Book this quote'}</h2>
                <p>Add the shipment details so we can book space. {closesOthers ? 'Your other options on this quote close.' : ''}</p>
              </div>
              <button type="button" className="pv3-iconbtn" onClick={onClose} aria-label="Close" disabled={busy}><X size={16} /></button>
            </header>
            <div className="pv3-modal__body" style={{ background: 'var(--bg)' }}>
              <div className="pv3-notice pv3-notice--green">
                {o.shipment_mode === 'air' ? <Plane size={17} /> : <Ship size={17} />}
                <span><b>{o.quote_no}{o.response_no ? ` · ${o.response_no}` : ''}</b>: {shortCode(o.from_port_code)} to {shortCode(o.to_port_code)}
                  {o.carrier ? ` with ${o.carrier}` : ''}, <b>{money(o.total_sell, cur)}</b>{o.valid_till ? `, valid to ${o.valid_till}` : ''}.</span>
              </div>
              <BookingRouteCargo f={f} set={set} setMode={() => {}} laneLocked />
              <BookingPartiesServices f={f} set={set} contacts={contacts} />
              {approving && (
                <div className="pv3-field"><label htmlFor="qb-note">Note to our team (optional)</label>
                  <textarea id="qb-note" rows={2} value={f.approve_note ?? ''} onChange={(e) => set('approve_note', e.target.value)} />
                </div>
              )}
            </div>
            <footer className="pv3-modal__foot">
              {err && <span className="pv3-form__err" role="alert">{err}</span>}
              <button type="button" className="pv3-textbtn" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className="pv3-btn pv3-btn--ok" disabled={busy} onClick={() => void submit()}>
                {busy && <Loader2 size={14} className="pv3-spin" />} {approving ? 'Approve and book' : 'Send booking'}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>,
    // Inside the portal shell so its theme variables and fonts apply.
    document.querySelector('.pv2-root') ?? document.body,
  )
}
