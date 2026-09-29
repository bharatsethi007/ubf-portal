import { useState } from 'react'
import { CheckCircle2, Loader2, X } from 'lucide-react'
import DateField from '../../../../components/DateField'
import { directionOf, requestQuote, type QuoteRequest, type RateQuery } from './ratesApi'

type Props = {
  query: RateQuery
  cargo: { kg: string; cbm: string; boxes: string }
  onClose: () => void
}

/** Lane without a published price: send the details to the team as a quote request. */
export default function QuoteRequestPanel({ query, cargo, onClose }: Props) {
  const [f, setF] = useState<QuoteRequest>({
    mode: query.mode, load_type: query.mode === 'sea' ? query.load : '', direction: directionOf(query.origin, query.destination),
    origin: query.origin, destination: query.destination, container_type: query.load === 'FCL' ? query.container : '',
    container_count: cargo.boxes || '1', cargo_ready_date: '', goods_description: '', weight_kg: cargo.kg, cbm: cargo.cbm,
    is_dg: false, is_temp_controlled: false, customer_ref: '', notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const set = <K extends keyof QuoteRequest>(k: K, v: QuoteRequest[K]) => setF((s) => ({ ...s, [k]: v }))
  const fcl = f.mode === 'sea' && f.load_type === 'FCL'

  async function submit() {
    if (!f.goods_description.trim()) { setErr('Tell us what you are shipping.'); return }
    setBusy(true)
    setErr('')
    try {
      const r = await requestQuote(f)
      setDone(r.quote_no)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="pv3-card pv3-form pv3-quote pv3-rise" aria-label="Request a quote">
      <header className="pv3-quote__head">
        <h2>Get a price for {query.origin} → {query.destination}</h2>
        <button type="button" className="pv3-iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </header>
      {done ? (
        <div className="pv3-quote__done">
          <CheckCircle2 size={28} className="pv3-done__ico" />
          <div>
            <b>Quote request {done} sent.</b>
            <p>Our team prices it and replies by email, usually within one business day.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="pv3-form__grid">
            <div className="pv3-field pv3-field--wide"><label htmlFor="q-goods">What are you shipping?</label>
              <input id="q-goods" value={f.goods_description} onChange={(e) => set('goods_description', e.target.value)} placeholder="e.g. Porcelain floor tiles" />
            </div>
            {fcl ? (
              <div className="pv3-field"><label htmlFor="q-cc">{f.container_type || 'Containers'} needed</label>
                <input id="q-cc" type="number" min={1} value={f.container_count} onChange={(e) => set('container_count', e.target.value)} />
              </div>
            ) : (
              <>
                <div className="pv3-field"><label htmlFor="q-kg">Weight (kg)</label><input id="q-kg" type="number" min={0} value={f.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} /></div>
                <div className="pv3-field"><label htmlFor="q-cbm">Volume (m³)</label><input id="q-cbm" type="number" min={0} step="0.01" value={f.cbm} onChange={(e) => set('cbm', e.target.value)} /></div>
              </>
            )}
            <div className="pv3-field"><label>Cargo ready</label><DateField value={f.cargo_ready_date || null} onChange={(v) => set('cargo_ready_date', v)} width="100%" placeholder="Select date" /></div>
            <div className="pv3-field"><label htmlFor="q-po">Your reference</label><input id="q-po" value={f.customer_ref} onChange={(e) => set('customer_ref', e.target.value)} placeholder="Optional" /></div>
          </div>
          <div className="pv3-form__checks">
            <label className="pv3-check"><input type="checkbox" checked={f.is_dg} onChange={(e) => set('is_dg', e.target.checked)} /> Dangerous goods</label>
            <label className="pv3-check"><input type="checkbox" checked={f.is_temp_controlled} onChange={(e) => set('is_temp_controlled', e.target.checked)} /> Temperature controlled</label>
          </div>
          <div className="pv3-field pv3-field--wide"><label htmlFor="q-notes">Anything else?</label>
            <textarea id="q-notes" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Pickup or delivery address, deadlines" />
          </div>
          <div className="pv3-form__submit">
            {err && <span className="pv3-form__err" role="alert">{err}</span>}
            <button type="button" className="pv3-btn pv3-btn--primary" disabled={busy} onClick={() => void submit()}>
              {busy && <Loader2 size={14} className="pv3-spin" />} Send quote request
            </button>
          </div>
        </>
      )}
    </section>
  )
}
