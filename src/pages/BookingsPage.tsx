import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { fetchOverdueBatch, type CustomerOverdue } from '../api/customerOverdueApi'
import OverdueBadge from '../components/OverdueBadge'
import '../components/overdueBadge.css'
import BookingSourceTag from '../components/bookings/BookingSourceTag'
import { useBookings } from '../hooks/useBookings'
import {
  MODULE_CONFIG,
  STATUS_LABEL,
  isUntouched,
  type Booking,
  type BookingModule,
} from '../types/booking'
import { bookingOverdueAccountIds, bookingRowOverdueAccountId } from '../utils/bookingOverdueUtils'
import {
  BOOKING_SOURCE_FILTERS,
  filterBookingsBySource,
  type BookingSourceFilter,
} from './bookings/bookingsListFilters'

const MODULES: BookingModule[] = ['EA', 'ES', 'IA', 'IS']

type Props = { module?: BookingModule }

export default function BookingsPage({ module: moduleProp }: Props) {
  const { module: moduleParam } = useParams()
  const module = moduleProp ?? moduleParam
  if (!module || !MODULES.includes(module as BookingModule)) {
    return <Navigate to="/bookings/ES" replace />
  }
  return <BookingsPageContent module={module as BookingModule} />
}

function BookingsPageContent({ module }: { module: BookingModule }) {
  const navigate = useNavigate()
  const { data, loading, error } = useBookings(module)
  const [sourceFilter, setSourceFilter] = useState<BookingSourceFilter>('all')
  const [overdueMap, setOverdueMap] = useState<Record<string, CustomerOverdue>>({})
  const cfg = MODULE_CONFIG[module]
  const filtered = useMemo(
    () => filterBookingsBySource(data, sourceFilter),
    [data, sourceFilter],
  )

  const accountIds = useMemo(
    () => [...new Set(filtered.flatMap((b) => bookingOverdueAccountIds(b, module)))],
    [filtered, module],
  )

  useEffect(() => {
    if (loading || accountIds.length === 0) {
      setOverdueMap({})
      return
    }

    let cancelled = false
    fetchOverdueBatch(accountIds, 30).then((map) => {
      if (!cancelled) setOverdueMap(map)
    })

    return () => {
      cancelled = true
    }
  }, [accountIds, loading])

  return (
    <div className="customers-page">
      <header className="customers-page__head">
        <h1>{cfg.label} Bookings</h1>
        <button type="button" className="bookings-page__new" onClick={() => navigate(`/bookings/${module}/new`)}>
          + New Booking
        </button>
      </header>

      <div className="bookings-source-filters" role="group" aria-label="Filter by source">
        {BOOKING_SOURCE_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`bookings-source-filters__btn${sourceFilter === value ? ' bookings-source-filters__btn--active' : ''}`}
            onClick={() => setSourceFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="error card pad-inline">{error}</div>}

      <div className="customers-table card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Importer</th>
                <th>Exporter</th>
                <th>Route</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="muted pad-inline">Loading bookings…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="muted pad-inline">No bookings match this filter.</td></tr>
              ) : (
                filtered.map((b) => (
                  <BookingRow key={b.id} module={module} booking={b} overdueMap={overdueMap} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function BookingRow({
  module,
  booking: b,
  overdueMap,
}: {
  module: BookingModule
  booking: Booking
  overdueMap: Record<string, CustomerOverdue>
}) {
  const navigate = useNavigate()
  const untouched = isUntouched(b)
  const rowCls = untouched ? 'booking-row--untouched row-clickable' : 'row-clickable'
  const isExport = MODULE_CONFIG[module].direction === 'export'
  const overdueAccountId = bookingRowOverdueAccountId(b, module)
  const overdue = overdueAccountId ? overdueMap[overdueAccountId] : null

  return (
    <tr className={rowCls} onClick={() => navigate(`/bookings/${module}/${b.id}/edit`)}>
      <td><strong>{b.booking_ref}</strong></td>
      <td>
        <PartyCell
          name={b.importer_name ?? '—'}
          overdue={!isExport ? overdue : null}
        />
      </td>
      <td>
        <PartyCell
          name={exporterLabel(b)}
          overdue={isExport ? overdue : null}
        />
      </td>
      <td className="mono">{routeCell(b)}</td>
      <td><BookingSourceTag source={b.source} /></td>
      <td>{STATUS_LABEL[b.status]}</td>
    </tr>
  )
}

function PartyCell({
  name,
  overdue,
}: {
  name: string
  overdue: CustomerOverdue | null | undefined
}) {
  if (!overdue) return <>{name}</>

  return (
    <span className="booking-row__party">
      <span>{name}</span>
      <OverdueBadge
        compact
        size="sm"
        count={overdue.overdue_count}
        amount={overdue.overdue_amount}
        currency={overdue.currency}
        oldestDue={overdue.oldest_due}
      />
    </span>
  )
}

function exporterLabel(b: Booking): string {
  if (b.is_consolidation) return 'Multiple'
  return b.shipper_account_id ?? b.account_id ?? '—'
}

function routeCell(b: Booking): string {
  return `${b.origin ?? '—'} → ${b.destination ?? '—'}`
}
