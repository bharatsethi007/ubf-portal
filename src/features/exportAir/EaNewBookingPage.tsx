import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import '@/features/bookingsWorkspace/bookingsTheme.css'
import { supabase } from '@/supabase'
import DateField from '@/components/DateField'
import type { CustomerPickerValue } from '@/components/bookings/CustomerPicker'
import type { AirConsol } from './eaTypes'
import { btn, btnPrimary, Card, eaHref, lbl } from './eaUi'
import EaNewParties from './EaNewParties'
import EaCargoLines, { emptyLine, lineTotals } from './EaCargoLines'
import { cleanForTw } from './EaCargoCard'
import EaMailBubble from './mail/EaMailBubble'
import { createEaBooking, loadAccounts, newEaIssues, type NewEa } from './eaCreate'

const DESTS = ['NAN', 'APW', 'TBU', 'VLI', 'HIR', 'PPG', 'RAR']
const FIJI = new Set(['NAN', 'SUV'])
const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CPT', 'CIP', 'DAP', 'DDP']
const inp = 'h-[30px] w-full rounded-[7px] border border-[#E3E6EB] bg-white px-2 text-[12.5px] text-[#14161A] outline-none focus:border-[#0A2472]'
const addrOf = (c: CustomerPickerValue | null) => [c?.address1, c?.address2, c?.address3, c?.city].filter(Boolean).join(', ')

/** New Export Air booking. One screen, TW account codes from the start, optional pickup + consol in the same save. */
export default function EaNewBookingPage() {
  const navigate = useNavigate()
  const [defaults, setDefaults] = useState<Record<string, CustomerPickerValue>>({})
  const [consols, setConsols] = useState<AirConsol[]>([])
  const [bookPickup, setBookPickup] = useState(true)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState<NewEa>({
    shipper: null, consignee: null, billTo: null, destination: 'NAN', incoterm: 'EXW', readyDate: null, customerRef: '',
    lines: [emptyLine()], goods: '', value: '', currency: 'NZD', isDg: false, unNumber: '', mode: 'pickup',
    pickupAddress: '', notes: '', consolId: '',
  })
  const set = <K extends keyof NewEa>(k: K, v: NewEa[K]) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    void loadAccounts(['VARIFJ', 'UBNAN']).then((d) => {
      setDefaults(d)
      setF((p) => (p.billTo || !d.UBNAN ? p : { ...p, billTo: d.UBNAN }))
    })
  }, [])

  const dest = f.destination.trim().toUpperCase()
  useEffect(() => {
    if (dest.length !== 3) return
    void supabase.from('v_air_consols').select('*').eq('destination', dest)
      .in('status', ['planned', 'confirmed']).gte('flight_date', new Date().toISOString().slice(0, 10)).order('flight_date')
      .then(({ data }) => setConsols((data ?? []) as AirConsol[]))
  }, [dest])

  function onParty(slot: 'shipper' | 'consignee' | 'billTo', v: CustomerPickerValue | null) {
    setF((p) => {
      const next = { ...p, [slot]: v }
      if (slot === 'shipper' && v && !p.pickupAddress && v.account_id !== 'VARIFJ') next.pickupAddress = addrOf(v)
      if (slot === 'shipper' && v?.account_id === 'VARIFJ') next.mode = 'dropoff'
      return next
    })
  }

  function onDest(d: string) {
    setF((p) => ({ ...p, destination: d, consolId: '', billTo: FIJI.has(d.toUpperCase()) ? (p.billTo ?? defaults.UBNAN ?? null) : p.billTo }))
  }

  const issues = newEaIssues(f)
  const t = lineTotals(f.lines)
  const cleaned = cleanForTw(f.goods)

  async function save(draft: boolean) {
    if (!draft && issues.length) return toast.error(`Missing: ${issues.join(', ')}`)
    setBusy(true)
    try {
      const id = await createEaBooking(f, { draft, bookPickup })
      toast.success(draft ? 'Draft saved' : 'Booking created')
      navigate(eaHref(id))
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }

  const seg = (on: boolean) => `w-auto rounded-[5px] border-0 px-2.5 py-1 text-[11.5px] ${on ? 'bg-white font-medium text-[#14161A] shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'bg-transparent text-[#5B616E]'}`

  return (
    <div className="bk-root mx-auto w-full max-w-[1440px] bg-white text-[12.5px] text-[#14161A]">
      <div className="text-[12px] text-[#6B7280]">
        <Link to="/bookings/export-air" className="text-[#6B7280] hover:underline">Export air</Link><span className="mx-1">/</span>New booking
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 text-[18px] font-semibold tracking-[-0.015em]">New export air booking</h1>
        <span className="text-[12px] text-[#6B7280]">Ref AKL-EA-#### is issued on save · HAWB comes from TradeWindow</span>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
          <Card title="Parties" aside={<span className="text-[11px] text-[#5B616E]">TradeWindow accounts</span>}>
            <EaNewParties shipper={f.shipper} consignee={f.consignee} billTo={f.billTo} defaults={defaults} onChange={onParty} />
          </Card>

          <Card title="Route">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 px-4 py-3.5 md:grid-cols-4">
              <Field label="Destination" span="col-span-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {DESTS.map((d) => (
                    <button key={d} type="button" onClick={() => onDest(d)} aria-pressed={dest === d}
                      className={`bk-mono h-[28px] w-auto rounded-[6px] border px-2 text-[11.5px] ${dest === d ? 'border-[#0A2472] bg-[#0A2472] text-white' : 'border-[#E3E6EB] bg-white text-[#14161A] hover:bg-[#F6F7F9]'}`}>{d}</button>
                  ))}
                  <input aria-label="Other destination" value={DESTS.includes(dest) ? '' : f.destination} onChange={(e) => onDest(e.target.value.toUpperCase().slice(0, 3))} placeholder="Other" className={`${inp} bk-mono w-[64px] uppercase`} />
                </div>
              </Field>
              <Field label="Incoterm">
                <select value={f.incoterm} onChange={(e) => set('incoterm', e.target.value)} className={inp}>{INCOTERMS.map((i) => <option key={i}>{i}</option>)}</select>
              </Field>
              <Field label="Cargo ready"><DateField value={f.readyDate} onChange={(v) => set('readyDate', v)} width="100%" /></Field>
              <Field label="Customer ref / PO" span="col-span-2"><input value={f.customerRef} onChange={(e) => set('customerRef', e.target.value)} className={inp} /></Field>
            </div>
          </Card>

          <Card title="Cargo" aside={<span className="text-[11px] text-[#5B616E]">Booked figures. Warehouse actuals replace them at check-in.</span>}>
            <div className="flex flex-col gap-4 px-4 py-3.5">
              <EaCargoLines lines={f.lines} onChange={(l) => set('lines', l)} />
              <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 md:grid-cols-4">
                <Field label="Goods description" span="col-span-2 md:col-span-4" hint={cleaned && cleaned !== f.goods.trim() ? `TradeWindow gets: ${cleaned}` : undefined}>
                  <input value={f.goods} onChange={(e) => set('goods', e.target.value)} placeholder="e.g. Hinges, drawer runners, fittings" className={inp} />
                </Field>
                <Field label="Value"><input inputMode="decimal" value={f.value} onChange={(e) => set('value', e.target.value.replace(/[^\d.]/g, ''))} className={`${inp} bk-mono`} /></Field>
                <Field label="Currency"><select value={f.currency} onChange={(e) => set('currency', e.target.value)} className={inp}>{['NZD', 'AUD', 'USD', 'FJD'].map((c) => <option key={c}>{c}</option>)}</select></Field>
                <Field label="Dangerous goods">
                  <label className="flex h-[30px] items-center gap-2"><input type="checkbox" checked={f.isDg} onChange={(e) => set('isDg', e.target.checked)} className="accent-[#0A2472]" /> DG cargo</label>
                </Field>
                {f.isDg ? <Field label="UN number"><input value={f.unNumber} onChange={(e) => set('unNumber', e.target.value)} placeholder="UN1263" className={`${inp} bk-mono`} /></Field> : null}
              </div>
            </div>
          </Card>

          <Card title="Collection" aside={
            <div role="radiogroup" aria-label="Collection" className="flex gap-0.5 rounded-[7px] bg-[#F2F4F7] p-0.5">
              <button type="button" role="radio" aria-checked={f.mode === 'pickup'} className={seg(f.mode === 'pickup')} onClick={() => set('mode', 'pickup')}>UBF pickup</button>
              <button type="button" role="radio" aria-checked={f.mode === 'dropoff'} className={seg(f.mode === 'dropoff')} onClick={() => set('mode', 'dropoff')}>Supplier drop-off</button>
            </div>}>
            <div className="flex flex-wrap items-end gap-3 px-4 py-3.5">
              {f.mode === 'pickup' ? (
                <>
                  <Field label="Pickup address" span="min-w-[320px] flex-1"><input value={f.pickupAddress} onChange={(e) => set('pickupAddress', e.target.value)} className={inp} /></Field>
                  <label className="flex h-[30px] items-center gap-2 text-[12px]"><input type="checkbox" checked={bookPickup} onChange={(e) => setBookPickup(e.target.checked)} className="accent-[#0A2472]" /> Book pickup in TMS on save</label>
                </>
              ) : <span className="text-[12.5px] text-[#5B616E]">Supplier delivers to UBF Mangere, 173 Montgomerie Rd. No TMS job.</span>}
            </div>
          </Card>

          <Card title="Notes">
            <div className="px-4 py-3.5"><textarea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Handling, contacts, anything ops should know" className={`${inp} h-auto py-1.5`} /></div>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 lg:sticky lg:top-4">
          <Card title="Summary">
            <div className="flex flex-col gap-3 px-4 py-3.5">
              <div className="text-[12.5px]"><span className="text-[#5B616E]">AKL → </span><b className="bk-mono font-medium">{dest || '—'}</b> · {t.pcs || 0} pcs · {t.kg || 0} kg · chg <b className="bk-mono font-medium">{t.chg || 0}</b></div>
              <Field label="Consol">
                <select value={f.consolId} onChange={(e) => set('consolId', e.target.value)} className={inp}>
                  <option value="">Leave unallocated</option>
                  {consols.map((c) => <option key={c.id} value={c.id}>{c.flight_no} · {format(parseISO(c.flight_date), 'EEE d MMM')} · {c.houses} houses</option>)}
                </select>
              </Field>
              <div>
                <div className={`${lbl} mb-1.5`}>Needed to create</div>
                {issues.length === 0
                  ? <div className="text-[12px] text-[#067647]">All set</div>
                  : <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">{issues.map((i) => <li key={i} className="rounded px-1.5 text-[11px] leading-[18px] text-[#B54708]" style={{ background: '#FFFAEB' }}>{i}</li>)}</ul>}
              </div>
            </div>
            <footer className="flex justify-end gap-2 border-t border-[#F1F2F5] px-4 py-3">
              <button type="button" className={btn} disabled={busy} onClick={() => void save(true)}>Save draft</button>
              <button type="button" className={btnPrimary} disabled={busy || issues.length > 0} onClick={() => void save(false)}>{busy ? 'Saving…' : 'Create booking'}</button>
            </footer>
          </Card>
        </aside>
      </div>
      <EaMailBubble />
    </div>
  )
}

function Field({ label, span = '', hint, children }: { label: string; span?: string; hint?: string; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${span}`}>
      <span className={lbl}>{label}</span>
      {children}
      {hint ? <span className="text-[10.5px] text-[#98A2B3]">{hint}</span> : null}
    </div>
  )
}
