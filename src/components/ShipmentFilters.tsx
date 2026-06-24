import { Search } from 'lucide-react'
import { STATUS_OPTIONS } from '../utils/status'
import { useShipmentFilterOptions } from '../hooks/useShipmentFilterOptions'
import { useShipmentFilters } from '../hooks/useShipmentFilters'
import ShipmentFiltersMore from './ShipmentFiltersMore'

export default function ShipmentFilters() {
  const { view, setView, filters, setFilter } = useShipmentFilters()
  const { origins, destinations } = useShipmentFilterOptions()

  const searchPlaceholder =
    view === 'consols' ? 'Search consol no.' : 'Job no., house bill, account ID'

  return (
    <div className="shipment-filters">
      <div className="seg shipment-filters__toggle">
        <button
          type="button"
          className={`seg-btn${view === 'consols' ? ' on' : ''}`}
          onClick={() => setView('consols')}
        >
          Consols
        </button>
        <button
          type="button"
          className={`seg-btn${view === 'jobs' ? ' on' : ''}`}
          onClick={() => setView('jobs')}
        >
          Jobs
        </button>
      </div>

      <label className="shipment-filters__search">
        <Search size={16} className="shipment-filters__search-icon" strokeWidth={2} />
        <input
          type="text"
          className="shipment-filters__input shipment-filters__input--search"
          placeholder={searchPlaceholder}
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
        />
      </label>

      <input
        type="text"
        className="shipment-filters__input"
        list="shipment-origin-options"
        placeholder="Origin"
        value={filters.origin}
        onChange={(e) => setFilter('origin', e.target.value)}
      />
      <datalist id="shipment-origin-options">
        {origins.map((o) => <option key={o} value={o} />)}
      </datalist>

      <input
        type="text"
        className="shipment-filters__input"
        list="shipment-dest-options"
        placeholder="Destination"
        value={filters.destination}
        onChange={(e) => setFilter('destination', e.target.value)}
      />
      <datalist id="shipment-dest-options">
        {destinations.map((d) => <option key={d} value={d} />)}
      </datalist>

      <input
        type="text"
        className="shipment-filters__input"
        placeholder="Vessel / Flight"
        value={filters.vesselFlight}
        onChange={(e) => setFilter('vesselFlight', e.target.value)}
      />

      {view === 'jobs' && (
        <select
          className="shipment-filters__input shipment-filters__select"
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
        >
          <option value="">Status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}

      <ShipmentFiltersMore />
    </div>
  )
}
