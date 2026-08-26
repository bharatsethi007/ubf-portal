import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import AddressAutocomplete from '@/components/bookings/AddressAutocomplete'
import CargoLinesEditor from './CargoLinesEditor'
import {
  ORDER_TYPES, FLAG_KEYS, FLAG_LABELS, emptyForm, useDepots,
  createConsignment, updateConsignment, fetchConsignmentForEdit,
  type ConsignmentFormValues, type PartyDraft,
} from './consignmentFormApi'

const labelStyle = { fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' } as const
const fieldStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6 }

function PartyBlock({ title, party, onChange }: { title: string; party: PartyDraft; onChange: (p: PartyDraft) => void }) {
  const set = (patch: Partial<PartyDraft>) => onChange({ ...party, ...patch })
  return (
    <section className="mt-4">
      <h2 className="mb-2 text-sm font-semibold text-[#0A2472]">{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Company Name</label>
          <input className="input" value={party.company} onChange={(e) => set({ company: e.target.value })} />
        </div>
        <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Address</label>
          <AddressAutocomplete label="" value={party.address} onChange={(address) => set({ address })} />
        </div>
        <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Additional Address Information</label>
          <input className="input" value={party.additional_info} onChange={(e) => set({ additional_info: e.target.value })} />
        </div>
        <div style={fieldStyle}><label style={labelStyle}>Contact Name</label><input className="input" value={party.contact} onChange={(e) => set({ contact: e.target.value })} /></div>
        <div style={fieldStyle}><label style={labelStyle}>Phone</label><input className="input" value={party.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
        <div style={fieldStyle}><label style={labelStyle}>Email</label><input className="input" value={party.email} onChange={(e) => set({ email: e.target.value })} /></div>
      </div>
    </section>
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save consignment'); setSaving(false)
    }
  }

  if (loading) return <div className="quotes-page"><div className="card quotes-page__card"><p className="text-muted-foreground pad-inline">Loading…</p></div></div>

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <Link to="/tms" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: 8 }}>
            <ArrowLeft size={15} /> TMS
          </Link>
          <h1>{isEdit ? 'Edit Consignment' : 'Add New Consignment'}</h1>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Order Type *</label>
            <select className="input" value={v.order_type} onChange={(e) => setV({ ...v, order_type: e.target.value })}>
              {ORDER_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Regional Depot</label>
            <select className="input" value={v.depot_id} onChange={(e) => setV({ ...v, depot_id: e.target.value })}>
              <option value="">Select…</option>
              {depots.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        <PartyBlock title="Sender" party={v.sender} onChange={(sender) => setV({ ...v, sender })} />
        <PartyBlock title="Receiver" party={v.receiver} onChange={(receiver) => setV({ ...v, receiver })} />

        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-[#0A2472]">Timing & References</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div style={fieldStyle}><label style={labelStyle}>Preferred Pick-up</label><input type="datetime-local" className="input" value={v.preferred_pickup_at} onChange={(e) => setV({ ...v, preferred_pickup_at: e.target.value })} /></div>
            <div style={fieldStyle}><label style={labelStyle}>Preferred Delivery</label><input type="datetime-local" className="input" value={v.preferred_delivery_at} onChange={(e) => setV({ ...v, preferred_delivery_at: e.target.value })} /></div>
            <div style={fieldStyle}><label style={labelStyle}>Estimated Delivery</label><input type="datetime-local" className="input" value={v.estimated_delivery_at} onChange={(e) => setV({ ...v, estimated_delivery_at: e.target.value })} /></div>
            <div style={fieldStyle}><label style={labelStyle}>Purchase Order #</label><input className="input" value={v.po_number} onChange={(e) => setV({ ...v, po_number: e.target.value })} /></div>
            <div style={fieldStyle}><label style={labelStyle}>Supplier Name</label><input className="input" value={v.supplier_name} onChange={(e) => setV({ ...v, supplier_name: e.target.value })} /></div>
            <div style={fieldStyle}><label style={labelStyle}>Reference</label><input className="input" value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} /></div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}><label style={labelStyle}>Delivery Instructions</label><textarea className="input" rows={2} value={v.delivery_instructions} onChange={(e) => setV({ ...v, delivery_instructions: e.target.value })} /></div>
          </div>
        </section>

        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-[#0A2472]">Order Details</h2>
          <div className="mb-2 flex gap-4 text-sm">
            {(['unitType', 'totalShipment'] as const).map((m) => (
              <label key={m} className="flex items-center gap-1">
                <input type="radio" checked={v.calculate_volume_by === m} onChange={() => setV({ ...v, calculate_volume_by: m })} />
                {m === 'unitType' ? 'Calculate by Unit Type' : 'Calculate by Total Shipment'}
              </label>
            ))}
          </div>
          <CargoLinesEditor cargo={v.cargo} onChange={(cargo) => setV({ ...v, cargo })} />
        </section>

        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-[#0A2472]">Handling</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {FLAG_KEYS.map((k) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" checked={!!v.flags[k]} onChange={(e) => setV({ ...v, flags: { ...v.flags, [k]: e.target.checked } })} />
                {FLAG_LABELS[k]}
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={v.goods_type === 'general'} onChange={() => setV({ ...v, goods_type: 'general' })} /> General Goods</label>
            <label className="flex items-center gap-2"><input type="radio" checked={v.goods_type === 'dangerous'} onChange={() => setV({ ...v, goods_type: 'dangerous' })} /> Dangerous Goods</label>
            {v.goods_type === 'dangerous' && (
              <input className="input" style={{ maxWidth: 320 }} placeholder="DG reason (UN #, class)…" value={v.dangerous_goods_reason} onChange={(e) => setV({ ...v, dangerous_goods_reason: e.target.value })} />
            )}
          </div>
        </section>

        {error && <p style={{ color: '#B23B3B', fontSize: 13, margin: '12px 0 0' }}>{error}</p>}

        <div className="mt-5 flex gap-3">
          <button type="button" className="btn quotes-page__new-btn" disabled={!valid || saving} onClick={onSubmit}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Submit New Consignment'}
          </button>
          <button type="button" className="btn" onClick={() => navigate('/tms')}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
