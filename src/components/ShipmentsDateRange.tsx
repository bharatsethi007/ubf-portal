import { useShipmentFilters } from '../hooks/useShipmentFilters'
import { PRESET_LABELS, type DatePreset } from '../utils/dateRange'

const PRESETS: DatePreset[] = ['this-month', 'last-month', 'last-90', 'this-year', 'custom']
const BOOKED_TOOLTIP = "When the consol was created (matches TradeWindow's Registered date)."

export default function ShipmentsDateRange() {
  const { dateRange, setPreset, setCustomRange, dateBasis, setDateBasis } = useShipmentFilters()

  return (
    <div className="shipments-date-range">
      <div className="seg shipments-date-basis">
        <button
          type="button"
          className={`seg-btn${dateBasis === 'etd' ? ' on' : ''}`}
          onClick={() => setDateBasis('etd')}
        >
          By ETD
        </button>
        <button
          type="button"
          className={`seg-btn${dateBasis === 'booked' ? ' on' : ''}`}
          title={BOOKED_TOOLTIP}
          onClick={() => setDateBasis('booked')}
        >
          By Booked
        </button>
      </div>

      <select
        className="input input--sm shipments-preset"
        value={dateRange.preset}
        onChange={(e) => setPreset(e.target.value as DatePreset)}
      >
        {PRESETS.map((p) => (
          <option key={p} value={p}>{PRESET_LABELS[p]}</option>
        ))}
      </select>
      {dateRange.preset === 'custom' && (
        <div className="shipments-custom-dates">
          <input
            type="date"
            className="input input--sm"
            value={dateRange.from}
            onChange={(e) => setCustomRange(e.target.value, dateRange.to)}
          />
          <span className="muted">–</span>
          <input
            type="date"
            className="input input--sm"
            value={dateRange.to}
            onChange={(e) => setCustomRange(dateRange.from, e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
