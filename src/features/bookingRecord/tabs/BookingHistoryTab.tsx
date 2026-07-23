import { Button } from '@/components/ui/button'
import HistoryFeed from '../history/HistoryFeed'
import type { HistoryFilter } from '../history/bookingHistoryFormat'
import { useBookingHistory } from '../history/useBookingHistory'

type Props = {
  bookingId: string
  refreshKey?: number
}

const FILTER_OPTIONS: { value: HistoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'fields', label: 'Field changes' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'documents', label: 'Documents' },
]

export default function BookingHistoryTab({ bookingId, refreshKey = 0 }: Props) {
  const { filter, setFilter, rows, loading, loadingMore, hasMore, loadMore } = useBookingHistory(
    bookingId,
    refreshKey,
  )

  return (
    <div className="booking-history-tab">
      <div className="booking-history-toolbar">
        <label className="filter-field booking-history-filter">
          <span className="filter-field__label">Show</span>
          <select
            className="input input--sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as HistoryFilter)}
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="muted pad-inline">Loading history…</p>
      ) : (
        <HistoryFeed rows={rows} />
      )}

      {!loading && hasMore ? (
        <div className="booking-history-more">
          <Button type="button" variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
