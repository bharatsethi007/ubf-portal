import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import AddressAutocomplete from '@/components/bookings/AddressAutocomplete'
import CargoLinesEditor from './CargoLinesEditor'
import { ORDER_TYPES, FLAG_KEYS, FLAG_LABELS, emptyForm, useDepots, createConsignment, updateConsignment, fetchConsignmentForEdit, type ConsignmentFormValues, type PartyDraft } from './consignmentFormApi'

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
    <section className="rounded-xl border border-neutral-200 p-4">
      {title && <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#0A2472]">{title}</h2>}
      {children}
    </section>
  )
}
function Party({ title, party, onChange }: { title: string; party: PartyDraft; onChange: (p: PartyDraft) => void }) {
  const set = (patch: Partial<PartyDraft>) => onChange({ ...party, ...patch })
  return (
    <div className="space-y-3">
      <h3 className="border-l-2 border-[#0A2472] pl-2 text-xs font-semibold uppercase tracking-wide text-[#0A2472]">{title}</h3>
      <Field label="Company name"><input className="input" value={party.company} onChange={(e) => set({ company: e.target.value })} /></Field>
      <Field label="Address"><AddressAutocomplete label="" value={party.address} onChange={(address) => set({ address })} /></Field>
      <Field label="Additional address info"><input className="input" value={party.additional_info} onChange={(e) => set({ additional_info: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Contact"><input className="input" value={party.contact} onChange={(e) => set({ contact: e.target.value })} /></Field>
        <Field label="Phone"><input className="input" value={party.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="Email"><input className="input" value={party.email} onChange={(e) => set({ email: e.target.value })} /></Field>
      </div>
    </div>
  )
}

export default function ConsignmentForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const depots = useDepots()
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

  const valid = v.order_type !== '' && v.sender.company.trim() !== '' && v.receiver.company.trim() !== ''

  async function onSubmit() {
    if (!valid || saving) return
    setSaving(true); setError('')
    try {
      if (isEdit && id) { await updateConsignment(id, v); toast.success('Consignment updated') }
      else { const res = await createConsignment(v); toast.success(`Created ${res.consignment_no}`) }
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

        <div className="mt-3 max-w-5xl space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>

          <Card>
            <div className="grid gap-6 md:grid-cols-2">
              <Party title="Sender" party={v.sender} onChange={(sender) => setV({ ...v, sender })} />
              <Party title="Receiver" party={v.receiver} onChange={(receiver) => setV({ ...v, receiver })} />
            </div>
          </Card>

          <Card title="Timing & references">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Field label="Preferred pick-up"><input type="datetime-local" className="input" value={v.preferred_pickup_at} onChange={(e) => setV({ ...v, preferred_pickup_at: e.target.value })} /></Field>
              <Field label="Preferred delivery"><input type="datetime-local" className="input" value={v.preferred_delivery_at} onChange={(e) => setV({ ...v, preferred_delivery_at: e.target.value })} /></Field>
              <Field label="Estimated delivery"><input type="datetime-local" className="input" value={v.estimated_delivery_at} onChange={(e) => setV({ ...v, estimated_delivery_at: e.target.value })} /></Field>
              <Field label="Purchase order #"><input className="input" value={v.po_number} onChange={(e) => setV({ ...v, po_number: e.target.value })} /></Field>
              <Field label="Supplier"><input className="input" value={v.supplier_name} onChange={(e) => setV({ ...v, supplier_name: e.target.value })} /></Field>
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
