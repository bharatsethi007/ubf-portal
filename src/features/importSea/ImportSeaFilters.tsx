import { ChevronDown, Download, RefreshCw, Search } from 'lucide-react'
import {
  collectFilterOptions,
  type ImportSeaFilterState,
  type TriFilter,
} from './importSeaFilterLogic'
import type { ImportSeaRow } from './types'

type Props = {
  rows: ImportSeaRow[]
  filters: ImportSeaFilterState
  setFilter: <K extends keyof ImportSeaFilterState>(
    key: K,
    value: ImportSeaFilterState[K],
  ) => void
  clearFilters: () => void
  moreOpen: boolean
  setMoreOpen: (open: boolean) => void
  loading: boolean
  onRefresh: () => void
  onExport: () => void
}

function triSelect(
  value: TriFilter,
  onChange: (v: TriFilter) => void,
  label: string,
  yes: string,
  no: string,
  disabled: boolean,
) {
  return (
    <label className="filter-field">
      <span className="filter-field__label">{label}</span>
      <select
        className="input input--sm"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as TriFilter)}
      >
        <option value="">Any</option>
        <option value="yes">{yes}</option>
        <option value="no">{no}</option>
      </select>
    </label>
  )
}

export default function ImportSeaFilters({
  rows,
  filters,
  setFilter,
  clearFilters,
  moreOpen,
  setMoreOpen,
  loading,
  onRefresh,
  onExport,
}: Props) {
  const { shippingLines, dischargePorts } = collectFilterOptions(rows)

  return (
    <div className="shipment-filters">
      <label className="shipment-filters__search">
        <Search size={16} className="shipment-filters__search-icon" strokeWidth={2} />
        <input
          type="text"
          className="shipment-filters__input shipment-filters__input--search"
          placeholder="Client, booking ref, job #, container"
          value={filters.search}
          disabled={loading}
          onChange={(e) => setFilter('search', e.target.value)}
        />
      </label>

      <input
        type="text"
        className="shipment-filters__input"
        list="import-sea-line-options"
        placeholder="Shipping line"
        value={filters.shippingLine}
        disabled={loading}
        onChange={(e) => setFilter('shippingLine', e.target.value)}
      />
      <datalist id="import-sea-line-options">
        {shippingLines.map((o) => <option key={o} value={o} />)}
      </datalist>

      <input
        type="text"
        className="shipment-filters__input"
        list="import-sea-port-options"
        placeholder="Discharge port"
        value={filters.dischargePort}
        disabled={loading}
        onChange={(e) => setFilter('dischargePort', e.target.value)}
      />
      <datalist id="import-sea-port-options">
        {dischargePorts.map((p) => <option key={p} value={p} />)}
      </datalist>

      <div className="import-sea-toolbar-end">
        <div className="shipment-filters__more">
          <button
            type="button"
            className="shipment-filters__more-toggle"
            aria-expanded={moreOpen}
            disabled={loading}
            onClick={() => setMoreOpen(!moreOpen)}
          >
            More filters
            <ChevronDown size={14} className={`shipment-filters__chev${moreOpen ? ' open' : ''}`} />
          </button>
          {moreOpen && (
            <div className="shipment-filters__more-panel">
              {triSelect(filters.portNotCleared, (v) => setFilter('portNotCleared', v), 'Port not cleared', 'Yes', 'No', loading)}
              {triSelect(filters.lineNotReleased, (v) => setFilter('lineNotReleased', v), 'Line not released', 'Yes', 'No', loading)}
              {triSelect(filters.delivered, (v) => setFilter('delivered', v), 'Delivery', 'Delivered', 'Not delivered', loading)}
              {triSelect(filters.onHold, (v) => setFilter('onHold', v), 'Hold', 'On hold', 'Not on hold', loading)}
              {triSelect(
                filters.containerConflicts,
                (v) => setFilter('containerConflicts', v),
                'Container conflicts',
                'Has conflicts',
                'No conflicts',
                loading,
              )}
              <label className="filter-field">
                <span className="filter-field__label">ETA from</span>
                <input
                  type="date"
                  className="input input--sm"
                  value={filters.etaFrom}
                  disabled={loading}
                  onChange={(e) => setFilter('etaFrom', e.target.value)}
                />
              </label>
              <label className="filter-field">
                <span className="filter-field__label">ETA to</span>
                <input
                  type="date"
                  className="input input--sm"
                  value={filters.etaTo}
                  disabled={loading}
                  onChange={(e) => setFilter('etaTo', e.target.value)}
                />
              </label>
              <button
                type="button"
                className="text-link shipment-filters__clear"
                disabled={loading}
                onClick={clearFilters}
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        <div className="import-sea-toolbar-actions">
          <button
            type="button"
            className="pagination__btn"
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCw size={14} className={loading ? 'import-sea-spin' : undefined} />
            Refresh
          </button>
          <button type="button" className="pagination__btn" onClick={onExport}>
            <Download size={14} />
            CSV export
          </button>
        </div>
      </div>
    </div>
  )
}
