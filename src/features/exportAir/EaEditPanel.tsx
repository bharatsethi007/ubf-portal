import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import DateField from '@/components/DateField'
import { useStaffList } from '@/hooks/useStaffList'
import { btn, btnPrimary, lbl } from './eaUi'
import { patchBooking, type EaDetail } from './useEaBooking'

type Form = Record<string, string | boolean | null>

const KEYS = [
  'destination', 'incoterm', 'cargo_ready_date', 'handled_by',
  'pieces', 'weight_kg', 'volume_m3', 'chargeable_weight_kg',
  'goods_description', 'cargo_value', 'cargo_value_currency', 'is_dg', 'un_number',
  'shipper_name', 'shipper_address', 'shipper_city', 'pickup_address',
  'consignee_name', 'consignee_address', 'consignee_city', 'consignee_contact', 'consignee_phone',
  'customer_ref', 'special_instructions',
] as const
const NUM = new Set(['pieces', 'weight_kg', 'volume_m3', 'chargeable_weight_kg', 'cargo_value'])
const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CPT', 'CIP', 'CFR', 'CIF', 'DAP', 'DPU', 'DDP']

/** Slide-over editor for the whole EA booking. Replaces the legacy form for EA. */
export default function EaEditPanel({ b, onClose, onSaved }: { b: EaDetail; onClose: () => void; onSaved: () => void }) {
  const { staff } = useStaffList()
  const src = b as unknown as Record<string, unknown>
  const [f, setF] = useState<Form>(() => Object.fromEntries(KEYS.map((k) => [k, src[k] == null ? null : typeof src[k] === 'boolean' ? (src[k] as boolean) : String(src[k])])))
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (v: string | boolean | null) => setF((p) => ({ ...p, [k]: v }))

  async function save() {
    setBusy(true)
    const patch: Record<string, unknown> = {}
    for (const k of KEYS) {
      const v = f[k]
      const before = src[k] == null ? null : typeof src[k] === 'boolean' ? src[k] : String(src[k])
      if (v === before) continue
      patch[k] = NUM.has(k) ? (v === '' || v == null ? null : Number(v)) : v === '' ? null : v
    }
    if (patch.destination) patch.destination = String(patch.destination).toUpperCase()
    try {
      if (Object.keys(patch).length) await patchBooking(b.id, patch)
      toast.success('Saved')
      onSaved()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const t = (k: string, label: string, opts: { w?: string; mono?: boolean; area?: boolean } = {}) => (
    <Field label={label} w={opts.w}>
      {opts.area ? (
        <textarea value={(f[k] as string) ?? ''} onChange={(e) => set(k)(e.target.value)} rows={3} className={`${inp} h-auto py-1.5`} />
      ) : (
        <input value={(f[k] as string) ?? ''} onChange={(e) => set(k)(e.target.value)} className={`${inp} ${opts.mono ? 'bk-mono' : ''}`} />
      )}
    </Field>
  )

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(15,23,42,.18)]" onClick={onClose}>
      <div role="dialog" aria-label={`Edit ${b.booking_ref}`} className="flex h-full w-full max-w-[560px] flex-col bg-white shadow-[-12px_0_32px_rgba(15,23,42,.12)]" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-[#EEF0F3] px-5 py-3.5">
          <h2 className="m-0 text-[14px] font-semibold">Edit <span className="bk-mono">{b.booking_ref}</span></h2>
          <button type="button" aria-label="Close" title="Close" onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-[#5B616E] hover:bg-[#F2F4F7]"><X size={15} /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-[12.5px]">
          <Section title="Shipment">
            {t('destination', 'Destination (IATA)', { w: 'w-[120px]', mono: true })}
            <Field label="Incoterm" w="w-[120px]">
              <select value={(f.incoterm as string) ?? ''} onChange={(e) => set('incoterm')(e.target.value)} className={inp}>
                <option value="">—</option>
                {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Cargo ready" w="w-[150px]"><DateField value={(f.cargo_ready_date as string) ?? null} onChange={set('cargo_ready_date')} width={150} /></Field>
            <Field label="Owner" w="w-[180px]">
              <select value={(f.handled_by as string) ?? ''} onChange={(e) => set('handled_by')(e.target.value || null)} className={inp}>
                <option value="">Unassigned</option>
                {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
              </select>
            </Field>
            {t('customer_ref', 'Customer ref / PO', { w: 'w-[180px]' })}
          </Section>
          <Section title="Cargo (booked)">
            {t('pieces', 'Pieces', { w: 'w-[90px]', mono: true })}
            {t('weight_kg', 'Gross kg', { w: 'w-[100px]', mono: true })}
            {t('volume_m3', 'Volume m³', { w: 'w-[100px]', mono: true })}
            {t('chargeable_weight_kg', 'Chargeable kg', { w: 'w-[110px]', mono: true })}
            {t('goods_description', 'Goods description', { w: 'w-full', area: true })}
            {t('cargo_value', 'Value', { w: 'w-[120px]', mono: true })}
            {t('cargo_value_currency', 'Currency', { w: 'w-[80px]', mono: true })}
            <Field label="Dangerous goods" w="w-[120px]">
              <label className="flex h-[30px] items-center gap-2"><input type="checkbox" checked={!!f.is_dg} onChange={(e) => set('is_dg')(e.target.checked)} className="accent-[#0A2472]" /> DG</label>
            </Field>
            {f.is_dg ? t('un_number', 'UN number', { w: 'w-[110px]', mono: true }) : null}
          </Section>
          <Section title="Shipper">
            {t('shipper_name', 'Name', { w: 'w-full' })}
            {t('shipper_address', 'Address', { w: 'w-[340px]' })}
            {t('shipper_city', 'City', { w: 'w-[150px]' })}
            {t('pickup_address', 'Pickup address (if different)', { w: 'w-full' })}
          </Section>
          <Section title="Consignee">
            {t('consignee_name', 'Name', { w: 'w-full' })}
            {t('consignee_address', 'Address', { w: 'w-[340px]' })}
            {t('consignee_city', 'City', { w: 'w-[150px]' })}
            {t('consignee_contact', 'Contact', { w: 'w-[240px]' })}
            {t('consignee_phone', 'Phone', { w: 'w-[180px]', mono: true })}
          </Section>
          <Section title="Notes">{t('special_instructions', 'Special instructions', { w: 'w-full', area: true })}</Section>
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#EEF0F3] px-5 py-3">
          <button type="button" className={btn} onClick={onClose}>Cancel</button>
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>
        </footer>
      </div>
    </div>
  )
}

const inp = 'h-[30px] w-full rounded-[7px] border border-[#E3E6EB] bg-white px-2 text-[12.5px] text-[#14161A] outline-none focus:border-[#0A2472]'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="m-0 mb-2.5 text-[12px] font-semibold text-[#14161A]">{title}</h3>
      <div className="flex flex-wrap gap-x-3 gap-y-2.5">{children}</div>
    </section>
  )
}

function Field({ label, w = 'w-[200px]', children }: { label: string; w?: string; children: ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 ${w}`}>
      <span className={lbl}>{label}</span>
      {children}
    </label>
  )
}
