import { useEffect, useState } from 'react'
import { ClipboardCheck, FileText, Tag as TagIcon, Truck } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { supabase } from '@/supabase'
import ConsignmentDetailWindow from '@/features/tms/ConsignmentDetailWindow'
import LabelsModal from '@/features/tms/LabelsModal'
import ConsignmentNoteModal from '@/features/tms/ConsignmentNoteModal'
import CheckInSheetForm from '@/features/tms/CheckInSheetForm'
import { checkinSheetIdForConsignment } from '@/features/tms/checkinSheetApi'
import { openCheckinSheetPdf } from '@/features/tms/pdf/checkinPdf'
import { btn, Card, lbl } from './eaUi'
import { patchBooking, type EaDetail, type TmsJob } from './useEaBooking'

const when = (iso: string | null | undefined) => (iso ? format(parseISO(iso), 'EEE d MMM · HH:mm') : '—')
const docBtn = 'inline-flex h-[30px] w-auto items-center gap-1.5 rounded-[7px] border border-[#E3E6EB] bg-white px-2.5 text-[12px] font-medium text-[#14161A] hover:bg-[#F6F7F9] disabled:opacity-40'

type Props = { b: EaDetail; tms: TmsJob | null; onSaved: () => void; openTmsSignal?: number }

/** Pickup vs drop-off, the TMS job (popup), and its paperwork: labels, consignment note, check-in sheet. */
export default function EaMoveCard({ b, tms, onSaved, openTmsSignal }: Props) {
  const [busy, setBusy] = useState(false)
  const [tmsOpen, setTmsOpen] = useState(false)
  const [labels, setLabels] = useState(false)
  const [note, setNote] = useState(false)
  const [checkin, setCheckin] = useState(false)
  const [sheetId, setSheetId] = useState<string | null>(null)
  const mode = b.collection_mode ?? 'pickup'
  const checkedIn = !!(tms?.wms_checkin_at ?? b.wms_checkin_at)

  useEffect(() => { if (openTmsSignal && tms) setTmsOpen(true) }, [openTmsSignal, tms])
  useEffect(() => {
    if (tms?.id && tms.wms_checkin_at) void checkinSheetIdForConsignment(tms.id).then(setSheetId).catch(() => setSheetId(null))
    else setSheetId(null)
  }, [tms?.id, tms?.wms_checkin_at])

  async function setMode(m: 'pickup' | 'dropoff') {
    if (m === mode) return
    try { await patchBooking(b.id, { collection_mode: m }); onSaved() } catch (e) { toast.error((e as Error).message) }
  }

  async function bookPickup() {
    setBusy(true)
    const ready = b.cargo_ready_date ? new Date(`${b.cargo_ready_date}T10:00:00`).toISOString() : new Date().toISOString()
    const { error } = await supabase.rpc('booking_create_pickup', { p_booking: b.id, p_ready: ready })
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success('Pickup created in TMS')
    onSaved()
  }

  async function viewSheet() {
    if (!sheetId) return setCheckin(true)
    try { if (!(await openCheckinSheetPdf(sheetId))) toast.error('Check-in sheet not found') } catch (e) { toast.error((e as Error).message) }
  }

  const seg = (on: boolean) =>
    `w-auto rounded-[5px] border-0 px-2.5 py-1 text-[11.5px] ${on ? 'bg-white font-medium text-[#14161A] shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'bg-transparent text-[#5B616E]'}`

  return (
    <Card
      title="Pickup & warehouse"
      aside={
        <div role="radiogroup" aria-label="Collection" className="flex gap-0.5 rounded-[7px] bg-[#F2F4F7] p-0.5">
          <button type="button" role="radio" aria-checked={mode === 'pickup'} className={seg(mode === 'pickup')} onClick={() => void setMode('pickup')}>UBF pickup</button>
          <button type="button" role="radio" aria-checked={mode === 'dropoff'} className={seg(mode === 'dropoff')} onClick={() => void setMode('dropoff')}>Supplier drop-off</button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4 px-4 py-3.5 md:grid-cols-4">
        {mode === 'pickup' ? (
          <>
            <div className="flex flex-col gap-1">
              <span className={lbl}>TMS job</span>
              {tms
                ? <button type="button" onClick={() => setTmsOpen(true)} className="bk-mono w-auto self-start border-0 bg-transparent p-0 text-left text-[12.5px] text-[#0A2472] hover:underline">{tms.consignment_no ?? 'Open job'}</button>
                : <button type="button" className={`${btn} self-start`} disabled={busy} onClick={() => void bookPickup()}><Truck size={13} /> Book pickup</button>}
              {tms?.status ? <span className="text-[11px] capitalize text-[#6B7280]">{tms.status.replace(/_/g, ' ')}</span> : null}
            </div>
            <div className="flex flex-col gap-1"><span className={lbl}>Ready</span><span>{b.preferred_pickup_at ? when(b.preferred_pickup_at) : b.cargo_ready_date ? format(parseISO(b.cargo_ready_date), 'EEE d MMM') : '—'}</span></div>
            <div className="flex flex-col gap-1"><span className={lbl}>Collected</span><span>{when(tms?.picked_up_at ?? b.picked_up_at)}</span></div>
          </>
        ) : (
          <div className="col-span-2 flex flex-col gap-1 md:col-span-3">
            <span className={lbl}>Drop-off</span>
            <span>Supplier delivers to UBF Mangere, 173 Montgomerie Rd. No TMS job needed.</span>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className={lbl}>Checked in</span>
          <span>{checkedIn ? when(tms?.wms_checkin_at ?? b.wms_checkin_at) : b.act_pcs != null ? 'Yes' : <span className="text-[#98A2B3]">Waiting</span>}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[#F1F2F5] px-4 py-2.5">
        {mode === 'pickup' && b.pickup_address ? <span className="mr-auto truncate text-[12px] text-[#5B616E]">Pickup from {b.pickup_address}</span> : <span className="mr-auto" />}
        <button type="button" className={docBtn} disabled={!tms} onClick={() => setLabels(true)} title={tms ? 'Print or email labels' : 'Book the pickup first'}><TagIcon size={13} /> Labels</button>
        <button type="button" className={docBtn} disabled={!tms} onClick={() => setNote(true)} title={tms ? 'Consignment note' : 'Book the pickup first'}><FileText size={13} /> Consignment note</button>
        <button type="button" className={docBtn} disabled={!tms} onClick={() => void viewSheet()} title={sheetId ? 'View check-in sheet PDF' : 'Fill the check-in sheet'}>
          <ClipboardCheck size={13} /> {sheetId ? 'Check-in sheet' : 'Check in'}
        </button>
      </div>

      <ConsignmentDetailWindow id={tmsOpen && tms ? tms.id : null} onClose={() => { setTmsOpen(false); onSaved() }} />
      {tms ? (
        <>
          <LabelsModal id={tms.id} open={labels} onClose={() => setLabels(false)} />
          <ConsignmentNoteModal id={tms.id} open={note} onClose={() => setNote(false)} />
          <CheckInSheetForm open={checkin} consignmentId={tms.id} sheetId={sheetId} onClose={() => setCheckin(false)} onDone={() => { setCheckin(false); onSaved() }} />
        </>
      ) : null}
    </Card>
  )
}
