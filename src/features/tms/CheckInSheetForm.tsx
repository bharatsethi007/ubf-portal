import { useEffect, useState, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, X, Search } from 'lucide-react'
import { toast } from 'sonner'
import AddressAutocomplete from '@/components/bookings/AddressAutocomplete'
import PartyPicker from './PartyPicker'
import { emptySheetForm, mergePrefill, prefillFromConsignment, resolveReference, saveCheckinSheet, emptyLine, cube, type SheetForm, type ScreenVal } from './checkinSheetApi'

type Props = { open: boolean; consignmentId?: string | null; onClose: () => void; onDone: () => void }

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-xs font-medium text-neutral-500">{label}</span>{children}</label>
}
function ScreenRow({ label, value, onChange }: { label: string; value: ScreenVal; onChange: (v: ScreenVal) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2 text-sm">
      <span className="text-neutral-700">{label}</span>
      <span className="flex items-center gap-4 text-xs">
        {(['yes', 'no'] as const).map((opt) => (
          <label key={opt} className="flex items-center gap-1"><input type="radio" checked={value === opt} onChange={() => onChange(value === opt ? '' : opt)} /><span className="capitalize">{opt}</span></label>
        ))}
      </span>
    </div>
  )
}

export default function CheckInSheetForm({ open, consignmentId, onClose, onDone }: Props) {
  const [f, setF] = useState<SheetForm>(emptySheetForm())
  const [saving, setSaving] = useState(false)
  const [resolving, setResolving] = useState(false)
  const isUbf = Boolean(consignmentId)
  const set = (patch: Partial<SheetForm>) => setF((prev) => ({ ...prev, ...patch }))

  useEffect(() => {
    if (!open) return
    if (consignmentId) prefillFromConsignment(consignmentId).then((p) => setF(mergePrefill(emptySheetForm(), p))).catch(() => setF(emptySheetForm()))
    else setF(emptySheetForm())
  }, [open, consignmentId])

  async function fetchRef() {
    if (!f.ref_input.trim()) return
    setResolving(true)
    try { const p = await resolveReference(f.ref_input); if (p) { setF((prev) => mergePrefill(prev, p)); toast.success('Details filled') } else toast.error('No match for that reference') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Lookup failed') } finally { setResolving(false) }
  }

  const setLine = (i: number, patch: Partial<SheetForm['lines'][number]>) => set({ lines: f.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) })

  async function save() {
    if (saving) return
    setSaving(true)
    try { const no = await saveCheckinSheet(f); toast.success(`Checked in — ${no}`); onDone() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed'); setSaving(false) }
  }

  const SCREEN: { key: keyof SheetForm; label: string }[] = [
    { key: 'known_shipper', label: 'Known shipper' }, { key: 'sufficient_packaging', label: 'Sufficient packaging' },
    { key: 'ipsm_pallet', label: 'ISPM pallet' }, { key: 'statement_of_content', label: 'Statement of content (leave blank if unsure)' },
    { key: 'tamper_evident_form', label: 'Received in tamper-evident form' }, { key: 'booking_docs_attached', label: 'Booking docs / labels attached' },
    { key: 'damaged', label: 'Damaged' }, { key: 'fragile', label: 'Fragile' },
    { key: 'temperature_controlled', label: 'Temperature controlled' }, { key: 'physically_scanned', label: 'Physically scanned' },
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-none w-[80vw] max-w-[1100px] rounded-2xl">
        <DialogHeader className="border-b border-neutral-200 px-6 py-4"><DialogTitle>{isUbf ? `Check-in sheet — ${f.ref_input || 'consignment'}` : 'New check-in sheet'}</DialogTitle></DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Reference (consignment / booking / shipment)">
              <div className="flex gap-2">
                <input className="input flex-1" value={f.ref_input} onChange={(e) => set({ ref_input: e.target.value })} disabled={isUbf} />
                {!isUbf && <button type="button" onClick={fetchRef} disabled={resolving} className="inline-flex items-center gap-1 rounded-lg border border-[#0A2472] px-3 text-sm font-medium text-[#0A2472] hover:bg-[#0A2472]/[0.04]"><Search size={14} />{resolving ? '…' : 'Fetch'}</button>}
              </div>
            </Field>
            <Field label="Job type"><input className="input" value={f.job_type} onChange={(e) => set({ job_type: e.target.value })} /></Field>
            <Field label="Delivered by (driver)"><input className="input" value={f.delivered_by_name} onChange={(e) => set({ delivered_by_name: e.target.value })} /></Field>
          </div>

          <section className="rounded-xl border border-neutral-200 p-4">
            <h3 className="mb-3 border-l-2 border-[#0A2472] pl-2 text-xs font-semibold uppercase tracking-wide text-[#0A2472]">Shipper</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company"><PartyPicker value={f.shipper_company} onType={(company) => set({ shipper_company: company })} onPick={(p) => set({ shipper_company: p.company ?? '', shipper_address: p.address ?? f.shipper_address })} /></Field>
              <Field label="Address"><AddressAutocomplete label="" value={f.shipper_address} onChange={(a) => set({ shipper_address: a })} usePlaces /></Field>
              <Field label="Additional address info"><input className="input" value={f.shipper_additional_info} onChange={(e) => set({ shipper_additional_info: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="PO number"><input className="input" value={f.po_number} onChange={(e) => set({ po_number: e.target.value })} /></Field>
                <Field label="Reference"><input className="input" value={f.reference} onChange={(e) => set({ reference: e.target.value })} /></Field>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 p-4">
            <h3 className="mb-3 border-l-2 border-[#0A2472] pl-2 text-xs font-semibold uppercase tracking-wide text-[#0A2472]">Consignee</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company"><PartyPicker value={f.consignee_company} onType={(company) => set({ consignee_company: company })} onPick={(p) => set({ consignee_company: p.company ?? '', consignee_port_country: p.address ?? f.consignee_port_country })} /></Field>
              <Field label="Port / country"><input className="input" value={f.consignee_port_country} onChange={(e) => set({ consignee_port_country: e.target.value })} /></Field>
              <Field label="Consignee email"><input className="input" value={f.consignee_email} onChange={(e) => set({ consignee_email: e.target.value })} /></Field>
              <Field label="Warehouse location"><input className="input" value={f.warehouse_location} onChange={(e) => set({ warehouse_location: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_consignee_unknown} onChange={(e) => set({ is_consignee_unknown: e.target.checked })} /> Consignee unknown</label>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Tags"><input className="input" value={f.tags} onChange={(e) => set({ tags: e.target.value })} /></Field>
                <Field label="Console"><input className="input" value={f.console} onChange={(e) => set({ console: e.target.value })} /></Field>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 p-4">
            <h3 className="mb-3 border-l-2 border-[#0A2472] pl-2 text-xs font-semibold uppercase tracking-wide text-[#0A2472]">Order details — verify dims</h3>
            <div className="hidden grid-cols-[1.2fr_0.6fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_1fr_28px] gap-2 px-1 pb-1 text-[11px] uppercase tracking-wide text-neutral-400 md:grid">
              <span>Type</span><span>Units</span><span>Kg</span><span>L</span><span>W</span><span>H</span><span>CBM</span><span>Marks</span><span /></div>
            {f.lines.map((l, i) => (
              <div key={i} className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-[1.2fr_0.6fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_1fr_28px] md:items-center">
                <input className="input" placeholder="Type" value={l.type} onChange={(e) => setLine(i, { type: e.target.value })} />
                <input className="input" inputMode="decimal" placeholder="Units" value={l.units} onChange={(e) => setLine(i, { units: e.target.value })} />
                <input className="input" inputMode="decimal" placeholder="Kg" value={l.weight_kg} onChange={(e) => setLine(i, { weight_kg: e.target.value })} />
                <input className="input" inputMode="decimal" placeholder="L" value={l.length_cm} onChange={(e) => setLine(i, { length_cm: e.target.value })} />
                <input className="input" inputMode="decimal" placeholder="W" value={l.width_cm} onChange={(e) => setLine(i, { width_cm: e.target.value })} />
                <input className="input" inputMode="decimal" placeholder="H" value={l.height_cm} onChange={(e) => setLine(i, { height_cm: e.target.value })} />
                <span className="px-1 text-sm tabular-nums text-neutral-600">{cube(l.length_cm, l.width_cm, l.height_cm, l.units).toFixed(4)}</span>
                <input className="input" placeholder="Marks" value={l.marks} onChange={(e) => setLine(i, { marks: e.target.value })} />
                <button type="button" aria-label="Remove" className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-red-600" onClick={() => set({ lines: f.lines.length > 1 ? f.lines.filter((_, idx) => idx !== i) : f.lines })}><X size={15} /></button>
              </div>
            ))}
            <button type="button" className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-neutral-300 py-2 text-sm text-neutral-600 hover:bg-neutral-50" onClick={() => set({ lines: [...f.lines, emptyLine()] })}><Plus size={15} /> Add another row</button>
          </section>

          <section className="rounded-xl border border-neutral-200 p-4">
            <div className="mb-2 grid gap-3 sm:grid-cols-2">
              <Field label="Date screened"><input type="date" className="input" value={f.screen_at ?? ''} onChange={(e) => set({ screen_at: e.target.value })} /></Field>
              <div className="flex items-end gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="radio" checked={f.goods_type === 'general'} onChange={() => set({ goods_type: 'general' })} /> General goods</label>
                <label className="flex items-center gap-2"><input type="radio" checked={f.goods_type === 'dangerous'} onChange={() => set({ goods_type: 'dangerous' })} /> Dangerous goods</label>
              </div>
            </div>
            <div className="grid gap-x-8 sm:grid-cols-2">
              {SCREEN.map((s) => <ScreenRow key={s.key as string} label={s.label} value={f[s.key] as ScreenVal} onChange={(v) => set({ [s.key]: v } as Partial<SheetForm>)} />)}
            </div>
          </section>

          <Field label="Comments / remarks"><textarea className="input" rows={3} value={f.comments} onChange={(e) => set({ comments: e.target.value })} /></Field>
          <p className="text-xs text-neutral-400">Signature and document upload will be enabled once the storage bucket is connected.</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 px-6 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[#0A2472] px-4 py-2 text-sm font-medium text-white hover:bg-[#0A2472]/90 disabled:opacity-50">{saving ? 'Saving…' : 'Save check-in'}</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
