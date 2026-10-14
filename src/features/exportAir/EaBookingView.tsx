import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import '@/features/bookingsWorkspace/bookingsTheme.css'
import { cargoOf, fmtNum, STAGE_LABELS } from './eaTypes'
import { btn, eaHref, Tag } from './eaUi'
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
import EaQuoteAttach from './progress/EaQuoteAttach'
import EaSliDialog from './progress/EaSliDialog'
import EaBcDialog from './bc/EaBcDialog'
import { viewCheckinSheet } from './progress/checkinSheet'
import EaConsolToggle from './master/EaConsolToggle'
import EaMasterCargo from './master/EaMasterCargo'
import EaMasterDocs from './master/EaMasterDocs'
import type { FamilyCtl } from './master/EaHawbShell'
import { firstMissing, masterAsHouse, masterMilestones, masterPlan, masterTotals, subPlan } from './eaMaster'
import { useEaSubExtras } from './useEaFamily'
import { AirlineMark, Route } from './eaVisual'

type Props = { bookingId: string; embedded?: boolean; onClose?: () => void; onChanged?: () => void; family?: FamilyCtl; tabs?: ReactNode }

/** Export Air booking (HAWB) record. Full page or inside the consol popup. */
export default function EaBookingView({ bookingId, embedded, onClose, onChanged, family, tabs }: Props) {
  const navigate = useNavigate()
  const { b, lines, threads, docs, hist, consols, tms, error, reload } = useEaBooking(bookingId)
  const [editing, setEditing] = useState(false)
  const [doc, setDoc] = useState<number | null>(null)
  const [tmsSignal, setTmsSignal] = useState(0)
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [sliOpen, setSliOpen] = useState(false)
  const [bcOpen, setBcOpen] = useState(false)
  const asMaster = !!b?.is_consolidation && family?.master?.id === b?.id
  const subs = asMaster ? family!.subs : []
  const extras = useEaSubExtras(subs)

  if (error) return <div className="bk-root p-6 text-[#B42318]">{error}</div>
  if (!b) return <div className="bk-root p-6 text-[#6B7280]">Loading…</div>

  const c = asMaster ? masterTotals(subs) : cargoOf(b)
  const inFamily = !!family?.master
  const allThreads = asMaster ? [...threads, ...extras.threads] : threads
  const allDocs = asMaster ? [...docs, ...extras.docs] : docs
  const jump = (what: 'pickup' | 'checkin' | 'sli' | 'any') => {
    const s = firstMissing(subs, what) ?? firstMissing(subs, 'any')
    if (s) family?.setActive(s.id); else toast.message('Nothing missing there')
  }
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
      else if (a === 'mail_supplier') return window.dispatchEvent(new CustomEvent('mail:open'))
      else if (a === 'attach_quote') return setQuoteOpen(true)
      else if (a === 'get_quote') { onClose?.(); navigate('/quotes/new'); return }
      else if (a === 'view_quote') { if (b!.quote_id) { onClose?.(); navigate(`/quotes/${b!.quote_id}`) } return }
      else if (a === 'open_sli') return setSliOpen(true)
      else if (a === 'view_checkin') { if (tms) await viewCheckinSheet(tms.id); return }
      else if (a === 'send_bc') return setBcOpen(true)
      else if (a === 'tab_pickup') return jump('pickup')
      else if (a === 'tab_checkin') return jump('checkin')
      else if (a === 'tab_sli') return jump('sli')
      else if (a === 'tab_first') return jump('any')
      else if (a === 'add_sub') return family?.openAdd()
      else if (a === 'tab_master') return family?.master && family.setActive(family.master.id)
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
      <nav aria-label="Back" className="mb-2 flex items-center gap-2 text-[12px] text-[#6B7280]">
        <button type="button" onClick={() => {
          if (embedded) return onClose?.()
          const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
          if (idx > 0) navigate(-1); else navigate('/bookings/export-air')
        }} className="inline-flex h-[26px] w-auto items-center gap-1.5 rounded-md border border-[#E3E6EB] bg-white px-2 text-[12px] font-medium text-[#14161A] hover:bg-[#F6F7F9]">
          <ArrowLeft size={13} /> Back
        </button>
        <Link to="/bookings/export-air" onClick={embedded ? onClose : undefined} className="text-[#6B7280] hover:underline">Export air</Link>
        {b.consol_id && b.consol_flight ? (<><span>/</span><Link to={`/bookings/export-air/consol/${b.consol_id}`} onClick={embedded ? onClose : undefined} className="bk-mono text-[#6B7280] hover:underline">{b.consol_flight}</Link></>) : null}
        {family?.master && family.master.id !== b.id ? (<><span>/</span><button type="button" onClick={() => family.setActive(family.master!.id)} className="bk-mono w-auto border-0 bg-transparent p-0 text-[12px] text-[#6B7280] hover:underline">{family.master.booking_ref}</button></>) : null}
        <span>/</span><span className="bk-mono text-[#14161A]">{b.booking_ref}</span>
      </nav>

      {tabs}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="bk-mono m-0 text-[19px] font-medium tracking-[-0.02em]">{b.booking_ref}</h1>
            <Tag tone={tone}>{STAGE_LABELS[b.stage]}</Tag>
            <Tag><Route dest={b.destination} /></Tag>
            {b.is_dg ? <Tag tone="red">DG</Tag> : null}
            {asMaster ? <Tag tone="navy">Main HAWB · {subs.length} supplier{subs.length === 1 ? '' : 's'}</Tag> : inFamily ? <Tag tone="amber">Sub-HAWB of {family!.master!.booking_ref}</Tag> : null}
            {b.consol_flight ? <Tag tone="navy"><span className="inline-flex items-center gap-1"><AirlineMark flight={b.consol_flight} size={12} />{b.consol_flight}</span></Tag> : null}
          </div>
          <div className="text-[12.5px] text-[#5B616E]">
            {asMaster ? (b.shipper_name ?? 'Various Shippers') : b.shipper_code_name ?? b.shipper_name ?? 'Shipper?'} → <span className="font-medium text-[#14161A]">{b.consignee_code_name ?? b.consignee_name ?? 'Consignee?'}</span>
            {b.consignee_city ? `, ${b.consignee_city}` : ''} · {fmtNum(c.pcs)} pcs · {fmtNum(c.kg)} kg
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {family ? (
            <EaConsolToggle mode={asMaster ? 'master' : inFamily ? 'sub' : 'none'} masterRef={family.master?.booking_ref} disabled={locked}
              onMake={() => void family.make()} onAdd={family.openAdd} onRemove={() => void family.remove(b.id)}
              onDissolve={() => void family.dissolve()} onOpenMaster={() => family.master && family.setActive(family.master.id)} />
          ) : null}
          <button type="button" className={btn} title="Edit all fields" disabled={locked} onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>
          {embedded ? (
            <>
              <Link to={eaHref(b.id)} onClick={onClose} className={btn} title="Open full page"><ExternalLink size={13} /> Full page</Link>
              <button type="button" aria-label="Close" title="Close" onClick={onClose} className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border-0 bg-transparent text-[#5B616E] hover:bg-[#F2F4F7]"><X size={16} /></button>
            </>
          ) : null}
        </div>
      </div>

      <EaProgressPanel b={b} tms={tms} best={best} onAction={(a) => void act(a)} onChanged={() => void changed()}
        milestones={asMaster ? masterMilestones(b, subs) : undefined}
        plan={asMaster ? masterPlan(b, subs) : inFamily ? subPlan(b, tms, family!.master!) : undefined} />
      {inFamily && !asMaster ? (
        <p className="m-0 mt-2 rounded-lg bg-[#F5F7FC] px-3 py-2 text-[12px] text-[#475467]">
          Supplier tab of <button type="button" onClick={() => family!.setActive(family!.master!.id)} className="bk-mono w-auto border-0 bg-transparent p-0 text-[12px] font-medium text-[#0A2472] hover:underline">{family!.master!.booking_ref}</button>.
          Buyer, bill-to and flight follow the main HAWB. TradeWindow codes are only needed on the main HAWB; here you handle pickup, check-in, SLI and documents.
        </p>
      ) : null}

      {b.stage < 0 ? (
        <div className="flex justify-end">
          <button type="button" className="w-auto border-0 bg-transparent p-0 text-[11.5px] text-[#B42318] hover:underline"
            onClick={() => void patchBooking(b.id, { status: 'rejected' }).then(changed).then(() => toast.success('Booking rejected'))}>Reject this draft</button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
          <div id="ea-parties"><EaPartiesCard b={b} onSaved={() => void changed()} /></div>
          {asMaster ? (
            <>
              <EaMasterCargo b={b} subs={subs} onTab={(id) => family?.setActive(id)} />
              <div id="ea-move"><EaMasterDocs masterRef={b.booking_ref} subs={subs} tms={extras.tms} onTab={(id) => family?.setActive(id)} /></div>
            </>
          ) : (
            <>
              <EaCargoCard b={b} lines={lines} />
              <div id="ea-move"><EaMoveCard b={b} tms={tms} onSaved={() => void changed()} openTmsSignal={tmsSignal} /></div>
            </>
          )}
          {inFamily && !asMaster ? null : <EaExportCard b={asMaster ? masterAsHouse(b, subs) : b} />}
        </div>
        <EaSideRail b={b} threads={allThreads} docs={allDocs} hist={hist} onSaved={() => void changed()} onOpenDoc={setDoc} activeDoc={doc} />
      </div>
      {embedded ? null : <EaMailBubble bookingId={b.id} bookingRef={b.booking_ref} onChanged={() => void changed()} />}
      {editing ? <EaEditPanel b={b} onClose={() => setEditing(false)} onSaved={() => void changed()} /> : null}
      {quoteOpen ? <EaQuoteAttach bookingId={b.id} hint={b.consignee_code_name ?? b.consignee_name ?? b.shipper_name ?? ''} onClose={() => setQuoteOpen(false)} onDone={() => { setQuoteOpen(false); void changed() }} /> : null}
      {sliOpen ? <EaSliDialog bookingId={b.id} isConsolidation={!!b.is_consolidation && !asMaster} onClose={() => { setSliOpen(false); void changed() }} /> : null}
      {bcOpen ? <EaBcDialog b={asMaster ? masterAsHouse(b, subs) : b} consol={consols.find((x) => x.id === b.consol_id)} onClose={() => setBcOpen(false)} onSent={() => void changed()} /> : null}
      {doc != null ? <EaDocViewer docs={allDocs} index={doc} onIndex={setDoc} onClose={() => setDoc(null)} /> : null}
    </div>
  )
}
