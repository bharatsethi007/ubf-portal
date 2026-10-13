import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ExternalLink, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import '@/features/bookingsWorkspace/bookingsTheme.css'
import { cargoOf, fmtNum, STAGE_LABELS } from './eaTypes'
import { Avatar, btn, eaHref, Tag } from './eaUi'
import { allocateBookings } from './useEaBoard'
import { patchBooking, useEaBooking } from './useEaBooking'
import EaProgressPanel from './progress/EaProgressPanel'
import type { EaAction } from './progress/eaProgress'
import EaPartiesCard from './EaPartiesCard'
import EaCargoCard from './EaCargoCard'
import EaMoveCard from './EaMoveCard'
import EaExportCard from './EaExportCard'
import EaSideRail from './EaSideRail'
import EaEditPanel from './EaEditPanel'
import EaDocViewer from './EaDocViewer'
import EaMailBubble from './mail/EaMailBubble'

type Props = { bookingId: string; embedded?: boolean; onClose?: () => void; onChanged?: () => void }

/** Export Air booking (HAWB) record. Full page or inside the consol popup. */
export default function EaBookingView({ bookingId, embedded, onClose, onChanged }: Props) {
  const navigate = useNavigate()
  const { b, lines, threads, docs, hist, consols, tms, error, reload } = useEaBooking(bookingId)
  const [editing, setEditing] = useState(false)
  const [doc, setDoc] = useState<number | null>(null)
  const [tmsSignal, setTmsSignal] = useState(0)

  if (error) return <div className="bk-root p-6 text-[#B42318]">{error}</div>
  if (!b) return <div className="bk-root p-6 text-[#6B7280]">Loading…</div>

  const c = cargoOf(b)
  const open = consols.filter((x) => !['exported', 'departed', 'closed', 'cancelled'].includes(x.status))
  const best = open.find((x) => !x.cutoff_at || Date.parse(x.cutoff_at) > Date.now()) ?? open[0]
  const locked = b.consol_status === 'exported' || b.consol_status === 'departed'
  const tone = b.urgency === 'overdue' ? 'red' : b.stage >= 4 ? 'green' : 'navy'
  const changed = async () => { await reload(); onChanged?.() }

  async function act(a: EaAction) {
    try {
      if (a === 'confirm') { await patchBooking(b!.id, { status: 'confirmed' }); toast.success('Booking confirmed') }
      else if (a === 'edit') return setEditing(true)
      else if (a === 'match') return document.getElementById('ea-parties')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else if (a === 'book_pickup') return document.getElementById('ea-move')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else if (a === 'open_tms') return setTmsSignal((n) => n + 1)
      else if (a === 'mail_supplier') return window.dispatchEvent(new CustomEvent('ea-mail:open'))
      else if (a === 'allocate' && best) { await allocateBookings([b!.id], best.id); toast.success(`Allocated to ${best.flight_no}`) }
      else if (a === 'open_consol') {
        const id = b!.consol_id ?? best?.id
        if (id) { onClose?.(); navigate(`/bookings/export-air/consol/${id}`) }
        return
      }
      await changed()
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="bk-root mx-auto w-full max-w-[1440px] bg-white text-[12.5px] text-[#14161A]" style={doc != null ? { paddingRight: 'min(780px, 48vw)' } : undefined}>
      {embedded ? null : (
        <div className="text-[12px] text-[#6B7280]">
          <Link to="/bookings/export-air" className="text-[#6B7280] hover:underline">Export air</Link>
          <span className="mx-1">/</span><span className="bk-mono text-[#14161A]">{b.booking_ref}</span>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="bk-mono m-0 text-[19px] font-medium tracking-[-0.02em]">{b.booking_ref}</h1>
            <Tag tone={tone}>{STAGE_LABELS[b.stage]}</Tag>
            <Tag>AKL → {(b.destination || 'NAN').toUpperCase()}</Tag>
            {b.is_dg ? <Tag tone="red">DG</Tag> : null}
            {b.is_consolidation ? <Tag tone="amber">Buyers consol</Tag> : null}
            {b.consol_flight ? <Tag tone="navy">{b.consol_flight}</Tag> : null}
          </div>
          <div className="text-[12.5px] text-[#5B616E]">
            {b.shipper_code_name ?? b.shipper_name ?? 'Shipper?'} → <span className="font-medium text-[#14161A]">{b.consignee_code_name ?? b.consignee_name ?? 'Consignee?'}</span>
            {b.consignee_city ? `, ${b.consignee_city}` : ''} · {fmtNum(c.pcs)} pcs · {fmtNum(c.kg)} kg
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1.5 flex items-center gap-1.5 text-[12px] text-[#5B616E]"><Avatar initials={b.owner_initials} title={b.owner_name} />{b.owner_name ?? 'Unassigned'}</span>
          <button type="button" className={btn} title="Edit all fields" disabled={locked} onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>
          {embedded ? (
            <>
              <Link to={eaHref(b.id)} onClick={onClose} className={btn} title="Open full page"><ExternalLink size={13} /> Full page</Link>
              <button type="button" aria-label="Close" title="Close" onClick={onClose} className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border-0 bg-transparent text-[#5B616E] hover:bg-[#F2F4F7]"><X size={16} /></button>
            </>
          ) : null}
        </div>
      </div>

      <EaProgressPanel b={b} best={best} onAction={(a) => void act(a)} onChanged={() => void changed()} />

      {b.stage < 0 ? (
        <div className="flex justify-end">
          <button type="button" className="w-auto border-0 bg-transparent p-0 text-[11.5px] text-[#B42318] hover:underline"
            onClick={() => void patchBooking(b.id, { status: 'rejected' }).then(changed).then(() => toast.success('Booking rejected'))}>Reject this draft</button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
          <div id="ea-parties"><EaPartiesCard b={b} onSaved={() => void changed()} /></div>
          <EaCargoCard b={b} lines={lines} />
          <div id="ea-move"><EaMoveCard b={b} tms={tms} onSaved={() => void changed()} openTmsSignal={tmsSignal} /></div>
          <EaExportCard b={b} />
        </div>
        <EaSideRail b={b} threads={threads} docs={docs} hist={hist} onSaved={() => void changed()} onOpenDoc={setDoc} activeDoc={doc} />
      </div>
      {embedded ? null : <EaMailBubble bookingId={b.id} bookingRef={b.booking_ref} onChanged={() => void changed()} />}
      {editing ? <EaEditPanel b={b} onClose={() => setEditing(false)} onSaved={() => void changed()} /> : null}
      {doc != null ? <EaDocViewer docs={docs} index={doc} onIndex={setDoc} onClose={() => setDoc(null)} /> : null}
    </div>
  )
}
