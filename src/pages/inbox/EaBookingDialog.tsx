// Export Air booking review popup: prefilled from the email (free), optional AI fill, staff check and create.
// Creates a confirmed booking and, when "UBF collects" is chosen, the pickup job in TMS.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import EaCargoLines from './EaCargoLines'
import { commitEa, prefillEa, type BillTo, type EaForm, type EaParty } from './eaBookingApi'
import { searchAccounts, type InboxDetail } from './inboxApi'
import { isInlineJunk } from './EmailParts'

const INCOTERMS = ['', 'EXW', 'FCA', 'FOB', 'CPT', 'CIP', 'DAP', 'DDP']

function Party({ title, v, onChange, full = true }: { title: string; v: EaParty; onChange: (p: EaParty) => void; full?: boolean }) {
  const f = (k: keyof EaParty, label: string, wide = false) => (
    <input className="ibx-in" style={wide ? { gridColumn: '1 / -1' } : undefined} placeholder={label} aria-label={`${title} ${label}`}
      value={v[k] ?? ''} onChange={(e) => onChange({ ...v, [k]: e.target.value })} />
  )
  return (
    <fieldset className="ibx-fs">
      <legend>{title}</legend>
      <div className="ibx-grid2">
        {f('name', 'Company', true)}{full ? f('address', 'Street address', true) : null}{f('city', 'City')}
        {full ? f('postcode', 'Postcode') : f('country', 'Country')}{f('contact', 'Contact')}{f('phone', 'Phone')}{f('email', 'Email', true)}
      </div>
    </fieldset>
  )
}

export default function EaBookingDialog({ detail, onChanged }: { detail: InboxDetail; onChanged: () => void }) {
  const nav = useNavigate()
  const convId = detail.conversation.id
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<EaForm | null>(null)
  const [bill, setBill] = useState<BillTo>(null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<{ account_id: string; name: string }[]>([])
  const [busy, setBusy] = useState<'load' | 'ai' | 'save' | null>(null)
  const atts = useMemo(() => detail.messages.flatMap((m) => (m.email?.attachments ?? []).filter((a) => !isInlineJunk(a))), [detail.messages])
  const [picked, setPicked] = useState<Set<number>>(new Set())

  async function load(ai: boolean) {
    setBusy(ai ? 'ai' : 'load')
    try {
      const r = await prefillEa(convId, ai)
      setForm(r.form); if (r.bill_to) setBill(r.bill_to)
      if (ai) toast.success('Filled from the email. Check the highlighted fields.')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not read the email') }
    finally { setBusy(null) }
  }

  useEffect(() => {
    const on = () => { setOpen(true); setForm(null); setBill(null); setQ(''); setPicked(new Set(atts.map((a) => a.id))); void load(false) }
    window.addEventListener('ibx:ea-booking', on)
    return () => window.removeEventListener('ibx:ea-booking', on)
  }) // re-binds each render so the handler sees this conversation
  useEffect(() => { setOpen(false) }, [convId])
  useEffect(() => {
    const t = setTimeout(() => { searchAccounts(q).then(setHits).catch(() => setHits([])) }, 250)
    return () => clearTimeout(t)
  }, [q])

  if (!open) return null
  const close = () => setOpen(false)
  const notes = form?._low_confidence ?? []
  const low = new Set(notes.map((x) => x.split(/[:.\s[]/)[0]))
  const set = (patch: Partial<EaForm>) => setForm((f) => (f ? { ...f, ...patch } : f))

  async function create() {
    if (!form) return
    setBusy('save')
    try {
      const r = await commitEa(convId, form, bill?.account_id ?? null, [...picked])
      toast.success(`${r.booking_ref} created${r.pickup_no ? `, pickup ${r.pickup_no} booked` : ''}${r.documents ? `, ${r.documents} docs saved` : ''}`,
        { action: { label: 'Open', onClick: () => nav(`/bookings/EA/${r.id}/edit`) } })
      if (r.pickup_error) toast.error(`Pickup not created: ${r.pickup_error}`)
      close(); onChanged()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not create booking') }
    finally { setBusy(null) }
  }

  return (
    <div className="ibx-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="ibx-modal" style={{ width: 820 }} role="dialog" aria-label="New export air booking">
        <header className="ibx-modal__head">
          <h3>New export air booking</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" className="ibx-btn" disabled={!!busy} onClick={() => void load(true)}>
              <Sparkles size={15} />{busy === 'ai' ? 'Reading email…' : 'AI fill (~2c)'}
            </button>
            <button type="button" className="ibx-mail__icon" aria-label="Close" onClick={close}><X size={18} /></button>
          </div>
        </header>
        <div className="ibx-modal__body">
          {!form ? <div className="ibx-jobs__empty">Reading email…</div> : (
            <>
              {notes.length ? (
                <div className="ibx-checknote">
                  <div style={{ fontWeight: 500, marginBottom: 2 }}>Check before creating</div>
                  {notes.slice(0, 5).map((x) => <div key={x}>{x}</div>)}
                </div>
              ) : null}
              <div className="ibx-grid4">
                <label className="ibx-field" style={{ gridColumn: 'span 2', position: 'relative' }}>
                  <span>Bill to (account)</span>
                  {bill ? (
                    <span className="ibx-in" style={{ display: 'flex', alignItems: 'center' }}>{bill.name}
                      <button type="button" className="ibx-link" style={{ marginLeft: 'auto' }} onClick={() => setBill(null)}>Change</button></span>
                  ) : <input className="ibx-in" placeholder="Search customer…" value={q} onChange={(e) => setQ(e.target.value)} />}
                  {!bill && hits.length ? (
                    <div className="ibx-hits" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5 }}>
                      {hits.map((h) => <button key={h.account_id} type="button" onClick={() => { setBill(h); setQ('') }}>{h.name}</button>)}
                    </div>
                  ) : null}
                </label>
                <label className={`ibx-field${low.has('destination') ? ' ibx-field--check' : ''}`}><span>To airport</span>
                  <input className="ibx-in" maxLength={3} placeholder="NAN" value={form.destination ?? ''}
                    onChange={(e) => set({ destination: e.target.value.toUpperCase() })} /></label>
                <label className="ibx-field"><span>Incoterm</span>
                  <select className="ibx-in" value={form.incoterm ?? ''} onChange={(e) => set({ incoterm: e.target.value || null })}>
                    {INCOTERMS.map((i) => <option key={i} value={i}>{i || 'Not set'}</option>)}
                  </select></label>
              </div>
              <div className="ibx-grid2" style={{ marginTop: 12 }}>
                <Party title="Shipper (NZ supplier)" v={form.shipper} onChange={(p) => set({ shipper: p })} />
                <Party title="Consignee" v={form.consignee} onChange={(p) => set({ consignee: p })} full={false} />
              </div>
              <div className="ibx-modal__label" style={{ marginTop: 12 }}>Cargo</div>
              <EaCargoLines lines={form.lines} onChange={(lines) => set({ lines })} />
              <div className="ibx-grid4" style={{ marginTop: 10 }}>
                <label className="ibx-field" style={{ gridColumn: 'span 2' }}><span>Goods</span>
                  <input className="ibx-in" value={form.goods ?? ''} onChange={(e) => set({ goods: e.target.value })} /></label>
                <label className="ibx-field"><span>PO / refs</span>
                  <input className="ibx-in" value={form.po_refs ?? ''} onChange={(e) => set({ po_refs: e.target.value })} /></label>
                <label className="ibx-field"><span>Cargo ready</span>
                  <input className="ibx-in" type="date" value={form.ready_date ?? ''} onChange={(e) => set({ ready_date: e.target.value || null })} /></label>
              </div>
              <label className="ibx-check"><input type="checkbox" checked={form.is_dg} onChange={(e) => set({ is_dg: e.target.checked })} />Dangerous goods
                {form.is_dg ? <input className="ibx-in" style={{ width: 120, marginLeft: 8 }} placeholder="UN number" value={form.un_number ?? ''}
                  onChange={(e) => set({ un_number: e.target.value })} /> : null}</label>

              <div className="ibx-modal__label" style={{ marginTop: 14 }}>How does the cargo get to UBF?</div>
              <div className="ibx-seg" style={{ display: 'inline-flex' }}>
                <button type="button" className={form.pickup.needed === true ? 'on' : ''} onClick={() => set({ pickup: { ...form.pickup, needed: true } })}>UBF collects</button>
                <button type="button" className={form.pickup.needed === false ? 'on' : ''} onClick={() => set({ pickup: { ...form.pickup, needed: false } })}>Supplier drops off</button>
              </div>
              {form.pickup.needed ? (
                <div className="ibx-grid4" style={{ marginTop: 8 }}>
                  <label className="ibx-field" style={{ gridColumn: 'span 4' }}><span>Pickup address</span>
                    <input className="ibx-in" placeholder={[form.shipper.address, form.shipper.city].filter(Boolean).join(', ') || 'Street, suburb, city'}
                      value={form.pickup.address ?? ''} onChange={(e) => set({ pickup: { ...form.pickup, address: e.target.value } })} /></label>
                  <label className="ibx-field"><span>Ready time</span>
                    <input className="ibx-in" type="time" value={form.pickup.ready_time ?? ''} onChange={(e) => set({ pickup: { ...form.pickup, ready_time: e.target.value } })} /></label>
                  <label className="ibx-field"><span>Site contact</span>
                    <input className="ibx-in" value={form.pickup.contact ?? ''} onChange={(e) => set({ pickup: { ...form.pickup, contact: e.target.value } })} /></label>
                  <label className="ibx-field" style={{ gridColumn: 'span 2' }}><span>Site phone</span>
                    <input className="ibx-in" value={form.pickup.phone ?? ''} onChange={(e) => set({ pickup: { ...form.pickup, phone: e.target.value } })} /></label>
                </div>
              ) : null}

              {atts.length ? (
                <>
                  <div className="ibx-modal__label" style={{ marginTop: 14 }}>Save these email files to the booking</div>
                  <div className="ibx-checks" style={{ maxHeight: 120 }}>
                    {atts.map((a) => (
                      <label key={a.id}><input type="checkbox" checked={picked.has(a.id)} onChange={(e) => {
                        const nx = new Set(picked); if (e.target.checked) nx.add(a.id); else nx.delete(a.id); setPicked(nx)
                      }} /><span className="ibx-ellip">{a.name}</span></label>
                    ))}
                  </div>
                </>
              ) : null}
              <label className="ibx-field" style={{ marginTop: 12 }}><span>Notes for ops</span>
                <textarea className="ibx-in" rows={2} value={form.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></label>
            </>
          )}
        </div>
        <footer className="ibx-modal__foot">
          <button type="button" className="ibx-btn" onClick={close}>Cancel</button>
          <button type="button" className="ibx-btn ibx-btn--primary" disabled={!form || !!busy} onClick={() => void create()}>
            {busy === 'save' ? 'Creating…' : form?.pickup.needed ? 'Create booking + pickup' : 'Create booking'}
          </button>
        </footer>
      </div>
    </div>
  )
}
