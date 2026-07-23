import { useMemo, useState } from 'react'
import { findAirline } from '../../utils/filterAirlines'
import { useAirFlightSuggestions } from './useAirFlightSuggestions'
import type { AirFlightRoute } from './airFlightRoutesApi'
import './flightNoField.css'

type Props = {
  value: string
  onChange: (flightNo: string) => void
  onPick: (flightNo: string, airlineCode: string, airlineName: string) => void
  origin: string
  destination: string
  enabled: boolean
}

function formatLabel(route: AirFlightRoute): string {
  const airline = findAirline(route.airline_code)
  const name = airline?.name ?? route.airline_code
  return `${route.flight_no}  ·  ${name}  ·  used ${route.shipment_count.toLocaleString()}x`
}

export default function FlightNoField({ value, onChange, onPick, origin, destination, enabled }: Props) {
  const [open, setOpen] = useState(false)
  const { suggestions } = useAirFlightSuggestions(origin, destination, enabled)

  const filtered = useMemo(() => {
    const q = value.trim().toUpperCase()
    if (!q) return suggestions
    return suggestions.filter((s) => s.flight_no.toUpperCase().includes(q))
  }, [suggestions, value])

  const showMenu = enabled && open && filtered.length > 0

  function pick(route: AirFlightRoute) {
    const airline = findAirline(route.airline_code)
    onPick(route.flight_no, route.airline_code, airline?.name ?? '')
    setOpen(false)
  }

  return (
    <div className="flight-no-field">
      <input
        className="bf-input"
        value={value}
        placeholder="Flight number"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {showMenu && (
        <ul className="flight-no-field__menu" role="listbox">
          {filtered.map((route) => (
            <li key={`${route.flight_no}-${route.airline_code}`} role="option">
              <button
                type="button"
                className="flight-no-field__option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(route)}
              >
                {formatLabel(route)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
