import { useState } from 'react'
import { Copy } from 'lucide-react'
import MatchBadge from '@/features/importSea/cells/MatchBadge'
import { fmtBoardDate } from '@/features/importSea/importSeaBoardFormat'
import { fmtDate } from '@/utils/format'
import type { PortConnectRouteContext } from './tracking/portConnectRouteContext'
import type { BookingRecord } from '../bookingRecordTypes'

type Props = {
  booking: BookingRecord
  matched: boolean
  eta: string | null
  portConnectRoute?: PortConnectRouteContext | null
}

export default function BookingRecordHeader({
  booking,
  matched,
  eta,
  portConnectRoute,
}: Props) {
  const [copied, setCopied] = useState(false)
  const ref = booking.booking_ref?.trim() || '—'

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

  return (
    <header className="card booking-record-header booking-record-header--compact">
      <div className="booking-record-header__row">
        <span className="mono booking-record-header__ref">{ref}</span>
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
        <span className="booking-record-header__sep" aria-hidden>·</span>
        <span className="booking-record-header__client">{booking.customer_name ?? '—'}</span>
        <span className="booking-record-header__sep" aria-hidden>·</span>
        <span className="booking-record-header__meta">
          Job # <span className="mono">{booking.job_no ?? '—'}</span>
        </span>
        <span className="booking-record-header__sep" aria-hidden>·</span>
        <span className="booking-record-header__meta">
          ETA <span className="mono tabular-nums">{fmtBoardDate(eta)}</span>
        </span>
        {portConnectRoute ? (
          <>
            <span className="booking-record-header__sep" aria-hidden>·</span>
            <span className="booking-record-header__meta">
              Load port {portConnectRoute.loadPort}
            </span>
            <span className="booking-record-header__sep" aria-hidden>·</span>
            <span className="booking-record-header__meta">
              Discharge port {portConnectRoute.dischargePort}
            </span>
            <span className="booking-record-header__sep" aria-hidden>·</span>
            <span className="booking-record-header__meta">
              {portConnectRoute.vesselName}
            </span>
            <span className="booking-record-header__sep" aria-hidden>·</span>
            <span className="booking-record-header__meta">
              Voyage <span className="mono">{portConnectRoute.voyage}</span>
            </span>
          </>
        ) : null}
        {booking.erp_ref_confirmed_at ? (
          <>
            <span className="booking-record-header__sep" aria-hidden>·</span>
            <span className="muted booking-record-header__erp">
              ERP confirmed {fmtDate(booking.erp_ref_confirmed_at, true)}
            </span>
          </>
        ) : null}
      </div>
    </header>
  )
}
