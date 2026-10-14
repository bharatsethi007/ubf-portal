import { useState } from 'react'
import { ClipboardCheck, Download, FileText, LayoutList, Loader2, Rows3, Tag as TagIcon, Truck, Warehouse } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import LabelsModal from '@/features/tms/LabelsModal'
import ConsignmentNoteModal from '@/features/tms/ConsignmentNoteModal'
import { Card } from '../eaUi'
import { supplierOf } from '../eaMaster'
import { buildMasterPack, type PackPart } from '../eaMasterPack'
import { viewCheckinSheet } from '../progress/checkinSheet'
import type { EaRow } from '../eaTypes'
import type { TmsJob } from '../useEaBooking'

type Props = { masterRef: string; subs: EaRow[]; tms: Map<string, TmsJob>; onTab: (id: string) => void }

const KEY = 'ea.masterdocs.view'
const pill = 'inline-flex h-[24px] w-auto items-center gap-1 rounded-full border border-[#E3E6EB] bg-white px-2 text-[11px] font-medium text-[#14161A] hover:border-[#0A2472] hover:text-[#0A2472] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E3E6EB] disabled:hover:text-[#14161A]'
const when = (iso: string | null | undefined) => (iso ? format(parseISO(iso), 'EEE d MMM HH:mm') : null)

/** Every supplier's TMS job, labels, consignment note and check-in sheet. Compact chips or a full list; one-click pack PDF. */
export default function EaMasterDocs({ masterRef, subs, tms, onTab }: Props) {
  const [view, setView] = useState<'compact' | 'list'>(() => { try { return (localStorage.getItem(KEY) as 'list') || 'compact' } catch { return 'compact' } })
  const [labels, setLabels] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [parts, setParts] = useState<PackPart[]>(['labels', 'note', 'checkin'])
  const [busy, setBusy] = useState(false)
  const pick = (v: 'compact' | 'list') => { setView(v); try { localStorage.setItem(KEY, v) } catch { /* ignore */ } }

  const jobs = subs.filter((s) => tms.has(s.id)).length
  const ins = subs.filter((s) => tms.get(s.id)?.wms_checkin_at || s.act_pcs != null).length

  async function downloadAll() {
    if (!parts.length) return toast.error('Pick at least one document type')
    setBusy(true)
    try {
      const map = new Map([...tms].map(([k, v]) => [k, v.id]))
      const { blob, fileName, entries } = await buildMasterPack(masterRef, subs, map, parts)
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; a.click()
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      const gaps = entries.filter((e) => e.missing.length).length
      toast.success(gaps ? `Pack downloaded. ${gaps} supplier${gaps > 1 ? 's' : ''} with gaps, see the index page.` : 'Pack downloaded')
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  const docButtons = (s: EaRow) => {
    const t = tms.get(s.id)
    const inAt = t?.wms_checkin_at
    return (
      <>
        <button type="button" className={pill} disabled={!t} onClick={() => t && setLabels(t.id)} title={t ? 'Labels' : 'No TMS job yet'}><TagIcon size={11} /> Labels</button>
        <button type="button" className={pill} disabled={!t} onClick={() => t && setNote(t.id)} title={t ? 'Consignment note' : 'No TMS job yet'}><FileText size={11} /> Note</button>
        <button type="button" className={pill} disabled={!inAt} onClick={() => t && void viewCheckinSheet(t.id)} title={inAt ? 'Check-in sheet' : 'Not checked in yet'}><ClipboardCheck size={11} /> Check-in</button>
      </>
    )
  }

  const seg = (on: boolean) => `inline-flex h-[24px] w-auto items-center gap-1 rounded-[5px] border-0 px-2 text-[11.5px] ${on ? 'bg-white font-medium text-[#14161A] shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'bg-transparent text-[#5B616E]'}`
  const chip = (k: PackPart, t: string) => (
    <label className="inline-flex cursor-pointer items-center gap-1 text-[11.5px] text-[#5B616E]">
      <input type="checkbox" className="h-3 w-3 accent-[#0A2472]" checked={parts.includes(k)} onChange={() => setParts((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))} />{t}
    </label>
  )

  return (
    <Card title="Pickups, labels & check-ins"
      aside={
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded-[7px] bg-[#F2F4F7] p-0.5">
            <button type="button" className={seg(view === 'compact')} onClick={() => pick('compact')}><Rows3 size={12} /> Compact</button>
            <button type="button" className={seg(view === 'list')} onClick={() => pick('list')}><LayoutList size={12} /> List</button>
          </div>
        </div>
      }>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#F1F2F5] px-4 py-2 text-[12px] text-[#5B616E]">
        <span><Truck size={12} className="mr-1 inline" />{jobs} of {subs.length} TMS jobs</span>
        <span><Warehouse size={12} className="mr-1 inline" />{ins} of {subs.length} checked in</span>
        <span className="ml-auto flex items-center gap-3">
          {chip('labels', 'Labels')}{chip('note', 'Notes')}{chip('checkin', 'Check-ins')}
          <button type="button" onClick={() => void downloadAll()} disabled={busy || !jobs}
            className="inline-flex h-[28px] w-auto items-center gap-1.5 rounded-[7px] border border-[#0A2472] bg-[#0A2472] px-2.5 text-[12px] font-medium text-white hover:bg-[#081C5A] disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download all
          </button>
        </span>
      </div>

      {view === 'compact' ? (
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {subs.map((s) => {
            const t = tms.get(s.id)
            return (
              <div key={s.id} className="flex items-center gap-1.5 rounded-lg border border-[#EEF0F3] bg-[#FCFCFD] py-1 pl-2.5 pr-1.5">
                <button type="button" onClick={() => onTab(s.id)} className="max-w-[160px] truncate border-0 bg-transparent p-0 text-[12px] font-medium text-[#14161A] hover:underline" title={`${supplierOf(s)} · ${s.booking_ref}`}>{supplierOf(s)}</button>
                <span className={`h-1.5 w-1.5 rounded-full ${t?.wms_checkin_at || s.act_pcs != null ? 'bg-[#17B26A]' : t ? 'bg-[#F79009]' : 'bg-[#D0D5DD]'}`} title={t?.wms_checkin_at ? 'Checked in' : t ? 'Pickup booked' : 'No TMS job'} />
                {docButtons(s)}
              </div>
            )
          })}
          {!subs.length ? <span className="text-[12px] text-[#6B7280]">No sub-HAWBs yet.</span> : null}
        </div>
      ) : (
        <table className="w-full border-collapse text-[12.5px]">
          <thead><tr className="border-b border-[#F1F2F5] text-left text-[10.5px] uppercase tracking-[.04em] text-[#6B7280]">
            <th className="px-4 py-2 font-medium">Supplier</th><th className="px-3 py-2 font-medium">TMS job</th><th className="px-3 py-2 font-medium">Collected</th><th className="px-3 py-2 font-medium">Checked in</th><th className="px-3 py-2 font-medium">Documents</th>
          </tr></thead>
          <tbody>
            {subs.map((s) => {
              const t = tms.get(s.id)
              return (
                <tr key={s.id} className="border-b border-[#F6F7F9] last:border-0">
                  <td className="px-4 py-2"><button type="button" onClick={() => onTab(s.id)} className="border-0 bg-transparent p-0 text-left font-medium text-[#14161A] hover:underline">{supplierOf(s)}</button><div className="bk-mono text-[11px] text-[#6B7280]">{s.booking_ref}</div></td>
                  <td className="bk-mono px-3 py-2 text-[12px]">{t?.consignment_no ?? <span className="text-[#98A2B3]">{s.collection_mode === 'dropoff' ? 'Drop-off' : 'Not booked'}</span>}</td>
                  <td className="px-3 py-2 text-[12px]">{when(t?.picked_up_at) ?? <span className="text-[#98A2B3]">—</span>}</td>
                  <td className="px-3 py-2 text-[12px]">{when(t?.wms_checkin_at) ?? (s.act_pcs != null ? 'Yes' : <span className="text-[#98A2B3]">Waiting</span>)}</td>
                  <td className="px-3 py-2"><span className="flex flex-wrap gap-1">{docButtons(s)}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <LabelsModal id={labels} open={!!labels} onClose={() => setLabels(null)} />
      <ConsignmentNoteModal id={note} open={!!note} onClose={() => setNote(null)} />
    </Card>
  )
}
