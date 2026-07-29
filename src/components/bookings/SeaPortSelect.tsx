import { Globe, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useSeaPorts, filterSeaPorts, type SeaPort } from '../../hooks/useSeaPorts'
import './iataPortSelect.css'

type Props = {
  label?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
}

function SeaFlag({ code, size = 22 }: { code: string | null; size?: number }) {
  const cc = code && /^[a-z]{2}$/.test(code) ? code : null
  if (!cc) return <Globe size={size - 4} className="iata-tile__globe" aria-hidden />
  return (
    <span
      className={`fi fi-${cc} iata-tile__flag`}
      style={{ width: size, height: Math.round(size * 0.72) }}
      aria-hidden
    />
  )
}

export default function SeaPortSelect({ label, value, onChange, required, placeholder }: Props) {
  const { ports } = useSeaPorts()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(!value)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(
    () => (value ? ports.find((p) => p.code === value) ?? null : null),
    [value, ports],
  )
  const results = useMemo(() => filterSeaPorts(ports, text, 20), [ports, text])
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

  function select(port: SeaPort) {
    onChange(port.code)
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
      {value && !searching ? (
        <button type="button" className="iata-tile__btn iata-tile__btn--selected" onClick={startSearch}>
          <span className="iata-tile__selected-main">
            <SeaFlag code={selected?.country_code ?? null} />
            <span className="iata-tile__code-block">
              <span className="iata-tile__code mono">{value}</span>
              <span className="iata-tile__city">{selected?.name ?? value}</span>
            </span>
          </span>
          <span className="iata-tile__clear" role="button" tabIndex={0} onClick={clear} aria-label="Clear port">
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
            placeholder={placeholder ?? 'Search port'}
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
                <li key={port.code} role="option">
                  <button
                    type="button"
                    className="iata-tile__option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(port)}
                  >
                    <span className="iata-tile__option-lead">
                      <SeaFlag code={port.country_code} size={20} />
                      <span className="iata-tile__option-iata mono">{port.code}</span>
                    </span>
                    <span className="iata-tile__option-detail">
                      <span className="iata-tile__option-name">{port.name}</span>
                      <span className="iata-tile__option-meta muted">{port.country_code?.toUpperCase() ?? '—'}</span>
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
          {placeholder ?? 'Search port'}
        </button>
      )}
    </div>
  )
}
