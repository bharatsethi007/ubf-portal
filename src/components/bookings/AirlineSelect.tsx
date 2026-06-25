import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { filterAirlines, findAirline } from '../../utils/filterAirlines'
import './airlineSelect.css'

type Props = {
  value: string
  onChange: (code: string, name?: string) => void
}

export default function AirlineSelect({ value, onChange }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(!value)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = value ? findAirline(value) : undefined
  const results = useMemo(() => filterAirlines(text, 15), [text])
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

  function select(code: string, name: string) {
    onChange(code, name)
    setText('')
    setOpen(false)
    setSearching(false)
  }

  function clear(e: MouseEvent) {
    e.stopPropagation()
    onChange('', undefined)
    setText('')
    setSearching(true)
    setOpen(true)
  }

  function startSearch() {
    setSearching(true)
    setOpen(true)
  }

  const display = selected
    ? `${selected.code} – ${selected.name}`
    : value.trim()
      ? value.trim()
      : null

  return (
    <div className="airline-select">
      {display && !searching ? (
        <button type="button" className="airline-select__btn airline-select__btn--selected" onClick={startSearch}>
          <span className="airline-select__label">{display}</span>
          <span className="airline-select__clear" role="button" tabIndex={0} onClick={clear} aria-label="Clear airline">
            <X size={14} />
          </span>
        </button>
      ) : searching ? (
        <div className="airline-select__search-wrap">
          <input
            ref={inputRef}
            className="airline-select__input"
            value={text}
            placeholder="Search airline"
            onChange={(e) => {
              setText(e.target.value)
              setOpen(true)
              if (!e.target.value.trim()) onChange('', undefined)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          />
          {showMenu && (
            <ul className="airline-select__menu" role="listbox">
              {results.map((airline) => (
                <li key={airline.code} role="option">
                  <button
                    type="button"
                    className="airline-select__option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(airline.code, airline.name)}
                  >
                    <span className="airline-select__code mono">{airline.code}</span>
                    <span className="airline-select__name">{airline.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button type="button" className="airline-select__btn airline-select__btn--empty" onClick={startSearch}>
          <Search size={16} />
          Search airline
        </button>
      )}
    </div>
  )
}
