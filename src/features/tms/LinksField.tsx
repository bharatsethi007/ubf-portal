import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Package, Ship, X, Plus, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import type { TmsConsignmentDetail } from './tmsApi'
import { setBookingLink, clearBookingLink, setShipmentLink, clearShipmentLink, type BookingHit, type ShipmentHit } from './tmsLinkApi'
import LinkDialog from './LinkDialog'

export default function LinksField({ d, onChanged }: { d: TmsConsignmentDetail; onChanged: () => void }) {
  const [dialog, setDialog] = useState<'booking' | 'shipment' | null>(null)
  const [busy, setBusy] = useState(false)
  const bookingRef = d.booking?.booking_ref ?? (d.booking_id ? 'Booking' : null)
  const hasBooking = Boolean(d.booking_id)
  const hasShipment = d.job_unique != null
  const shipmentLabel = d.shipment_ref ?? (d.job_unique != null ? `#${d.job_unique}` : null)

  async function pickBooking(b: BookingHit) {
    setBusy(true)
    try { await setBookingLink(d.id, b.id); toast.success(`Linked ${b.booking_ref ?? 'booking'}`); setDialog(null); onChanged() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Link failed') } finally { setBusy(false) }
  }
  async function pickShipment(s: ShipmentHit) {
    setBusy(true)
    try { await setShipmentLink(d.id, s.job_unique, s.house_bill ?? null); toast.success(`Linked ${s.house_bill ?? 'shipment'}`); setDialog(null); onChanged() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Link failed') } finally { setBusy(false) }
  }
  async function unlink(kind: 'booking' | 'shipment') {
    setBusy(true)
    try { if (kind === 'booking') await clearBookingLink(d.id); else await clearShipmentLink(d.id); onChanged() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Unlink failed') } finally { setBusy(false) }
  }

  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Links</div>
      <div className="flex flex-col gap-1.5">
        {hasBooking ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <Package size={12} />
            <RouterLink to={`/bookings/${d.booking_id}`} className="inline-flex items-center gap-1 hover:underline">{bookingRef}<ExternalLink size={11} /></RouterLink>
            <button type="button" disabled={busy} onClick={() => unlink('booking')} className="ml-0.5 text-emerald-700/60 hover:text-emerald-900"><X size={12} /></button>
          </span>
        ) : (
          <button type="button" onClick={() => setDialog('booking')} className="inline-flex w-fit items-center gap-1 rounded border border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"><Plus size={12} /> Link booking</button>
        )}
        {hasShipment ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
            <Ship size={12} />
            <RouterLink to={`/shipments/${d.job_unique}`} className="inline-flex items-center gap-1 hover:underline">{shipmentLabel}<ExternalLink size={11} /></RouterLink>
            <button type="button" disabled={busy} onClick={() => unlink('shipment')} className="ml-0.5 text-sky-700/60 hover:text-sky-900"><X size={12} /></button>
          </span>
        ) : (
          <button type="button" onClick={() => setDialog('shipment')} className="inline-flex w-fit items-center gap-1 rounded border border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"><Plus size={12} /> Link shipment</button>
        )}
      </div>
      <LinkDialog kind={dialog} onClose={() => setDialog(null)} onPickBooking={pickBooking} onPickShipment={pickShipment} />
    </div>
  )
}
