import { useEffect, useState } from 'react'
import { Check, PenLine, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/supabase'
import { cargoOf, fmtNum, type EaRow } from '../eaTypes'
import { btn, btnPrimary, lbl, Tag } from '../eaUi'
import { addManualSub, consolidate, supplierOf, type ManualSub } from '../eaMaster'
import type { EaDetail } from '../useEaBooking'

type Props = { m: EaDetail; onClose: () => void; onDone: (firstNewId: string | null) => void }

const inp = 'h-[30px] w-full rounded-[7px] border border-[#E3E6EB] bg-white px-2 text-[12.5px] outline-none focus:border-[#0A2472]'
const EMPTY: ManualSub = { shipper_name: '', shipper_address: '', shipper_city: '', shipper_contact: '', shipper_phone: '', shipper_email: '', pieces: '', weight_kg: '', volume_m3: '', goods_description: '', cargo_ready_date: '', collection_mode: 'pickup' }
const sameBuyer = (m: EaDetail, r: EaRow) =>
  m.consignee_account_id ? r.consignee_account_id === m.consignee_account_id
    : !!m.consignee_name && (r.consignee_name ?? '').trim().toLowerCase() === m.consignee_name.trim().toLowerCase()

/** Add sub-HAWBs: pick HAWBs going to the same buyer (same consol first), or type a supplier in. */
export default function EaAddSubDialog({ m, onClose, onDone }: Props) {
  const [tab, setTab] = useState<'pick' | 'manual'>('pick')
  const [rows, setRows] = useState<EaRow[] | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [f, setF] = useState<ManualSub>(EMPTY)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void supabase.from('v_ea_bookings').select('*').eq('destination', (m.destination || 'NAN').toUpperCase())
      .is('master_booking_id', null).neq('id', m.id).order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => {
        const list = ((data ?? []) as EaRow[]).filter((r) => !r.is_consolidation && !r.master_booking_id && r.consol_status !== 'exported' && r.consol_status !== 'departed' && sameBuyer(m, r))
        list.sort((a, b) => Number(b.consol_id === m.consol_id && !!m.consol_id) - Number(a.consol_id === m.consol_id && !!m.consol_id))
        setRows(list)
        if (!list.length) setTab('manual')
      })
  }, [m])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const needle = q.trim().toLowerCase()
  const shown = (rows ?? []).filter((r) => !needle || [r.booking_ref, r.shipper_name, r.shipper_code_name].some((s) => s?.toLowerCase().includes(needle)))
  const set = (k: keyof ManualSub) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  async function save() {
    setBusy(true)
    try {
      if (tab === 'pick') {
        if (!sel.size) throw new Error('Tick at least one HAWB')
        await consolidate([...sel], m.id)
        toast.success(`${sel.size} HAWB${sel.size > 1 ? 's' : ''} added`)
        onDone([...sel][0])
      } else {
        if (!f.shipper_name.trim()) throw new Error('Supplier name is needed')
        const id = await addManualSub(m, f)
        toast.success(`${f.shipper_name} added`)
        onDone(id)
      }
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  const field = (k: keyof ManualSub, label: string, cls = '', type = 'text') => (
    <label className={`flex flex-col gap-1 ${cls}`}><span className={lbl}>{label}</span><input type={type} value={f[k]} onChange={(e) => set(k)(e.target.value)} className={inp} /></label>
  )
  const tabBtn = (t: 'pick' | 'manual', label: string, icon: React.ReactNode) => (
    <button type="button" onClick={() => setTab(t)} className={`inline-flex h-[28px] w-auto items-center gap-1.5 rounded-[6px] border-0 px-3 text-[12px] ${tab === t ? 'bg-white font-medium text-[#0A2472] shadow-[0_1px_2px_rgba(16,24,40,.12)]' : 'bg-transparent text-[#5B616E]'}`}>{icon}{label}</button>
  )

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(15,23,42,.22)] p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-label="Add sub-HAWB" className="flex max-h-[86vh] w-full max-w-[720px] flex-col overflow-hidden rounded-xl bg-white text-[12.5px] shadow-[0_24px_48px_rgba(15,23,42,.18)] duration-200 animate-in fade-in-0 zoom-in-95">
        <header className="flex items-center gap-3 border-b border-[#EEF0F3] px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[14px] font-semibold">Add to {m.booking_ref}</h2>
            <p className="m-0 mt-0.5 truncate text-[11.5px] text-[#6B7280]">Suppliers shipping to {m.consignee_code_name ?? m.consignee_name ?? 'this buyer'}</p>
          </div>
          <div className="flex gap-0.5 rounded-[8px] bg-[#F2F4F7] p-0.5">{tabBtn('pick', `Existing HAWBs${rows ? ` (${rows.length})` : ''}`, <Check size={13} />)}{tabBtn('manual', 'Enter manually', <PenLine size={13} />)}</div>
          <button type="button" aria-label="Close" onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-[#5B616E] hover:bg-[#F2F4F7]"><X size={15} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'pick' ? (
            <>
              <div className="relative border-b border-[#F1F2F5] px-5 py-2.5">
                <Search size={13} className="absolute left-7 top-[18px] text-[#98A2B3]" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ref or supplier" className={`${inp} pl-7`} />
              </div>
              {rows === null ? <p className="m-0 px-5 py-6 text-[#6B7280]">Loading…</p> : null}
              {rows && !shown.length ? <p className="m-0 px-5 py-6 text-[#6B7280]">No other HAWBs going to this buyer. Enter the supplier manually instead.</p> : null}
              <ul className="m-0 list-none p-0">
                {shown.map((r) => {
                  const c = cargoOf(r)
                  const on = sel.has(r.id)
                  return (
                    <li key={r.id}>
                      <label className={`flex cursor-pointer items-center gap-3 border-b border-[#F6F7F9] px-5 py-2.5 ${on ? 'bg-[#F3F5FB]' : 'hover:bg-[#F8F9FB]'}`}>
                        <input type="checkbox" checked={on} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n })} className="h-3.5 w-3.5 accent-[#0A2472]" />
                        <span className="bk-mono w-[120px] shrink-0 text-[12px] text-[#0A2472]">{r.booking_ref}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{supplierOf(r)}</span>
                        <span className="bk-mono shrink-0 text-[11.5px] text-[#5B616E]">{fmtNum(c.pcs)} · {fmtNum(c.kg)} kg</span>
                        {r.consol_id && r.consol_id === m.consol_id ? <Tag tone="navy">Same consol</Tag> : r.consol_flight ? <Tag>{r.consol_flight}</Tag> : <Tag tone="amber">Unallocated</Tag>}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <div className="grid grid-cols-6 gap-3 px-5 py-4">
              {field('shipper_name', 'Supplier', 'col-span-4')}{field('shipper_contact', 'Contact', 'col-span-2')}
              {field('shipper_address', 'Address', 'col-span-4')}{field('shipper_city', 'City', 'col-span-2')}
              {field('shipper_phone', 'Phone', 'col-span-2')}{field('shipper_email', 'Email', 'col-span-4', 'email')}
              {field('pieces', 'Pieces', 'col-span-1', 'number')}{field('weight_kg', 'Kg', 'col-span-1', 'number')}{field('volume_m3', 'm³', 'col-span-1', 'number')}
              {field('cargo_ready_date', 'Ready', 'col-span-3', 'date')}
              {field('goods_description', 'Goods', 'col-span-4')}
              <div className="col-span-2 flex flex-col gap-1"><span className={lbl}>Collection</span>
                <select value={f.collection_mode} onChange={(e) => set('collection_mode')(e.target.value)} className={inp}>
                  <option value="pickup">UBF pickup</option><option value="dropoff">Supplier drop-off</option>
                </select>
              </div>
              <p className="col-span-6 m-0 text-[11.5px] text-[#6B7280]">Buyer, bill-to and flight come from the master. Book the pickup and send the SLI from the new tab.</p>
            </div>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-[#EEF0F3] px-5 py-3">
          <span className="flex-1 text-[11.5px] text-[#6B7280]">{tab === 'pick' ? `${sel.size} selected` : 'Creates a new HAWB under this master'}</span>
          <button type="button" className={btn} onClick={onClose}>Cancel</button>
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}>{busy ? 'Adding…' : tab === 'pick' ? 'Add to consol' : 'Create sub-HAWB'}</button>
        </footer>
      </div>
    </div>
  )
}
