import { ChevronDown } from 'lucide-react'
import { useShipmentFilters } from '../hooks/useShipmentFilters'

export default function ShipmentFiltersMore() {
  const { view, filters, setFilter, clearFilters, moreOpen, setMoreOpen } = useShipmentFilters()

  return (
    <div className="shipment-filters__more">
      <button
        type="button"
        className="shipment-filters__more-toggle"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen(!moreOpen)}
      >
        More filters
        <ChevronDown size={14} className={`shipment-filters__chev${moreOpen ? ' open' : ''}`} />
      </button>
      {moreOpen && (
        <div className="shipment-filters__more-panel">
          <label className="filter-field">
            <span className="filter-field__label">Mode</span>
            <select
              className="input input--sm"
              value={filters.mode}
              onChange={(e) => setFilter('mode', e.target.value)}
            >
              <option value="">All modes</option>
              <option value="air">Air</option>
              <option value="sea">Sea</option>
            </select>
          </label>
          {view === 'jobs' && (
            <label className="filter-field">
              <span className="filter-field__label">Customer</span>
              <input
                type="text"
                className="input input--sm"
                placeholder="Account ID or name"
                value={filters.customer}
                onChange={(e) => setFilter('customer', e.target.value)}
              />
            </label>
          )}
          <button type="button" className="text-link shipment-filters__clear" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
