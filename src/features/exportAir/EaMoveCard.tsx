import { useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { supabase } from '@/supabase'
import { btn, Card, lbl } from './eaUi'
import { patchBooking, type EaDetail } from './useEaBooking'

const when = (iso: string | null) => (iso ? format(parseISO(iso), 'EEE d MMM · HH:mm') : '—')

/** Pickup vs supplier drop-off, TMS job and warehouse check-in. */
export default function EaMoveCard({ b, onSaved }: { b: EaDetail; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const mode = b.collection_mode ?? 'pickup'

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
              {b.tms_no
                ? <Link to={`/tms?search=${encodeURIComponent(b.tms_no)}`} className="bk-mono text-[12.5px] text-[#0A2472] hover:underline">{b.tms_no}</Link>
                : <button type="button" className={`${btn} self-start`} disabled={busy} onClick={() => void bookPickup()}>Book pickup</button>}
            </div>
            <div className="flex flex-col gap-1"><span className={lbl}>Ready</span><span>{b.preferred_pickup_at ? when(b.preferred_pickup_at) : b.cargo_ready_date ? format(parseISO(b.cargo_ready_date), 'EEE d MMM') : '—'}</span></div>
            <div className="flex flex-col gap-1"><span className={lbl}>Collected</span><span>{when(b.picked_up_at)}</span></div>
          </>
        ) : (
          <div className="col-span-2 flex flex-col gap-1 md:col-span-3">
            <span className={lbl}>Drop-off</span>
            <span>Supplier delivers to UBF Mangere, 173 Montgomerie Rd. No TMS job needed.</span>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className={lbl}>Checked in</span>
          <span>{b.wms_checkin_at ? when(b.wms_checkin_at) : b.act_pcs != null ? 'Yes' : <span className="text-[#98A2B3]">Waiting</span>}</span>
        </div>
      </div>
      {mode === 'pickup' && b.pickup_address ? (
        <div className="border-t border-[#F1F2F5] px-4 py-2.5 text-[12px] text-[#5B616E]">Pickup from {b.pickup_address}</div>
      ) : null}
    </Card>
  )
}
