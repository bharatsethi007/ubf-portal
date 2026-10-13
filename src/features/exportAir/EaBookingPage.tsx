import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import '@/features/bookingsWorkspace/bookingsTheme.css'
import { cargoOf, fmtNum, STAGE_LABELS } from './eaTypes'
import { Avatar, btn, btnPrimary, Tag } from './eaUi'
import { allocateBookings } from './useEaBoard'
import { useEaBooking } from './useEaBooking'
import EaLifecycle from './EaLifecycle'
import EaPartiesCard from './EaPartiesCard'
import EaCargoCard from './EaCargoCard'
import EaMoveCard from './EaMoveCard'
import EaExportCard from './EaExportCard'
import EaSideRail from './EaSideRail'
import EaEditPanel from './EaEditPanel'
import EaMailBubble from './mail/EaMailBubble'
import { patchBooking } from './useEaBooking'

/** Export Air booking record: one page, one next action, nothing typed twice. */
export default function EaBookingPage() {
  const { bookingId } = useParams()
  const { b, lines, threads, docs, hist, consols, error, reload } = useEaBooking(bookingId)
  const [editing, setEditing] = useState(false)

  if (error) return <div className="bk-root p-6 text-[#B42318]">{error}</div>
  if (!b) return <div className="bk-root p-6 text-[#6B7280]">Loading…</div>

  const c = cargoOf(b)
  const open = consols.filter((x) => !['exported', 'departed', 'closed', 'cancelled'].includes(x.status))
  const best = open.find((x) => !x.cutoff_at || Date.parse(x.cutoff_at) > Date.now()) ?? open[0]
  const locked = b.consol_status === 'exported' || b.consol_status === 'departed'
  const tone = b.urgency === 'overdue' ? 'red' : b.stage >= 4 ? 'green' : 'navy'

  async function setStatus(status: 'confirmed' | 'rejected') {
    try { await patchBooking(b!.id, { status }); toast.success(status === 'confirmed' ? 'Booking confirmed' : 'Booking rejected'); await reload() } catch (e) { toast.error((e as Error).message) }
  }

  async function allocate(id: string | null) {
    try { await allocateBookings([b!.id], id); toast.success(id ? 'Allocated' : 'Unallocated'); await reload() } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="bk-root mx-auto w-full max-w-[1440px] bg-white text-[12.5px] text-[#14161A]">
      <div className="text-[12px] text-[#6B7280]">
        <Link to="/bookings/export-air" className="text-[#6B7280] hover:underline">Export air</Link>
        <span className="mx-1">/</span><span className="bk-mono text-[#14161A]">{b.booking_ref}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="bk-mono m-0 text-[19px] font-medium tracking-[-0.02em]">{b.booking_ref}</h1>
            <Tag tone={tone}>{STAGE_LABELS[b.stage]}</Tag>
            <Tag>AKL → {(b.destination || 'NAN').toUpperCase()}</Tag>
            {b.is_dg ? <Tag tone="red">DG</Tag> : null}
            {b.is_consolidation ? <Tag tone="amber">Buyers consol</Tag> : null}
          </div>
          <div className="text-[12.5px] text-[#5B616E]">
            {b.shipper_code_name ?? b.shipper_name ?? 'Shipper?'} → <span className="font-medium text-[#14161A]">{b.consignee_code_name ?? b.consignee_name ?? 'Consignee?'}</span>
            {b.consignee_city ? `, ${b.consignee_city}` : ''} · {fmtNum(c.pcs)} pcs · {fmtNum(c.kg)} kg
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1.5 flex items-center gap-1.5 text-[12px] text-[#5B616E]"><Avatar initials={b.owner_initials} title={b.owner_name} />{b.owner_name ?? 'Unassigned'}</span>
          <button type="button" className={btn} title="Edit all fields" disabled={locked} onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>
        </div>
      </div>

      <EaLifecycle b={b} />

      {b.stage < 0 ? (
        <Strip bg="#FFFAEB" dot="#F79009">
          <span><b className="font-semibold">Draft from {b.source === 'customer_portal' ? 'portal' : b.source.startsWith('email') ? 'email' : 'manual entry'}.</b>{' '}
            <span className="text-[#5B616E]">Check the fields below, fix anything with Edit, then confirm.</span></span>
          <div className="ml-auto flex gap-2">
            <button type="button" className={btn} onClick={() => void setStatus('rejected')}>Reject</button>
            <button type="button" className={btnPrimary} onClick={() => void setStatus('confirmed')}>Confirm booking</button>
          </div>
        </Strip>
      ) : locked ? (
        <Strip bg="#F2F4F7" dot="#98A2B3">
          <b className="font-semibold">In TradeWindow.</b> <span className="text-[#475467]">Locked. Changes now happen in TradeWindow and sync back.</span>
        </Strip>
      ) : b.consol_id ? (
        <Strip bg="#ECFDF3" dot="#17B26A">
          <b className="font-semibold">On {b.consol_flight} · {b.consol_date ? format(parseISO(b.consol_date), 'EEE d MMM') : ''}.</b>{' '}
          <span className="text-[#475467]">Goes to TradeWindow when the consol closes.</span>
          <button type="button" className="ml-auto w-auto border-0 bg-transparent p-0 text-[11.5px] font-medium text-[#0A2472] hover:underline" onClick={() => void allocate(null)}>Unallocate</button>
        </Strip>
      ) : (
        <Strip bg="#F3F5FB" dot={b.urgency === 'overdue' ? '#D92D20' : '#F79009'}>
          <span><b className="font-semibold">Next: {b.next_action.toLowerCase()}.</b>{' '}
            {best && b.stage >= 2 ? <span className="text-[#5B616E]">Best match <span className="bk-mono text-[#14161A]">{best.flight_no}</span> {format(parseISO(best.flight_date), 'EEE d MMM')}
              {best.cutoff_at ? `, cutoff ${format(parseISO(best.cutoff_at), 'EEE HH:mm')}` : ''}. {best.houses} houses, {fmtNum(best.chg_kg)} kg on it.</span> : null}
          </span>
          {open.length ? (
            <div className="ml-auto flex gap-2">
              {open.length > 1 ? (
                <select aria-label="Other consol" defaultValue="" className={btn} onChange={(e) => e.target.value && void allocate(e.target.value)}>
                  <option value="">Other consol…</option>
                  {open.map((x) => <option key={x.id} value={x.id}>{x.flight_no} · {format(parseISO(x.flight_date), 'EEE d')}</option>)}
                </select>
              ) : null}
              {best ? <button type="button" className={btnPrimary} onClick={() => void allocate(best.id)}>Allocate to {best.flight_no}</button> : null}
            </div>
          ) : <span className="ml-auto text-[11.5px] text-[#6B7280]">No consol planned for this lane</span>}
        </Strip>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
          <EaPartiesCard b={b} onSaved={() => void reload()} />
          <EaCargoCard b={b} lines={lines} />
          <EaMoveCard b={b} onSaved={() => void reload()} />
          <EaExportCard b={b} />
        </div>
        <EaSideRail b={b} threads={threads} docs={docs} hist={hist} onSaved={() => void reload()} />
      </div>
      <EaMailBubble bookingId={b.id} bookingRef={b.booking_ref} onChanged={() => void reload()} />
      {editing ? <EaEditPanel b={b} onClose={() => setEditing(false)} onSaved={() => void reload()} /> : null}
    </div>
  )
}

function Strip({ bg, dot, children }: { bg: string; dot: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-[10px] px-3.5 py-2.5 text-[12.5px]" style={{ background: bg }}>
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
      {children}
    </div>
  )
}
