import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, ArchiveRestore, Building2, Check, Copy, DollarSign, Ship, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import MatchBadge from '@/features/importSea/cells/MatchBadge'
import { fmtBoardDate } from '@/features/importSea/importSeaBoardFormat'
import { fmtDate } from '@/utils/format'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { deleteBookingRecord, setBookingArchived } from './bookingRecordApi'
import CreditUsagePill from './CreditUsagePill'
import BookingTasksBell from './tasks/BookingTasksBell'
import type { PortConnectRouteContext } from './tracking/portConnectRouteContext'
import type { BookingRecord } from './bookingRecordTypes'

type Props = {
  booking: BookingRecord
  matched: boolean
  eta: string | null
  portConnectRoute?: PortConnectRouteContext | null
  backHref: string
  onArchivedChange: (archivedAt: string | null) => void
}

export default function BookingRecordHeader({
  booking,
  matched,
  eta,
  portConnectRoute,
  backHref,
  onArchivedChange,
}: Props) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const ref = booking.booking_ref?.trim() || '—'
  const archived = Boolean(booking.archived_at)

  async function copyRef() {
    if (!booking.booking_ref) return
    try {
      await navigator.clipboard.writeText(booking.booking_ref)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  async function toggleArchive() {
    setBusy(true)
    try {
      const at = await setBookingArchived(booking.id, !archived)
      onArchivedChange(at)
      toast.success(archived ? 'Booking unarchived' : 'Booking archived')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      await deleteBookingRecord(booking.id)
      toast.success('Booking deleted')
      navigate(backHref)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
      setBusy(false)
      setConfirmOpen(false)
    }
  }

  return (
    <header className="card booking-record-header booking-record-header--compact">
      <div className="booking-record-header__row">
        <span className="booking-record-header__ref-wrap">
          <span className="mono booking-record-header__ref">{ref}</span>
          <span className="booking-record-header__job-sub">CF Job {booking.job_no ?? '—'}</span>
        </span>
        {booking.booking_ref ? (
          <button
            type="button"
            className="master-bill-field__copy"
            onClick={() => void copyRef()}
            title="Copy ref"
          >
            <Copy size={13} />
          </button>
        ) : null}
        {copied ? <span className="master-bill-field__copied muted">Copied</span> : null}
        <MatchBadge matched={matched} />
        {archived ? (
          <span
            title="This booking is archived"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              background: '#FEE4E2',
              color: '#B42318',
            }}
          >
            <Archive size={11} /> Archived
          </span>
        ) : null}
        <span className="booking-record-header__sep" aria-hidden>·</span>
        <span className="booking-record-header__client">
          <Building2 size={13} className="booking-record-header__client-ico" />
          {booking.customer_name ?? '—'}
        </span>
        {(() => {
          const terms = (booking.account_terms ?? '').toLowerCase()
          if (terms === 'account') {
            return <span className="acct-ind acct-ind--acct" title="Credit account"><Check size={13} /></span>
          }
          if (terms === 'cod') {
            return <span className="acct-ind acct-ind--cod" title="COD — no credit account"><DollarSign size={13} /></span>
          }
          return null
        })()}

        <CreditUsagePill accountId={booking.account_id} />

        {matched && booking.customs_payment_type ? (
          <span
            className={`acct-pill ${booking.customs_payment_type === 'Broker' ? 'acct-pill--broker' : 'acct-pill--deferred'}`}
            title={booking.customs_payment_type === 'Broker'
              ? 'Broker — UBF pays Customs; collect GST/duty before release'
              : 'Deferred — customer pays NZ Customs directly'}
          >
            {booking.customs_payment_type}
          </span>
        ) : null}

        <span className="hdr-pill hdr-pill--eta" title="ETA">
          ETA <strong className="tabular-nums">{fmtBoardDate(eta)}</strong>
        </span>

        {portConnectRoute ? (
          <div className="route-lane" title={`${portConnectRoute.loadPort} → ${portConnectRoute.dischargePort}`}>
            <span className="route-lane__code">
              {portConnectRoute.loadPortCode ?? portConnectRoute.loadPort ?? '—'}
            </span>
            <span className="route-lane__line" aria-hidden />
            {portConnectRoute.transitPortCode ? (
              <>
                <span className="route-lane__code route-lane__code--transit">{portConnectRoute.transitPortCode}</span>
                <span className="route-lane__line" aria-hidden />
              </>
            ) : null}
            {portConnectRoute.vesselName || portConnectRoute.voyage ? (
              <span className="hdr-pill hdr-pill--vessel">
                <Ship size={12} />
                <span className="route-lane__vessel-txt">
                  {portConnectRoute.vesselName}
                  {portConnectRoute.voyage && portConnectRoute.voyage !== '—'
                    ? <> · <span className="mono">{portConnectRoute.voyage}</span></>
                    : null}
                </span>
              </span>
            ) : (
              <Ship size={13} className="route-lane__ship" aria-hidden />
            )}
            <span className="route-lane__line" aria-hidden />
            <span className="route-lane__code">
              {portConnectRoute.dischargePortCode ?? portConnectRoute.dischargePort ?? '—'}
            </span>
          </div>
        ) : null}
        {booking.erp_ref_confirmed_at ? (
          <>
            <span className="booking-record-header__sep" aria-hidden>·</span>
            <span className="muted booking-record-header__erp">
              ERP confirmed {fmtDate(booking.erp_ref_confirmed_at, true)}
            </span>
          </>
        ) : null}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <BookingTasksBell bookingId={booking.id} />
          <button
            type="button"
            className="master-bill-field__copy"
            onClick={() => void toggleArchive()}
            disabled={busy}
            title={archived ? 'Unarchive' : 'Archive'}
          >
            {archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
          </button>
          <button
            type="button"
            className="master-bill-field__copy"
            onClick={() => setConfirmOpen(true)}
            disabled={busy || matched}
            title={matched ? 'Linked to a live ERP shipment — archive instead' : 'Delete booking'}
            style={matched ? { opacity: 0.4, cursor: 'not-allowed' } : { color: '#b42318' }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!busy) setConfirmOpen(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete booking {ref}?</DialogTitle>
            <DialogDescription>
              This permanently removes the booking and its containers, documents, notes,
              tasks and tracking. This cannot be undone. To keep the record, archive it instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => void confirmDelete()}
              disabled={busy}
              style={{ background: '#b42318', color: '#fff' }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
