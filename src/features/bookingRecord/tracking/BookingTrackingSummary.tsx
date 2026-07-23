import { fmtShort } from '@/utils/format'
import { parseVesselFlight } from '@/utils/tracking'
import type { BookingRecord, BookingShipment } from '../bookingRecordTypes'

function lfdDaysUntil(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  d.setHours(12, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

function lfdChipClass(days: number | null): string {
  if (days == null) return 'booking-lfd-chip'
  if (days < 0) return 'booking-lfd-chip booking-lfd-chip--past'
  if (days <= 2) return 'booking-lfd-chip booking-lfd-chip--warn'
  return 'booking-lfd-chip booking-lfd-chip--ok'
}

function lfdChipLabel(days: number | null): string {
  if (days == null) return 'LFD —'
  if (days < 0) return `${Math.abs(days)}d past LFD`
  if (days === 0) return 'LFD today'
  return `${days}d to LFD`
}

type Props = {
  booking: BookingRecord
  shipment: BookingShipment | null
}

export default function BookingTrackingSummary({ booking, shipment }: Props) {
  const raw = shipment?.vessel_flight ?? booking.m_shipping_line
  const { vessel, voyage } = parseVesselFlight(raw)
  const etd = shipment?.etd ?? null
  const eta = shipment?.eta ?? booking.m_eta
  const lfd = booking.last_free_day
  const lfdDays = lfdDaysUntil(lfd)

  return (
    <div className="card booking-tracking-summary pad-inline">
      <div className="booking-tracking-summary__item">
        <span className="booking-tracking-summary__label">Vessel</span>
        <span className="booking-tracking-summary__value">{vessel}</span>
      </div>
      <div className="booking-tracking-summary__item">
        <span className="booking-tracking-summary__label">Voyage</span>
        <span className="booking-tracking-summary__value mono">{voyage}</span>
      </div>
      <div className="booking-tracking-summary__item">
        <span className="booking-tracking-summary__label">ETD</span>
        <span className="booking-tracking-summary__value mono">{fmtShort(etd)}</span>
      </div>
      <div className="booking-tracking-summary__item">
        <span className="booking-tracking-summary__label">ETA</span>
        <span className="booking-tracking-summary__value mono">{fmtShort(eta)}</span>
      </div>
      <div className="booking-tracking-summary__item">
        <span className="booking-tracking-summary__label">Last free day</span>
        <span className="booking-tracking-summary__value mono">{fmtShort(lfd)}</span>
      </div>
      <div className="booking-tracking-summary__item booking-tracking-summary__chip-wrap">
        <span className={lfdChipClass(lfdDays)}>{lfdChipLabel(lfdDays)}</span>
      </div>
    </div>
  )
}
