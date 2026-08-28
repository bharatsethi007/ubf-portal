import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, X, Search, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import AddressAutocomplete from '@/components/bookings/AddressAutocomplete'
import PartyPicker from './PartyPicker'
import CheckinPortSelect from './CheckinPortSelect'
import SignaturePad from './SignaturePad'
import CheckinPhotoStrip from './CheckinPhotoStrip'
import { emptySheetForm, mergePrefill, prefillFromConsignment, resolveReference, saveCheckinSheet, currentUserName, emptyLine, cube, type SheetForm, type ScreenVal } from './checkinSheetApi'

type Props = { open: boolean; consignmentId?: string | null; onClose: () => void; onDone: () => void }

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1"><span className="text-[11px] font-medium text-neutral-500">{label}</span>{children}</label>
}
function ScreenRow({ label, value, onChange }: { label: string; value: ScreenVal; onChange: (v: ScreenVal) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-1.5 text-[13px]">
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
  const [me, setMe] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const isUbf = Boolean(consignmentId)
  const set = (patch: Partial<SheetForm>) => setF((prev) => ({ ...prev, ...patch }))

  useEffect(() => {
    if (!open) return
    currentUserName().then(setMe).catch(() => setMe(''))
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

  // Enter jumps to the next field (tablet-friendly fast entry); textarea + the port search keep native behaviour.
  function advance(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    const t = e.target as HTMLElement
    if (t.tagName === 'TEXTAREA' || t.classList.contains('iata-tile__input')) return
    if (t.tagName !== 'INPUT' && t.tagName !== 'SELECT') return
    e.preventDefault()
    const scope = scrollRef.current
    if (!scope) return
    const items = Array.from(scope.querySelectorAll<HTMLElement>('input:not([type=radio]):not([type=checkbox]):not([type=file]):not([readonly]), select, textarea'))
      .filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
    const idx = items.indexOf(t)
    if (idx >= 0 && idx < items.length - 1) items[idx + 1].focus()
  }

  async function save() {
    if (saving) return
    setSaving(true)
    try { const no = await saveCheckinSheet(f); toast.success(`Checked in — ${no}`); onDone() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed'); setSaving(false) }
  }

  const SCREEN: { key: keyof SheetForm; label: string }[] = [
    { key: 'known_shipper', label: 'Known shipper' }, { key: 'sufficient_packaging', label: 'Sufficient packaging' },
    { key: 'ipsm_pallet', label: 'ISPM pallet' }, { key: 'statement_of_content', label: 'Statement of content' },
    { key: 'tamper_evident_form', label: 'Tamper-evident form' }, { key: 'booking_docs_attached', label: 'Booking docs / labels' },
    { key: 'damaged', label: 'Damaged' }, { key: 'fragile', label: 'Fragile' },
    { key: 'temperature_controlled', label: 'Temperature controlled' }, { key: 'physically_scanned', label: 'Physically scanned' },
  ]
  const selectNum = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select()
  const TYPE_OPTS = ['Pallet', 'Cartons', 'Crate', 'Bags', 'Rolls', 'Other']

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-none w-[92vw] max-w-[880px] rounded-2xl">
        <DialogHeader className="border-b border-neutral-200 px-5 py-3"><DialogTitle className="text-base">{isUbf ? `Check-in — ${f.ref_input || 'consignment'}` : 'New check-in sheet'}</DialogTitle></DialogHeader>
        <div ref={scrollRef} onKeyDown={advance} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">

          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="Reference (consignment / booking / shipment)">
                <div className="flex gap-2">
                  <input className="input input--sm flex-1" value={f.ref_input} onChange={(e) => set({ ref_input: e.target.value })} disabled={isUbf} />
                  {!isUbf && <button type="button" onClick={fetchRef} disabled={resolving} className="inline-flex items-center gap-1 rounded-lg border border-[#0A2472] px-3 text-sm font-medium text-[#0A2472] hover:bg-[#0A2472]/[0.04]"><Search size={14} />{resolving ? '…' : 'Fetch'}</button>}
                </div>
              </Field>
            </div>
            <Field label="Mode">
              <select className="input input--sm" value={f.mode} onChange={(e) => set({ mode: e.target.value as SheetForm['mode'] })}>
                <option value="">—</option><option value="air">Air</option><option value="sea">Sea</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded-xl border border-neutral-200 p-3">
              <h3 className="mb-2 border-l-2 border-[#0A2472] pl-2 text-[11px] font-semibold uppercase tracking-wide text-[#0A2472]">Shipper</h3>
              <div className="grid gap-2.5">
                <Field label="Company"><PartyPicker value={f.shipper_company} onType={(company) => set({ shipper_company: company })} onPick={(p) => set({ shipper_company: p.company ?? '', shipper_address: p.address ?? f.shipper_address })} /></Field>
                <Field label="Address"><AddressAutocomplete label="" value={f.shipper_address} onChange={(a) => set({ shipper_address: a })} usePlaces /></Field>
                <Field label="Reference"><input className="input input--sm" value={f.reference} onChange={(e) => set({ reference: e.target.value })} /></Field>
              </div>
            </section>

            <section className="rounded-xl border border-neutral-200 p-3">
              <h3 className="mb-2 border-l-2 border-[#0A2472] pl-2 text-[11px] font-semibold uppercase tracking-wide text-[#0A2472]">Consignee</h3>
              <div className="grid gap-2.5">
                <Field label="Company"><PartyPicker value={f.consignee_company} onType={(company) => set({ consignee_company: company })} onPick={(p) => set({ consignee_company: p.company ?? '' })} /></Field>
                <Field label={f.mode === 'air' ? 'Destination airport' : f.mode === 'sea' ? 'Destination port' : 'Destination port / airport'}>
                  <CheckinPortSelect mode={f.mode} value={f.consignee_port_country} onChange={(v, kind) => set({ consignee_port_country: v, ...(!f.mode && kind ? { mode: kind } : {}) })} />
                </Field>
                <label className="mt-0.5 flex items-center gap-2 text-[13px] text-neutral-700"><input type="checkbox" checked={f.known_customer} onChange={(e) => set({ known_customer: e.target.checked })} /> Known customer</label>
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-neutral-200 p-3">
            <h3 className="mb-2 border-l-2 border-[#0A2472] pl-2 text-[11px] font-semibold uppercase tracking-wide text-[#0A2472]">Order details — verify dims</h3>
            <div className="hidden grid-cols-[1.2fr_0.6fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_1fr_28px] gap-1.5 px-1 pb-1 text-[10px] uppercase tracking-wide text-neutral-400 md:grid">
              <span>Type</span><span>Units</span><span>Kg</span><span>L</span><span>W</span><span>H</span><span>CBM</span><span>Marks</span><span /></div>
            {f.lines.map((l, i) => (
              <div key={i} className="mb-1.5 grid grid-cols-2 gap-1.5 md:grid-cols-[1.2fr_0.6fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_1fr_28px] md:items-center">
                <select className="input input--sm" value={l.type} onChange={(e) => setLine(i, { type: e.target.value })}>
                  <option value="">Type</option>
                  {l.type && !TYPE_OPTS.includes(l.type) && <option value={l.type}>{l.type}</option>}
                  {TYPE_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <input className="input input--sm" inputMode="decimal" placeholder="Units" value={l.units} onFocus={selectNum} onChange={(e) => setLine(i, { units: e.target.value })} />
                <input className="input input--sm" inputMode="decimal" placeholder="Kg" value={l.weight_kg} onFocus={selectNum} onChange={(e) => setLine(i, { weight_kg: e.target.value })} />
                <input className="input input--sm" inputMode="decimal" placeholder="L" value={l.length_cm} onFocus={selectNum} onChange={(e) => setLine(i, { length_cm: e.target.value })} />
                <input className="input input--sm" inputMode="decimal" placeholder="W" value={l.width_cm} onFocus={selectNum} onChange={(e) => setLine(i, { width_cm: e.target.value })} />
                <input className="input input--sm" inputMode="decimal" placeholder="H" value={l.height_cm} onFocus={selectNum} onChange={(e) => setLine(i, { height_cm: e.target.value })} />
                <span className="px-1 text-[13px] tabular-nums text-neutral-600">{cube(l.length_cm, l.width_cm, l.height_cm, l.units).toFixed(4)}</span>
                <input className="input input--sm" placeholder="Marks" value={l.marks} onChange={(e) => setLine(i, { marks: e.target.value })} />
                <button type="button" aria-label="Remove" className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-red-600" onClick={() => set({ lines: f.lines.length > 1 ? f.lines.filter((_, idx) => idx !== i) : f.lines })}><X size={15} /></button>
              </div>
            ))}
            <button type="button" className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-neutral-300 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-50" onClick={() => set({ lines: [...f.lines, emptyLine()] })}><Plus size={15} /> Add row</button>
          </section>

          <section className="rounded-xl border border-neutral-200 p-3">
            <div className="mb-2 grid gap-2.5 sm:grid-cols-2">
              <Field label="Date screened"><input type="date" className="input input--sm" value={f.screen_at ?? ''} onChange={(e) => set({ screen_at: e.target.value })} /></Field>
              <div className="flex items-end gap-4 text-[13px]">
                <label className="flex items-center gap-2"><input type="radio" checked={f.goods_type === 'general'} onChange={() => set({ goods_type: 'general' })} /> General goods</label>
                <label className="flex items-center gap-2"><input type="radio" checked={f.goods_type === 'dangerous'} onChange={() => set({ goods_type: 'dangerous' })} /> Dangerous goods</label>
              </div>
            </div>
            <div className="grid gap-x-8 sm:grid-cols-2">
              {SCREEN.map((s) => <ScreenRow key={s.key as string} label={s.label} value={f[s.key] as ScreenVal} onChange={(v) => set({ [s.key]: v } as Partial<SheetForm>)} />)}
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[13px] text-neutral-700"><UserCheck size={15} className="text-[#0A2472]" /><span className="text-neutral-500">Received by</span><span className="font-medium text-neutral-800">{me || '—'}</span>{f.delivered_by_name && <span className="ml-auto text-xs text-neutral-400">Driver: {f.delivered_by_name}</span>}</div>
                <SignaturePad label="Signature" value={f.signature_data_url} onChange={(url) => set({ signature_data_url: url })} />
              </div>
              <CheckinPhotoStrip label="Photos" files={f.photo_files} onChange={(files) => set({ photo_files: files })} />
            </div>
          </section>

          <Field label="Comments / remarks"><textarea className="input" rows={2} value={f.comments} onChange={(e) => set({ comments: e.target.value })} /></Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[#0A2472] px-4 py-2 text-sm font-medium text-white hover:bg-[#0A2472]/90 disabled:opacity-50">{saving ? 'Saving…' : 'Save check-in'}</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
