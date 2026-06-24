import type { DashboardFilters } from '../types/shipment'
import { FILTER_ORIGINS } from '../utils/ports'
import { STATUS_OPTIONS } from '../utils/status'

type Props = {
  filters: DashboardFilters
  clients: string[]
  modeCounts: Record<string, number>
  statusCounts: Record<string, number>
  originCounts: Record<string, number>
  onChange: (next: DashboardFilters) => void
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export default function FilterPanel({
  filters,
  clients,
  modeCounts,
  statusCounts,
  originCounts,
  onChange,
}: Props) {
  const set = (patch: Partial<DashboardFilters>) => onChange({ ...filters, ...patch })

  const clearAll = () =>
    onChange({
      ...filters,
      modes: [],
      statuses: [],
      origins: [],
      etdFrom: '',
      etdTo: '',
      etaFrom: '',
      etaTo: '',
      shipper: '',
      client: '',
      portCode: '',
    })

  return (
    <aside className="filter-panel card">
      <div className="filter-panel__head">
        <h2>Filters</h2>
        <button type="button" className="text-link" onClick={clearAll}>
          Clear all
        </button>
      </div>

      <section className="filter-section">
        <h3>Mode</h3>
        {(['air', 'sea'] as const).map((mode) => (
          <label key={mode} className="check-row">
            <input
              type="checkbox"
              checked={filters.modes.includes(mode)}
              onChange={() => set({ modes: toggle(filters.modes, mode) })}
            />
            <span>{mode === 'air' ? 'Air' : 'Sea'}</span>
            <span className="count">({modeCounts[mode] ?? 0})</span>
          </label>
        ))}
      </section>

      <section className="filter-section">
        <h3>Status</h3>
        {STATUS_OPTIONS.map((status) => (
          <label key={status} className="check-row">
            <input
              type="checkbox"
              checked={filters.statuses.includes(status)}
              onChange={() => set({ statuses: toggle(filters.statuses, status) })}
            />
            <span>{status}</span>
            <span className="count">({statusCounts[status] ?? 0})</span>
          </label>
        ))}
      </section>

      <section className="filter-section">
        <h3>Origin</h3>
        {FILTER_ORIGINS.map((origin) => (
          <label key={origin} className="check-row">
            <input
              type="checkbox"
              checked={filters.origins.includes(origin)}
              onChange={() => set({ origins: toggle(filters.origins, origin) })}
            />
            <span>{origin}</span>
            <span className="count">({originCounts[origin] ?? 0})</span>
          </label>
        ))}
      </section>

      <section className="filter-section">
        <h3>Departure</h3>
        <div className="date-row">
          <label>
            <span className="field-label">From</span>
            <input type="date" className="input input--sm" value={filters.etdFrom} onChange={(e) => set({ etdFrom: e.target.value })} />
          </label>
          <label>
            <span className="field-label">To</span>
            <input type="date" className="input input--sm" value={filters.etdTo} onChange={(e) => set({ etdTo: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="filter-section">
        <h3>Arrival</h3>
        <div className="date-row">
          <label>
            <span className="field-label">From</span>
            <input type="date" className="input input--sm" value={filters.etaFrom} onChange={(e) => set({ etaFrom: e.target.value })} />
          </label>
          <label>
            <span className="field-label">To</span>
            <input type="date" className="input input--sm" value={filters.etaTo} onChange={(e) => set({ etaTo: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="filter-section">
        <h3>Shipper</h3>
        <select className="input input--sm" value={filters.shipper} onChange={(e) => set({ shipper: e.target.value })} disabled>
          <option value="">All shippers</option>
        </select>
        <p className="filter-hint">Shipper data not synced yet</p>
      </section>

      <section className="filter-section">
        <h3>Client</h3>
        <select className="input input--sm" value={filters.client} onChange={(e) => set({ client: e.target.value })}>
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </section>

      <div className="filter-panel__foot">
        <span>Show map</span>
        <label className="toggle">
          <input type="checkbox" checked={filters.showMap} onChange={(e) => set({ showMap: e.target.checked })} />
          <span className="toggle__track" />
        </label>
      </div>
    </aside>
  )
}
