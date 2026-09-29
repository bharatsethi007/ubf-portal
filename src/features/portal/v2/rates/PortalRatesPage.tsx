import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, MessageSquareQuote, Plane, Search, Ship } from 'lucide-react'
import { usePorts } from '../../../../hooks/usePorts'
import PortPicker from '../bookings/PortPicker'
import { CONTAINER_TYPES } from '../bookings/bookingsApi'
import { placeName } from '../homeModel'
import QuoteRequestPanel from './QuoteRequestPanel'
import RateCard from './RateCard'
import { searchRates, type RateOption, type RateQuery } from './ratesApi'
import './rates.css'

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="pv3-seg pv3-seg--form" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" className={value === o.v ? 'pv3-seg__on' : ''} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  )
}

/** Customer rate search: sell prices from published rate cards, book in one click, or ask for a price. */
export default function PortalRatesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { ports } = usePorts()
  const [q, setQ] = useState<RateQuery>({
    mode: params.get('mode') === 'air' ? 'air' : 'sea',
    load: params.get('load') === 'LCL' ? 'LCL' : 'FCL',
    container: params.get('container') ?? '',
    origin: params.get('from') ?? '',
    destination: params.get('to') ?? '',
  })
  const [cargo, setCargo] = useState({ kg: '', cbm: '', boxes: '1' })
  const [results, setResults] = useState<RateOption[] | null>(null)
  const [searched, setSearched] = useState<RateQuery | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [asking, setAsking] = useState(false)
  const set = <K extends keyof RateQuery>(k: K, v: RateQuery[K]) => setQ((s) => ({ ...s, [k]: v }))

  async function run() {
    if (!q.origin || !q.destination) { setErr('Pick where it ships from and to.'); return }
    setBusy(true)
    setErr('')
    setAsking(false)
    try {
      const r = await searchRates(q)
      setResults(r)
      setSearched(q)
      setParams({ mode: q.mode, load: q.load, from: q.origin, to: q.destination, ...(q.container ? { container: q.container } : {}) }, { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setBusy(false)
    }
  }

  const input = useMemo(() => ({ kg: Number(cargo.kg) || 0, cbm: Number(cargo.cbm) || 0, boxes: Number(cargo.boxes) || 1 }), [cargo])
  const priced = (results ?? []).filter((o) => o.sell != null)
  const cheapestRef = priced.length > 1 ? priced.reduce((a, b) => (b.sell! < a.sell! ? b : a)).ref : null
  const withTransit = (results ?? []).filter((o) => o.transit_days)
  const fastestRef = withTransit.length > 1 ? withTransit.reduce((a, b) => (b.transit_days! < a.transit_days! ? b : a)).ref : null

  function book(o: RateOption) {
    const p = new URLSearchParams({ rate: o.ref })
    if (cargo.kg) p.set('kg', cargo.kg)
    if (cargo.cbm) p.set('cbm', cargo.cbm)
    if (o.product === 'FCL') p.set('boxes', cargo.boxes || '1')
    navigate(`/portal/bookings/new?${p.toString()}`)
  }

  return (
    <div className="pv3-page">
      <div className="pv3-head pv3-rise">
        <div>
          <h1>Rates</h1>
          <p>Live prices on our published lanes. Book at the price you see, or ask us for anything else.</p>
        </div>
      </div>

      <section className="pv3-card pv3-rsearch pv3-rise" style={{ animationDelay: '.04s' }}>
        <div className="pv3-rsearch__row">
          <Seg label="Mode" value={q.mode} onChange={(v) => setQ((s) => ({ ...s, mode: v, origin: '', destination: '' }))}
            options={[{ v: 'sea', label: <><Ship size={14} /> Sea</> }, { v: 'air', label: <><Plane size={14} /> Air</> }]} />
          {q.mode === 'sea' && (
            <Seg label="Load" value={q.load} onChange={(v) => set('load', v)} options={[{ v: 'FCL', label: 'Full container' }, { v: 'LCL', label: 'Shared (LCL)' }]} />
          )}
        </div>
        <div className="pv3-rsearch__grid">
          <PortPicker id="r-from" label="From" value={q.origin} onChange={(v) => set('origin', v)} ports={ports} mode={q.mode} />
          <PortPicker id="r-to" label="To" value={q.destination} onChange={(v) => set('destination', v)} ports={ports} mode={q.mode} />
          {q.mode === 'sea' && q.load === 'FCL' ? (
            <>
              <div className="pv3-field"><label htmlFor="r-ct">Container</label>
                <select id="r-ct" value={q.container} onChange={(e) => set('container', e.target.value)}>
                  <option value="">Any size</option>
                  {CONTAINER_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="pv3-field"><label htmlFor="r-n">How many</label>
                <input id="r-n" type="number" min={1} value={cargo.boxes} onChange={(e) => setCargo((c) => ({ ...c, boxes: e.target.value }))} />
              </div>
            </>
          ) : (
            <>
              <div className="pv3-field"><label htmlFor="r-kg">Weight (kg)</label>
                <input id="r-kg" type="number" min={0} value={cargo.kg} onChange={(e) => setCargo((c) => ({ ...c, kg: e.target.value }))} placeholder="For an estimate" />
              </div>
              <div className="pv3-field"><label htmlFor="r-cbm">Volume (m³)</label>
                <input id="r-cbm" type="number" min={0} step="0.01" value={cargo.cbm} onChange={(e) => setCargo((c) => ({ ...c, cbm: e.target.value }))} placeholder="Optional" />
              </div>
            </>
          )}
          <button type="button" className="pv3-btn pv3-btn--primary pv3-rsearch__go" disabled={busy} onClick={() => void run()}>
            {busy ? <Loader2 size={16} className="pv3-spin" /> : <Search size={16} />} Search rates
          </button>
        </div>
        {err && <div className="pv3-form__err" role="alert">{err}</div>}
      </section>

      {asking && searched && <QuoteRequestPanel query={searched} cargo={cargo} onClose={() => setAsking(false)} />}

      {results && searched && (
        <section className="pv3-rresults" aria-live="polite">
          <div className="pv3-rresults__head">
            <h2>{placeName(searched.origin, ports)} → {placeName(searched.destination, ports)}</h2>
            <span className="pv3-muted">
              {results.length ? `${results.length} option${results.length === 1 ? '' : 's'} · prices exclude duties, taxes and local delivery` : 'No published rate on this lane yet'}
            </span>
          </div>
          {results.map((o, i) => (
            <RateCard key={o.ref} o={o} input={input} delay={0.03 * i} cheapest={o.ref === cheapestRef} fastest={o.ref === fastestRef}
              onBook={book} onQuote={() => setAsking(true)} />
          ))}
          {results.length === 0 && !asking && (
            <div className="pv3-card pv3-rempty pv3-rise">
              <MessageSquareQuote size={28} />
              <div>
                <b>We can still move it.</b>
                <p>There's no published price for this lane, but most lanes are a quick quote away.</p>
              </div>
              <button type="button" className="pv3-btn pv3-btn--primary" onClick={() => setAsking(true)}>Request a quote</button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
