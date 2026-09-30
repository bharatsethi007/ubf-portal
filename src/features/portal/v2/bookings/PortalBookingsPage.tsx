import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, MessageSquare, Plane, Plus, Ship } from 'lucide-react'
import { usePorts } from '../../../../hooks/usePorts'
import { detailPath, fmtDay, fmtNum, placeName, shortCode, titleCase } from '../homeModel'
import { bookingModeLabel, listPortalBookings, STATUS_LABEL, STATUS_TONE, type PortalBooking, type PortalBookingStatus } from './bookingsApi'

type Filter = 'all' | PortalBookingStatus
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'requested', label: 'Requested' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_erp', label: 'Shipment created' },
  { key: 'declined', label: 'Declined' },
]

export default function PortalBookingsPage() {
  const { ports } = usePorts()
  const [rows, setRows] = useState<PortalBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    listPortalBookings().then(setRows).catch((e) => setError(e instanceof Error ? e.message : 'Could not load bookings')).finally(() => setLoading(false))
  }, [])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: rows.length, requested: 0, confirmed: 0, in_erp: 0, declined: 0 }
    for (const r of rows) c[r.portal_status]++
    return c
  }, [rows])
  const shown = filter === 'all' ? rows : rows.filter((r) => r.portal_status === filter)

  return (
    <div className="pv3-page">
      <div className="pv3-head pv3-rise">
        <div>
          <h1>Bookings</h1>
          <p>Requests you've sent us. Once we create the job, the booking becomes a tracked shipment.</p>
        </div>
        <div className="pv3-head__actions">
          <Link to="/portal/bookings/new" className="pv3-btn pv3-btn--primary"><Plus size={15} /> New booking</Link>
        </div>
      </div>

      {error && <div className="pv3-error">{error}</div>}

      <div className="pv3-tabs" role="tablist" aria-label="Booking status">
        {FILTERS.map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={filter === x.key}
            className={`pv3-tabs__btn${filter === x.key ? ' pv3-tabs__btn--on' : ''}`} onClick={() => setFilter(x.key)}>
            {x.label}{counts[x.key] > 0 && <span className="pv3-tabs__n">{counts[x.key]}</span>}
          </button>
        ))}
      </div>

      <section className="pv3-card pv3-table-card pv3-rise" style={{ animationDelay: '.08s' }}>
        <div className="pv3-table-wrap">
          <table className="pv3-table">
            <thead>
              <tr><th>Booking</th><th>Route</th><th>Mode</th><th>Cargo</th><th>Ready</th><th>Your PO</th><th>Status</th><th aria-label="Expand" /></tr>
            </thead>
            <tbody>
              {loading && [0, 1, 2].map((i) => <tr key={i}><td colSpan={8}><span className="pv3-skel" /></td></tr>)}
              {!loading && shown.length === 0 && (
                <tr><td colSpan={8} className="pv3-empty-cell">
                  {rows.length === 0 ? <>No bookings yet. <Link to="/portal/bookings/new" className="pv3-link">Request your first booking</Link></> : 'Nothing in this status.'}
                </td></tr>
              )}
              {!loading && shown.map((b) => {
                const isOpen = open === b.id
                const sea = (b.mode ?? '').startsWith('sea')
                const cargo = b.load_type === 'FCL' && b.container_count
                  ? `${b.container_count} × ${b.container_type ?? 'container'}`
                  : [b.pieces ? `${fmtNum(Number(b.pieces))} ${b.packing_type ?? 'pcs'}` : null, b.weight_kg ? `${fmtNum(Number(b.weight_kg))} kg` : null].filter(Boolean).join(' · ') || '—'
                const msg = `/portal/messages?${b.shipment_id != null ? `job=${b.shipment_id}&` : 'new=1&'}subject=${encodeURIComponent(`Booking ${b.booking_ref ?? ''}`)}`
                return (
                  <Fragment key={b.id}>
                    <tr onClick={() => setOpen(isOpen ? null : b.id)} className={isOpen ? 'pv3-row--open' : ''}>
                      <td><span className="pv3-mono pv3-strong">{b.booking_ref}</span><span className="pv3-cell-sub">{fmtDay(b.created_at)}</span></td>
                      <td><span className="pv3-mono">{shortCode(b.origin)} → {shortCode(b.destination)}</span><span className="pv3-cell-sub">{placeName(b.origin, ports)} to {placeName(b.destination, ports)}</span></td>
                      <td><span className="pv3-mode">{sea ? <Ship size={14} /> : <Plane size={14} />}{bookingModeLabel(b)}</span></td>
                      <td><span>{cargo}</span><span className="pv3-cell-sub">{titleCase(b.goods_description).slice(0, 36)}</span></td>
                      <td className="pv3-mono">{fmtDay(b.cargo_ready_date)}</td>
                      <td className={b.customer_ref ? 'pv3-mono' : 'pv3-muted'}>{b.customer_ref ?? '—'}</td>
                      <td><span className={`pv3-pill pv3-pill--${STATUS_TONE[b.portal_status]}`}>{STATUS_LABEL[b.portal_status]}</span></td>
                      <td><ChevronDown size={16} className={`pv3-chev${isOpen ? ' pv3-chev--open' : ''}`} /></td>
                    </tr>
                    {isOpen && (
                      <tr className="pv3-row-detail"><td colSpan={8}>
                        <div className="pv3-bdetail">
                          <dl className="pv3-peek__facts">
                            {([
                              ['Why declined', b.portal_status === 'declined' ? b.decline_reason : null],
                              ['Booked rate', b.quoted_rate?.sell != null ? `${b.quoted_rate.currency} ${Number(b.quoted_rate.sell).toLocaleString('en-NZ')} ${b.quoted_rate.unit} · ${b.quoted_rate.carrier ?? ''}` : null],
                              ['Incoterm', b.incoterm], ['Consignee', titleCase(b.consignee_name)], ['Volume', b.cbm ? `${Number(b.cbm).toFixed(2)} m³` : null],
                              ['Vessel', b.vessel], ['ETD', b.etd ? fmtDay(b.etd) : null], ['ETA', b.eta ? fmtDay(b.eta) : null],
                              ['Dangerous goods', b.is_dg ? 'Yes' : null], ['Notes', b.special_instructions],
                            ] as [string, string | null][]).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd title={v ?? ''}>{v}</dd></div>)}
                          </dl>
                          <div className="pv3-peek__actions">
                            {b.shipment_id != null && <Link to={detailPath({ job_unique: b.shipment_id })} className="pv3-btn pv3-btn--primary">Track shipment <ArrowRight size={14} /></Link>}
                            <Link className="pv3-btn pv3-btn--ghost" to={msg}><MessageSquare size={14} /> Message UBF</Link>
                          </div>
                        </div>
                      </td></tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
