import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import DateField from '@/components/DateField'
import { useStaffList } from '@/hooks/useStaffList'
import { awbOk, type AirConsol } from './eaTypes'
import { btn, btnPrimary, lbl } from './eaUi'
import { saveConsol } from './useEaBoard'

type Props = { consol?: AirConsol | null; dest?: string; onClose: () => void; onSaved: (id: string) => void }

const inp = 'h-[30px] w-full rounded-[7px] border border-[#E3E6EB] bg-white px-2 text-[12.5px] text-[#14161A] outline-none focus:border-[#0A2472] disabled:bg-[#F8F9FB]'
const nul = (s: string) => (s.trim() ? s.trim() : null)

/** Plan a new consol or edit one: flights, dates, MAWB, owner. Fixed overlay, so nothing clips it. */
export default function EaConsolDialog({ consol: c, dest, onClose, onSaved }: Props) {
  const { staff } = useStaffList()
  const locked = c?.status === 'exported' || c?.status === 'departed'
  const cut = c?.cutoff_at ? parseISO(c.cutoff_at) : null
  const [f, setF] = useState({
    destination: c?.destination ?? dest ?? 'NAN',
    flight_no: c?.flight_no ?? '',
    flight_date: c?.flight_date ?? null as string | null,
    cut_date: cut ? format(cut, 'yyyy-MM-dd') : null as string | null,
    cut_time: cut ? format(cut, 'HH:mm') : '14:00',
    transit_port: c?.transit_port ?? '',
    flight2_no: c?.flight2_no ?? '',
    flight2_date: c?.flight2_date ?? null as string | null,
    eta_date: c?.eta_date ?? null as string | null,
    mawb: c?.mawb ?? '',
    handled_by: c?.handled_by ?? '',
    notes: c?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const awbBad = f.mawb.trim() !== '' && !awbOk(f.mawb)

  async function save() {
    const flight = f.flight_no.toUpperCase().replace(/\s+/g, '')
    if (!flight || !f.flight_date) return toast.error('Flight and flight date are needed')
    if (!/^\d{1,2}:\d{2}$/.test(f.cut_time)) return toast.error('Cutoff time as HH:MM')
    setBusy(true)
    try {
      const mawb = nul(f.mawb)
      const id = await saveConsol(c?.id ?? null, {
        destination: f.destination.trim().toUpperCase(),
        airline: flight.slice(0, 2),
        flight_no: flight,
        flight_date: f.flight_date,
        cutoff_at: f.cut_date ? new Date(`${f.cut_date}T${f.cut_time.padStart(5, '0')}:00`).toISOString() : null,
        mawb,
        transit_port: nul(f.transit_port)?.toUpperCase() ?? null,
        flight2_no: nul(f.flight2_no)?.toUpperCase().replace(/\s+/g, '') ?? null,
        flight2_date: f.flight2_date,
        eta_date: f.eta_date,
        handled_by: f.handled_by || null,
        notes: nul(f.notes),
        status: mawb ? 'confirmed' : 'planned',
      })
      toast.success(c ? 'Consol saved' : `${flight} planned`)
      onSaved(id)
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,.22)] p-4" onClick={onClose}>
      <div role="dialog" aria-label={c ? `Edit consol ${c.flight_no}` : 'Plan consol'} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[600px] rounded-xl bg-white text-[12.5px] text-[#14161A] shadow-[0_24px_48px_rgba(15,23,42,.18)]">
        <header className="flex items-center justify-between border-b border-[#EEF0F3] px-5 py-3.5">
          <h2 className="m-0 text-[14px] font-semibold">{c ? <>Consol <span className="bk-mono">{c.flight_no}</span></> : `Plan consol · AKL → ${f.destination}`}</h2>
          <button type="button" aria-label="Close" title="Close" onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-[#5B616E] hover:bg-[#F2F4F7]"><X size={15} /></button>
        </header>
        <fieldset disabled={locked} className="m-0 grid grid-cols-6 gap-x-3 gap-y-3.5 border-0 px-5 py-4">
          <Field label="Destination" span={1}><input value={f.destination} onChange={(e) => set('destination')(e.target.value)} className={`${inp} bk-mono uppercase`} /></Field>
          <Field label="Flight" span={1}><input autoFocus={!c} value={f.flight_no} onChange={(e) => set('flight_no')(e.target.value)} placeholder="NZ952" className={`${inp} bk-mono uppercase`} /></Field>
          <Field label="Flight date" span={2}><DateField value={f.flight_date} onChange={set('flight_date')} width="100%" disabled={locked} /></Field>
          <Field label="ETA" span={2}><DateField value={f.eta_date} onChange={set('eta_date')} width="100%" disabled={locked} /></Field>

          <Field label="Cutoff date" span={2}><DateField value={f.cut_date} onChange={set('cut_date')} width="100%" disabled={locked} /></Field>
          <Field label="Cutoff time" span={1}><input value={f.cut_time} onChange={(e) => set('cut_time')(e.target.value)} className={`${inp} bk-mono`} /></Field>
          <Field label="Owner" span={3}>
            <select value={f.handled_by} onChange={(e) => set('handled_by')(e.target.value)} className={inp}>
              <option value="">Unassigned</option>
              {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
            </select>
          </Field>

          <Field label="Transit port" span={1}><input value={f.transit_port} onChange={(e) => set('transit_port')(e.target.value)} placeholder="—" className={`${inp} bk-mono uppercase`} /></Field>
          <Field label="Flight 2" span={1}><input value={f.flight2_no} onChange={(e) => set('flight2_no')(e.target.value)} placeholder="—" className={`${inp} bk-mono uppercase`} /></Field>
          <Field label="Flight 2 date" span={2}><DateField value={f.flight2_date} onChange={set('flight2_date')} width="100%" disabled={locked} /></Field>
          <Field label="MAWB" span={2} hint={awbBad ? 'Check digit looks wrong' : f.mawb ? 'Confirms the consol' : 'Add when airline confirms'} warn={awbBad}>
            <input value={f.mawb} onChange={(e) => set('mawb')(e.target.value)} placeholder="260-41886040" className={`${inp} bk-mono`} style={awbBad ? { borderColor: '#F79009' } : undefined} />
          </Field>

          <Field label="Notes" span={6}><textarea rows={2} value={f.notes} onChange={(e) => set('notes')(e.target.value)} className={`${inp} h-auto py-1.5`} /></Field>
        </fieldset>
        <footer className="flex items-center gap-2 border-t border-[#EEF0F3] px-5 py-3">
          {locked ? <span className="text-[11.5px] text-[#6B7280]">Exported to TradeWindow. Read only.</span> : null}
          <span className="flex-1" />
          <button type="button" className={btn} onClick={onClose}>{locked ? 'Close' : 'Cancel'}</button>
          {locked ? null : <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : c ? 'Save' : 'Plan consol'}</button>}
        </footer>
      </div>
    </div>
  )
}

const SPAN: Record<number, string> = { 1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 6: 'col-span-6' }

function Field({ label, span, hint, warn, children }: { label: string; span: number; hint?: string; warn?: boolean; children: ReactNode }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${SPAN[span]}`}>
      <span className={lbl}>{label}</span>
      {children}
      {hint ? <span className="text-[10.5px]" style={{ color: warn ? '#B54708' : '#98A2B3' }}>{hint}</span> : null}
    </label>
  )
}
