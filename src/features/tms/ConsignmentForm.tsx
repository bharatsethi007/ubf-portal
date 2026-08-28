import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookMarked } from 'lucide-react'
import { toast } from 'sonner'
import AddressAutocomplete from '@/components/bookings/AddressAutocomplete'
import CargoLinesEditor from './CargoLinesEditor'
import PartyPicker from './PartyPicker'
import AddressBookDialog from './AddressBookDialog'
import { PickupDocActions, DropoffDocActions } from './ConsignmentDocActions'
import { sendPickupDocsEmail } from './sendPickupDocs'
import {
  ORDER_TYPES, FLAG_KEYS, FLAG_LABELS, emptyForm, emptyParty, mangereParty, isMangere,
  useDepots, useCurrentUserIdentity, createConsignment, updateConsignment, fetchConsignmentForEdit,
  type ConsignmentFormValues, type PartyDraft,
} from './consignmentFormApi'

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ''}`}>
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  )
}
function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      {title && (
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#0A2472]">
          <span className="h-3.5 w-1 rounded-full bg-[#0A2472]" />{title}
        </h2>
      )}
      {children}
    </section>
  )
}
function Party({ title, party, onChange, footer }: { title: string; party: PartyDraft; onChange: (p: PartyDraft) => void; footer?: ReactNode }) {
  const set = (patch: Partial<PartyDraft>) => onChange({ ...party, ...patch })
  const [bookOpen, setBookOpen] = useState(false)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="border-l-2 border-[#0A2472] pl-2 text-xs font-semibold uppercase tracking-wide text-[#0A2472]">{title}</h3>
        <button type="button" onClick={() => setBookOpen(true)} title="Address book" className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:bg-neutral-50"><BookMarked size={14} /></button>
      </div>
      <Field label="Company"><PartyPicker value={party.company} onType={(company) => set({ company })} onPick={(p) => set(p)} /></Field>
      <Field label="Address"><AddressAutocomplete label="" value={party.address} onChange={(address) => set({ address })} usePlaces /></Field>
      <Field label="Additional address info"><input className="input" value={party.additional_info} onChange={(e) => set({ additional_info: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Contact"><input className="input" value={party.contact} onChange={(e) => set({ contact: e.target.value })} /></Field>
        <Field label="Phone"><input className="input" value={party.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="Email"><input className="input" value={party.email} onChange={(e) => set({ email: e.target.value })} /></Field>
      </div>
      {footer}
      <AddressBookDialog open={bookOpen} current={party} onClose={() => setBookOpen(false)} onPick={(p) => set(p)} />
    </div>
  )
}

export default function ConsignmentForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const depots = useDepots()
  const identity = useCurrentUserIdentity()
  const [v, setV] = useState<ConsignmentFormValues>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    fetchConsignmentForEdit(id).then((d) => { if (!cancelled && d) setV(d) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  // Default the depot to UB Freight Mangere on a new consignment.
  useEffect(() => {
    if (isEdit || !depots.length) return
    setV((prev) => (prev.depot_id ? prev : { ...prev, depot_id: (depots.find((d) => /mangere/i.test(d.name)) ?? depots[0]).id }))
  }, [depots, isEdit])

  // Auto-fill the UB Freight Mangere party: receiver on pick-up, sender on drop-off.
  useEffect(() => {
    if (isEdit || !identity) return
    const depotSide = v.order_type === 'pick-up' ? 'receiver' : v.order_type === 'drop-off' ? 'sender' : null
    setV((prev) => {
      const mang = mangereParty(identity)
      let { sender, receiver } = prev
      if (depotSide === 'receiver') { receiver = mang; if (isMangere(prev.sender)) sender = emptyParty() }
      else if (depotSide === 'sender') { sender = mang; if (isMangere(prev.receiver)) receiver = emptyParty() }
      return { ...prev, sender, receiver }
    })
  }, [v.order_type, identity, isEdit])

  const patch = (p: Partial<ConsignmentFormValues>) => setV((prev) => ({ ...prev, ...p }))
  const valid = v.order_type !== '' && v.sender.company.trim() !== '' && v.receiver.company.trim() !== ''
  const isPickup = v.order_type === 'pick-up'
  const isDropoff = v.order_type === 'drop-off'

  async function onSubmit() {
    if (!valid || saving) return
    setSaving(true); setError('')
    try {
      if (isEdit && id) { await updateConsignment(id, v); toast.success('Consignment updated') }
      else {
        const res = await createConsignment(v)
        toast.success(`Created ${res.consignment_no}`)
        if (v.order_type === 'pick-up' && (v.email_labels || v.email_consignment_note)) {
          toast.promise(sendPickupDocsEmail(res.id, { labels: v.email_labels, note: v.email_consignment_note }), {
            loading: 'Emailing documentation to sender…',
            success: 'Documentation emailed to sender',
            error: (e) => `Documentation email failed: ${e instanceof Error ? e.message : 'unknown error'}`,
          })
        }
      }
      navigate('/tms')
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save consignment'); setSaving(false) }
  }

  if (loading) return <div className="quotes-page"><div className="card quotes-page__card"><p className="text-muted-foreground pad-inline">Loading…</p></div></div>

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <Link to="/tms" className="mb-2 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"><ArrowLeft size={15} /> TMS</Link>
          <h1>{isEdit ? 'Edit consignment' : 'New consignment'}</h1>
        </header>

        <div className="mt-3 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Order type *">
              <select className="input" value={v.order_type} onChange={(e) => setV({ ...v, order_type: e.target.value })}>
                {ORDER_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Regional depot">
              <select className="input" value={v.depot_id} onChange={(e) => setV({ ...v, depot_id: e.target.value })}>
                <option value="">Select…</option>
                {depots.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Mode">
              <select className="input" value={v.mode} onChange={(e) => setV({ ...v, mode: e.target.value })}>
                <option value="">Select…</option>
                <option value="EA">Export Air</option>
                <option value="ES">Export Sea</option>
                <option value="IA">Import Air</option>
                <option value="IS">Import Sea</option>
              </select>
            </Field>
          </div>

          <Card>
            <div className="grid gap-6 md:grid-cols-2">
              <Party title="Sender" party={v.sender} onChange={(sender) => setV({ ...v, sender })}
                footer={isPickup ? <PickupDocActions v={v} patch={patch} /> : undefined} />
              <Party title="Receiver" party={v.receiver} onChange={(receiver) => setV({ ...v, receiver })}
                footer={isDropoff ? <DropoffDocActions v={v} patch={patch} /> : undefined} />
            </div>
          </Card>

          <Card title="Timing & references">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {!isDropoff && <Field label="Preferred pick-up"><input type="datetime-local" className="input" value={v.preferred_pickup_at} onChange={(e) => setV({ ...v, preferred_pickup_at: e.target.value })} /></Field>}
              {!isPickup && <Field label="Preferred delivery"><input type="datetime-local" className="input" value={v.preferred_delivery_at} onChange={(e) => setV({ ...v, preferred_delivery_at: e.target.value })} /></Field>}
              <Field label="Reference"><input className="input" value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} /></Field>
            </div>
            <Field label="Delivery instructions" className="mt-3"><textarea className="input" rows={2} value={v.delivery_instructions} onChange={(e) => setV({ ...v, delivery_instructions: e.target.value })} /></Field>
          </Card>

          <Card title="Order details">
            <div className="mb-2 flex gap-4 text-sm">
              {(['unitType', 'totalShipment'] as const).map((m) => (
                <label key={m} className="flex items-center gap-1.5">
                  <input type="radio" checked={v.calculate_volume_by === m} onChange={() => setV({ ...v, calculate_volume_by: m })} />
                  {m === 'unitType' ? 'By unit type' : 'By total shipment'}
                </label>
              ))}
            </div>
            <CargoLinesEditor cargo={v.cargo} onChange={(cargo) => setV({ ...v, cargo })} />
          </Card>

          <Card title="Handling">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {FLAG_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" checked={!!v.flags[k]} onChange={(e) => setV({ ...v, flags: { ...v.flags, [k]: e.target.checked } })} />
                  {FLAG_LABELS[k]}
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={v.goods_type === 'general'} onChange={() => setV({ ...v, goods_type: 'general' })} /> General goods</label>
              <label className="flex items-center gap-2"><input type="radio" checked={v.goods_type === 'dangerous'} onChange={() => setV({ ...v, goods_type: 'dangerous' })} /> Dangerous goods</label>
              {v.goods_type === 'dangerous' && <input className="input max-w-xs" placeholder="DG reason (UN #, class)…" value={v.dangerous_goods_reason} onChange={(e) => setV({ ...v, dangerous_goods_reason: e.target.value })} />}
            </div>
          </Card>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pb-2">
            <button type="button" disabled={!valid || saving} onClick={onSubmit}
              className="rounded-lg bg-[#0A2472] px-4 py-2 text-sm font-medium text-white hover:bg-[#0A2472]/90 disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create consignment'}
            </button>
            <button type="button" onClick={() => navigate('/tms')}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
