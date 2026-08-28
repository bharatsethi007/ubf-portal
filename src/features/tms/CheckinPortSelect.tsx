import { Globe, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import {
  useModePorts,
  filterModePorts,
  getRecentPorts,
  pushRecentPort,
  type ModePort,
  type PortMode,
} from '@/hooks/useModePorts'
import '../../components/bookings/iataPortSelect.css'

type Props = {
  mode: PortMode
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
}

function Flag({ code, size = 20 }: { code: string | null; size?: number }) {
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

export default function CheckinPortSelect({ mode, value, onChange, required, placeholder }: Props) {
  const { ports } = useModePorts(mode)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(!value)
  const [recentTick, setRecentTick] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const byCode = useMemo(() => {
    const m = new Map<string, ModePort>()
    for (const p of ports) m.set(p.code.toLowerCase(), p)
    return m
  }, [ports])

  const selected = value ? byCode.get(value.toLowerCase()) ?? null : null
  const q = text.trim()
  const results = useMemo(() => filterModePorts(ports, q, 20), [ports, q])
  const recentPorts = useMemo(
    () =>
      getRecentPorts(mode).map(
        (c) => byCode.get(c.toLowerCase()) ?? { code: c, name: c, country_code: null },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, byCode, recentTick, open],
  )

  const ph = placeholder ?? (mode === 'air' ? 'Search airport' : 'Search port')
  const exactMatch = q.length > 0 && results.some((p) => p.code.toLowerCase() === q.toLowerCase())
  const showFreeText = q.length > 0 && !exactMatch
  const showMenu =
    searching && open && (q.length > 0 ? results.length > 0 || showFreeText : recentPorts.length > 0)

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

  function commit(v: string) {
    const clean = v.trim()
    if (!clean) return
    onChange(clean)
    pushRecentPort(mode, clean)
    setRecentTick((t) => t + 1)
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
      {value && !searching ? (
        <button
          type="button"
          className="iata-tile__btn iata-tile__btn--selected"
          onClick={startSearch}
        >
          <span className="iata-tile__selected-main">
            <Flag code={selected?.country_code ?? null} size={22} />
            <span className="iata-tile__code-block">
              <span className="iata-tile__code mono">{value}</span>
              <span className="iata-tile__city">{selected?.name ?? 'Free text'}</span>
            </span>
          </span>
          <span
            className="iata-tile__clear"
            role="button"
            tabIndex={0}
            onClick={clear}
            aria-label="Clear port"
          >
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
            placeholder={ph}
            onChange={(e) => {
              setText(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (q.length === 0) return
                if (results[0]) commit(results[0].code)
                else commit(q)
              }
            }}
          />
          {showMenu && (
            <ul className="iata-tile__menu" role="listbox">
              {q.length === 0 && recentPorts.length > 0 && (
                <li className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                  Recent
                </li>
              )}
              {(q.length === 0 ? recentPorts : results).map((port) => (
                <li key={port.code} role="option">
                  <button
                    type="button"
                    className="iata-tile__option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commit(port.code)}
                  >
                    <span className="iata-tile__option-lead">
                      <Flag code={port.country_code} size={20} />
                      <span className="iata-tile__option-iata mono">{port.code}</span>
                    </span>
                    <span className="iata-tile__option-detail">
                      <span className="iata-tile__option-name">{port.name}</span>
                      <span className="iata-tile__option-meta muted">
                        {port.country_code?.toUpperCase() ?? '—'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {showFreeText && (
                <li role="option">
                  <button
                    type="button"
                    className="iata-tile__option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commit(q)}
                  >
                    <span className="iata-tile__option-lead">
                      <Globe size={16} className="iata-tile__globe" />
                    </span>
                    <span className="iata-tile__option-detail">
                      <span className="iata-tile__option-name">Use “{q}”</span>
                      <span className="iata-tile__option-meta muted">Free text</span>
                    </span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="iata-tile__btn iata-tile__btn--empty"
          onClick={startSearch}
        >
          <Search size={16} />
          {ph}
        </button>
      )}
    </div>
  )
}
