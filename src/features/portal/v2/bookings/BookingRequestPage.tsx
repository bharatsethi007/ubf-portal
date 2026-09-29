import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, CheckCircle2, Loader2, Plane, Ship } from 'lucide-react'
import DateField from '../../../../components/DateField'
import { usePorts } from '../../../../hooks/usePorts'
import PortPicker from './PortPicker'
import { CONTAINER_TYPES, INCOTERMS, PACKING, requestBooking, type BookingRequest } from './bookingsApi'
import { directionOf, fetchRateOption, money, type RateOption } from '../rates/ratesApi'
import '../rates/rates.css'

const EMPTY: BookingRequest = {
  direction: 'import', mode: 'sea', load_type: 'FCL', origin: '', destination: '', incoterm: '', cargo_ready_date: '',
  goods_description: '', pieces: '', packing_type: '', weight_kg: '', cbm: '', container_type: '40HQ', container_count: '1',
  is_dg: false, un_number: '', dg_class: '', is_temp_controlled: false, temp_range: '',
  shipper: '', consignee: '', consignee_address: '', customer_ref: '', notes: '',
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="pv3-seg pv3-seg--form" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" className={value === o.v ? 'pv3-seg__on' : ''} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  )
}

export default function BookingRequestPage() {
  const navigate = useNavigate()
  const { ports } = usePorts()
  const [f, setF] = useState<BookingRequest>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const set = <K extends keyof BookingRequest>(k: K, v: BookingRequest[K]) => setF((s) => ({ ...s, [k]: v }))
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

  const dropRate = () => { setRate(null); setF((s) => ({ ...s, rate_ref: undefined })) }

  const setMode = (m: 'sea' | 'air') => { setRate(null); setF((s) => ({ ...s, rate_ref: undefined, mode: m, load_type: m === 'sea' ? (s.load_type || 'FCL') : '', origin: '', destination: '' })) }
  const fcl = f.mode === 'sea' && f.load_type === 'FCL'

  const missing = useMemo(() => {
    const m: string[] = []
    if (!f.origin) m.push('origin')
    if (!f.destination) m.push('destination')
    if (!f.goods_description.trim()) m.push('goods description')
    if (!fcl && !f.weight_kg) m.push('weight')
    return m
  }, [f, fcl])

  async function submit() {
    if (missing.length) { setErr(`Please add ${missing.join(', ')}.`); return }
    setBusy(true)
    setErr('')
    try {
      const r = await requestBooking(f)
      setDone(r.booking_ref)
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
          <p>Your reference is <b className="pv3-mono">{done}</b>. Quote it in any email or WhatsApp to us.</p>
          <ol className="pv3-done__steps">
            <li><b>UB Freight reviews</b> your request and confirms space and price, usually within one business day.</li>
            <li><b>We confirm</b> and you see it change to Confirmed here.</li>
            <li><b>Your shipment appears</b> with live tracking once we create the job.</li>
          </ol>
          <div className="pv3-done__actions">
            <Link to="/portal/bookings" className="pv3-btn pv3-btn--primary">View my bookings</Link>
            <button type="button" className="pv3-btn pv3-btn--ghost" onClick={() => { setF(EMPTY); setRate(null); setDone(null) }}>Book another</button>
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
          <p>Tell us what you're moving. We confirm space and price before anything is final.</p>
        </div>
      </div>

      {rate && rate.sell != null && (
        <div className="pv3-ratebanner pv3-rise">
          <BadgeCheck size={18} color="#15803D" />
          <span>Booking at <b>{money(rate.sell, rate.currency)}</b> {rate.unit} with {rate.carrier ?? 'the carrier'}
            {rate.valid_to ? `, valid to ${new Date(`${rate.valid_to}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}` : ''}.
            {' '}Local charges and duties are confirmed with your booking.</span>
          <button type="button" className="pv3-textbtn" onClick={dropRate}>Book without this rate</button>
        </div>
      )}

      <section className="pv3-card pv3-form pv3-rise" style={{ animationDelay: '.05s' }}>
        <h2>Route</h2>
        <div className="pv3-form__row">
          <div className="pv3-field"><label>Direction</label>
            <Seg label="Direction" value={f.direction} onChange={(v) => set('direction', v)} options={[{ v: 'import', label: 'Import to NZ' }, { v: 'export', label: 'Export from NZ' }]} />
          </div>
          <div className="pv3-field"><label>Mode</label>
            <Seg label="Mode" value={f.mode} onChange={setMode} options={[{ v: 'sea', label: <><Ship size={14} /> Sea</> }, { v: 'air', label: <><Plane size={14} /> Air</> }]} />
          </div>
          {f.mode === 'sea' && (
            <div className="pv3-field"><label>Load</label>
              <Seg label="Load" value={f.load_type as 'FCL' | 'LCL'} onChange={(v) => set('load_type', v)} options={[{ v: 'FCL', label: 'Full container' }, { v: 'LCL', label: 'Shared (LCL)' }]} />
            </div>
          )}
        </div>
        <div className="pv3-form__grid">
          <PortPicker id="bk-origin" label="From" value={f.origin} onChange={(v) => set('origin', v)} ports={ports} mode={f.mode} />
          <PortPicker id="bk-dest" label="To" value={f.destination} onChange={(v) => set('destination', v)} ports={ports} mode={f.mode} />
          <div className="pv3-field"><label>Cargo ready</label><DateField value={f.cargo_ready_date || null} onChange={(v) => set('cargo_ready_date', v)} width="100%" placeholder="Select date" /></div>
          <div className="pv3-field"><label htmlFor="bk-inco">Incoterm</label>
            <select id="bk-inco" value={f.incoterm} onChange={(e) => set('incoterm', e.target.value)}>
              <option value="">Not sure</option>
              {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="pv3-card pv3-form pv3-rise" style={{ animationDelay: '.1s' }}>
        <h2>Cargo</h2>
        <div className="pv3-field pv3-field--wide"><label htmlFor="bk-goods">What are you shipping?</label>
          <input id="bk-goods" value={f.goods_description} onChange={(e) => set('goods_description', e.target.value)} placeholder="e.g. Porcelain floor tiles" />
        </div>
        {fcl ? (
          <div className="pv3-form__grid">
            <div className="pv3-field"><label htmlFor="bk-ct">Container</label>
              <select id="bk-ct" value={f.container_type} onChange={(e) => set('container_type', e.target.value)}>
                {CONTAINER_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="pv3-field"><label htmlFor="bk-cc">How many</label>
              <input id="bk-cc" type="number" min={1} value={f.container_count} onChange={(e) => set('container_count', e.target.value)} />
            </div>
            <div className="pv3-field"><label htmlFor="bk-kg">Total weight (kg)</label>
              <input id="bk-kg" type="number" min={0} value={f.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} placeholder="Optional" />
            </div>
          </div>
        ) : (
          <div className="pv3-form__grid">
            <div className="pv3-field"><label htmlFor="bk-pcs">Pieces</label>
              <input id="bk-pcs" type="number" min={1} value={f.pieces} onChange={(e) => set('pieces', e.target.value)} />
            </div>
            <div className="pv3-field"><label htmlFor="bk-pk">Packed as</label>
              <select id="bk-pk" value={f.packing_type} onChange={(e) => set('packing_type', e.target.value)}>
                <option value="">Choose</option>
                {PACKING.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="pv3-field"><label htmlFor="bk-kg2">Total weight (kg)</label>
              <input id="bk-kg2" type="number" min={0} value={f.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} />
            </div>
            <div className="pv3-field"><label htmlFor="bk-cbm">Volume (m³)</label>
              <input id="bk-cbm" type="number" min={0} step="0.01" value={f.cbm} onChange={(e) => set('cbm', e.target.value)} />
            </div>
          </div>
        )}
        <div className="pv3-form__checks">
          <label className="pv3-check"><input type="checkbox" checked={f.is_dg} onChange={(e) => set('is_dg', e.target.checked)} /> Dangerous goods</label>
          <label className="pv3-check"><input type="checkbox" checked={f.is_temp_controlled} onChange={(e) => set('is_temp_controlled', e.target.checked)} /> Temperature controlled</label>
        </div>
        {(f.is_dg || f.is_temp_controlled) && (
          <div className="pv3-form__grid">
            {f.is_dg && <div className="pv3-field"><label htmlFor="bk-un">UN number</label><input id="bk-un" value={f.un_number} onChange={(e) => set('un_number', e.target.value)} placeholder="UN1263" /></div>}
            {f.is_dg && <div className="pv3-field"><label htmlFor="bk-cls">Class</label><input id="bk-cls" value={f.dg_class} onChange={(e) => set('dg_class', e.target.value)} placeholder="3" /></div>}
            {f.is_temp_controlled && <div className="pv3-field"><label htmlFor="bk-tmp">Temperature</label><input id="bk-tmp" value={f.temp_range} onChange={(e) => set('temp_range', e.target.value)} placeholder="e.g. 2 to 8 °C" /></div>}
          </div>
        )}
      </section>

      <section className="pv3-card pv3-form pv3-rise" style={{ animationDelay: '.15s' }}>
        <h2>Parties and references</h2>
        <div className="pv3-form__grid">
          <div className="pv3-field"><label htmlFor="bk-shp">{f.direction === 'import' ? 'Supplier / shipper' : 'Shipper'}</label>
            <input id="bk-shp" value={f.shipper} onChange={(e) => set('shipper', e.target.value)} placeholder={f.direction === 'import' ? 'Who is sending it' : 'Leave blank if you'} />
          </div>
          <div className="pv3-field"><label htmlFor="bk-cne">Consignee</label>
            <input id="bk-cne" value={f.consignee} onChange={(e) => set('consignee', e.target.value)} placeholder={f.direction === 'import' ? 'Leave blank if you' : 'Who receives it'} />
          </div>
          <div className="pv3-field"><label htmlFor="bk-po">Your PO / reference</label>
            <input id="bk-po" value={f.customer_ref} onChange={(e) => set('customer_ref', e.target.value)} placeholder="Shows on your shipment" />
          </div>
        </div>
        <div className="pv3-field pv3-field--wide"><label htmlFor="bk-notes">Anything else we should know?</label>
          <textarea id="bk-notes" rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Delivery address, deadlines, special handling" />
        </div>
      </section>

      <div className="pv3-form__submit">
        {err && <span className="pv3-form__err" role="alert">{err}</span>}
        <button type="button" className="pv3-btn pv3-btn--primary pv3-btn--lg" disabled={busy} onClick={() => void submit()}>
          {busy ? <Loader2 size={16} className="pv3-spin" /> : null} Send booking request
        </button>
      </div>
    </div>
  )
}
