import { Globe, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { filterAirports, findAirport, type Airport } from '../../utils/filterAirports'
import './iataPortSelect.css'

type Props = {
  label?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
}

function countryCode(country: string | undefined): string | null {
  const code = (country ?? '').trim().toLowerCase()
  return /^[a-z]{2}$/.test(code) ? code : null
}

function CountryFlag({ country, size = 22 }: { country?: string; size?: number }) {
  const code = countryCode(country)
  if (!code) return <Globe size={size - 4} className="iata-tile__globe" aria-hidden />
  return (
    <span
      className={`fi fi-${code} iata-tile__flag`}
      style={{ width: size, height: Math.round(size * 0.72) }}
      aria-hidden
    />
  )
}

export default function IataPortSelect({ label, value, onChange, required }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(!value)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = value ? findAirport(value) : undefined
  const results = useMemo(() => filterAirports(text, 20), [text])
  const q = text.trim()
  const showMenu = searching && open && q.length > 0 && results.length > 0

  useEffect(() => {
    if (value) {
      setSearching(false)
      setOpen(false)
      setText('')
    }
  }, [value])

  useEffect(() => {
    if (searching) inputRef.current?.focus()
  }, [searching])

  function select(port: Airport) {
    onChange(port.iata)
    setText('')
    setOpen(false)
    setSearching(false)
  }

  function clear(e: MouseEvent) {
    e.stopPropagation()
    onChange('')
    setText('')
    setSearching(true)
    setOpen(true)
  }

  function startSearch() {
    setSearching(true)
    setOpen(true)
  }

  return (
    <div className="iata-tile">
      {label && (
        <span className="bf-field__label">
          {label}
          {required && <span className="bf-field__req"> *</span>}
        </span>
      )}
      {selected && !searching ? (
        <button type="button" className="iata-tile__btn iata-tile__btn--selected" onClick={startSearch}>
          <span className="iata-tile__selected-main">
            <CountryFlag country={selected.country} />
            <span className="iata-tile__code-block">
              <span className="iata-tile__code mono">{selected.iata}</span>
              <span className="iata-tile__city">{selected.city || selected.name}</span>
            </span>
          </span>
          <span className="iata-tile__clear" role="button" tabIndex={0} onClick={clear} aria-label="Clear airport">
            <X size={14} />
          </span>
        </button>
      ) : searching ? (
        <div className="iata-tile__search-wrap">
          <input
            ref={inputRef}
            className="iata-tile__input"
            value={text}
            required={required && !value}
            placeholder="Search airport"
            onChange={(e) => {
              setText(e.target.value)
              setOpen(true)
              if (!e.target.value.trim()) onChange('')
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          />
          {showMenu && (
            <ul className="iata-tile__menu" role="listbox">
              {results.map((port) => (
                <li key={port.iata} role="option">
                  <button
                    type="button"
                    className="iata-tile__option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(port)}
                  >
                    <span className="iata-tile__option-lead">
                      <CountryFlag country={port.country} size={20} />
                      <span className="iata-tile__option-iata mono">{port.iata}</span>
                    </span>
                    <span className="iata-tile__option-detail">
                      <span className="iata-tile__option-name">{port.name}</span>
                      <span className="iata-tile__option-meta muted">{port.city || '—'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button type="button" className="iata-tile__btn iata-tile__btn--empty" onClick={startSearch}>
          <Search size={16} />
          Search airport
        </button>
      )}
    </div>
  )
}
