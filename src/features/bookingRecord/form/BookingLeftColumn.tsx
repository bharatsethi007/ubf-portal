import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Link2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type {
  BookingRecord,
  BookingRecordPatch,
  StaffUser,
} from '../bookingRecordTypes'
import type { ContainerListItem } from '../containers/useBookingContainers'
import ShipmentLinkModal from '../link/ShipmentLinkModal'
import { unlinkBookingShipment } from '../link/shipmentLinkApi'
import CustomerField, { customerPickerValue } from './CustomerField'
import FormCard from './FormCard'
import StaffField from './StaffField'

type PatchFn = (ui: Partial<BookingRecord>, db: BookingRecordPatch) => void

type Props = {
  booking: BookingRecord
  staff: StaffUser[]
  containerRows: ContainerListItem[]
  onPatch: PatchFn
}

export default function BookingLeftColumn({ booking, staff, containerRows, onPatch }: Props) {
  const client = customerPickerValue(booking.account_id, booking.customer_name)
  const consignee = customerPickerValue(booking.consignee_account_id, booking.consignee_name)
  const importer = customerPickerValue(booking.importer_account_id, booking.importer_name)

  const [linkOpen, setLinkOpen] = useState(false)
  const [confirmUnsync, setConfirmUnsync] = useState(false)
  const [unsyncBusy, setUnsyncBusy] = useState(false)
  const synced = Boolean(booking.shipment_id)
  const prevConsignee = useRef(booking.consignee_account_id)

  useEffect(() => {
    if (booking.consignee_account_id && booking.consignee_account_id !== prevConsignee.current && !booking.shipment_id) {
      setLinkOpen(true)
    }
    prevConsignee.current = booking.consignee_account_id
  }, [booking.consignee_account_id, booking.shipment_id])

  async function doUnsync() {
    setUnsyncBusy(true)
    try {
      await unlinkBookingShipment(booking.id)
      onPatch({ shipment_id: null, erp_ref_confirmed_at: null }, {})
      toast.success('Shipment unlinked')
      setConfirmUnsync(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unlink failed')
    } finally {
      setUnsyncBusy(false)
    }
  }

  function patchCustomer(ui: Partial<BookingRecord>, db: BookingRecordPatch) {
    onPatch(ui, db)
  }

  return (
    <div className="booking-details-col">
      <FormCard title="Booking">
        <CustomerField
          label="Client"
          value={client}
          onChange={(c) =>
            patchCustomer(
              { account_id: c?.account_id ?? null, customer_name: c?.name ?? null },
              { account_id: c?.account_id ?? null },
            )
          }
        />
        <CustomerField
          label="Consignee"
          value={consignee}
          onChange={(c) =>
            patchCustomer(
              { consignee_account_id: c?.account_id ?? null, consignee_name: c?.name ?? null },
              { consignee_account_id: c?.account_id ?? null },
            )
          }
        />
        <CustomerField
          label="Importer"
          value={importer}
          onChange={(c) =>
            patchCustomer(
              { importer_account_id: c?.account_id ?? null, importer_name: c?.name ?? null },
              { importer_account_id: c?.account_id ?? null },
            )
          }
        />
        <label className="filter-field booking-form-field">
          <span className="filter-field__label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            CF Job #
            {synced ? (
              <button type="button" className="synced-pill" title="Click to unlink" onClick={() => setConfirmUnsync(true)}>
                <span className="synced-pill__on"><Check size={11} /> Synced</span>
                <span className="synced-pill__off"><X size={11} /> Unsync</span>
              </button>
            ) : (
              <button type="button" className="text-link" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }} onClick={() => setLinkOpen(true)}>
                <Link2 size={12} /> Link shipment
              </button>
            )}
          </span>
          <input
            type="text"
            className="input input--xs mono"
            defaultValue={booking.job_no ?? ''}
            key={booking.job_no ?? ''}
            onBlur={(e) => {
              const next = e.target.value.trim() || null
              if (next !== (booking.job_no?.trim() || null)) onPatch({ job_no: next }, { job_no: next })
            }}
          />
        </label>
        <label className="filter-field booking-form-field">
          <span className="filter-field__label">Mode</span>
          <input
            type="text"
            className="input input--xs"
            defaultValue={booking.mode ?? ''}
            onBlur={(e) => {
              const next = e.target.value.trim() || null
              if (next !== (booking.mode?.trim() || null)) onPatch({ mode: next }, { mode: next })
            }}
          />
        </label>
        <StaffField
          value={booking.handled_by}
          staff={staff}
          onChange={(userId) => onPatch({ handled_by: userId }, { handled_by: userId })}
        />
        <ShipmentLinkModal
          open={linkOpen}
          onOpenChange={setLinkOpen}
          bookingId={booking.id}
          accountId={booking.consignee_account_id}
          consigneeName={booking.consignee_name}
          expectedContainers={containerRows.map((r) => r.container_no).filter(Boolean)}
          onLinked={(jobUnique, jobNo) => onPatch({ shipment_id: jobUnique, job_no: jobNo != null ? String(jobNo) : null }, {})}
        />
        <Dialog open={confirmUnsync} onOpenChange={(o) => { if (!unsyncBusy) setConfirmUnsync(o) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} style={{ color: '#B54708' }} /> Unlink this shipment?
              </DialogTitle>
            </DialogHeader>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
              This detaches the booking from CF Job <strong>{booking.job_no ?? '—'}</strong> and its invoices will no longer show on this booking. You can re-link at any time.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmUnsync(false)} disabled={unsyncBusy}>Cancel</Button>
              <Button style={{ background: '#B42318', color: '#fff' }} onClick={() => void doUnsync()} disabled={unsyncBusy}>Unlink</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </FormCard>
    </div>
  )
}
