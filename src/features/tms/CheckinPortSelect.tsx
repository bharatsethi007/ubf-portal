import { Globe, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useModePorts, getRecentPorts, pushRecentPort, type ModePort } from '@/hooks/useModePorts'
import '../../components/bookings/iataPortSelect.css'

type Kind = 'air' | 'sea'
type PortMode = '' | 'air' | 'sea'
type Entry = { port: ModePort; kind: Kind }
type Props = {
  mode: PortMode
  value: string
  onChange: (v: string, kind?: Kind) => void
  required?: boolean
  placeholder?: string
}

function Flag({ code, size = 20 }: { code: string | null; size?: number }) {
  const cc = code && /^[a-z]{2}$/.test(code) ? code : null
  if (!cc) return <Globe size={size - 4} className="iata-tile__globe" aria-hidden />
  return <span className={`fi fi-${cc} iata-tile__flag`} style={{ width: size, height: Math.round(size * 0.72) }} aria-hidden />
}

export default function CheckinPortSelect({ mode, value, onChange, required, placeholder }: Props) {
  const sea = useModePorts('sea')
  const air = useModePorts('air')
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(!value)
  const [recentTick, setRecentTick] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Pool of candidates: scoped to the chosen mode, or both when mode is unset (so NAN etc. are reachable).
  const pool = useMemo<Entry[]>(() => {
    const airP = air.ports.map((p) => ({ port: p, kind: 'air' as const }))
    const seaP = sea.ports.map((p) => ({ port: p, kind: 'sea' as const }))
    if (mode === 'air') return airP
    if (mode === 'sea') return seaP
    return [...seaP, ...airP]
  }, [mode, air.ports, sea.ports])

  const byCode = useMemo(() => {
    const m = new Map<string, Entry>()
    for (const e of pool) if (!m.has(e.port.code.toLowerCase())) m.set(e.port.code.toLowerCase(), e)
    return m
  }, [pool])

  const selected = value ? byCode.get(value.toLowerCase()) ?? null : null
  const isFree = Boolean(value) && !selected
  const q = text.trim().toLowerCase()

  const results = useMemo(() => {
    if (!q) return []
    const out: Entry[] = []
    for (const e of pool) {
      if (e.port.code.toLowerCase().includes(q) || e.port.name.toLowerCase().includes(q)) {
        out.push(e)
        if (out.length >= 20) break
      }
    }
    return out
  }, [pool, q])

  const recentEntries = useMemo(() => {
    const modes: Kind[] = mode === '' ? ['sea', 'air'] : [mode]
    const seen = new Set<string>()
    const list: Entry[] = []
    for (const mk of modes) {
      for (const code of getRecentPorts(mk)) {
        const key = code.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        list.push(byCode.get(key) ?? { port: { code, name: code, country_code: null }, kind: mk })
      }
    }
    return list.slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, byCode, recentTick, open])

  const ph = placeholder ?? (mode === 'air' ? 'Search airport' : mode === 'sea' ? 'Search port' : 'Search port or airport')
  const exact = q.length > 0 && results.some((e) => e.port.code.toLowerCase() === q)
  const showFreeText = q.length > 0 && !exact
  const showMenu = searching && open && (q.length > 0 ? results.length > 0 || showFreeText : recentEntries.length > 0)

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

  function commit(v: string, kind?: Kind) {
    const clean = v.trim()
    if (!clean) return
    onChange(clean, kind)
    pushRecentPort(kind ?? (mode || 'sea'), clean)
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
        <button type="button" className="iata-tile__btn iata-tile__btn--selected overflow-hidden" onClick={startSearch}>
          <span className="iata-tile__selected-main min-w-0">
            <Flag code={selected?.port.country_code ?? null} size={22} />
            {isFree ? (
              <span className="iata-tile__city truncate" style={{ maxWidth: 220 }} title={value}>{value}</span>
            ) : (
              <span className="iata-tile__code-block min-w-0">
                <span className="iata-tile__code mono">{value}</span>
                <span className="iata-tile__city truncate">{selected?.port.name}</span>
              </span>
            )}
          </span>
          <span className="iata-tile__clear" role="button" tabIndex={0} onClick={clear} aria-label="Clear port"><X size={14} /></span>
        </button>
      ) : searching ? (
        <div className="iata-tile__search-wrap">
          <input
            ref={inputRef}
            className="iata-tile__input"
            value={text}
            required={required && !value}
            placeholder={ph}
            onChange={(e) => { setText(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (q.length === 0) return
                if (results[0]) commit(results[0].port.code, results[0].kind)
                else commit(text.trim())
              }
            }}
          />
          {showMenu && (
            <ul className="iata-tile__menu" role="listbox">
              {q.length === 0 && recentEntries.length > 0 && (
                <li className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Recent</li>
              )}
              {(q.length === 0 ? recentEntries : results).map((e) => (
                <li key={`${e.kind}-${e.port.code}`} role="option">
                  <button type="button" className="iata-tile__option" onMouseDown={(ev) => ev.preventDefault()} onClick={() => commit(e.port.code, e.kind)}>
                    <span className="iata-tile__option-lead">
                      <Flag code={e.port.country_code} size={20} />
                      <span className="iata-tile__option-iata mono">{e.port.code}</span>
                    </span>
                    <span className="iata-tile__option-detail">
                      <span className="iata-tile__option-name">{e.port.name}</span>
                      <span className="iata-tile__option-meta muted">{(e.port.country_code?.toUpperCase() ?? '—') + ' · ' + (e.kind === 'air' ? 'Air' : 'Sea')}</span>
                    </span>
                  </button>
                </li>
              ))}
              {showFreeText && (
                <li role="option">
                  <button type="button" className="iata-tile__option" onMouseDown={(ev) => ev.preventDefault()} onClick={() => commit(text.trim())}>
                    <span className="iata-tile__option-lead"><Globe size={16} className="iata-tile__globe" /></span>
                    <span className="iata-tile__option-detail">
                      <span className="iata-tile__option-name">Use “{text.trim()}”</span>
                      <span className="iata-tile__option-meta muted">Free text</span>
                    </span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      ) : (
        <button type="button" className="iata-tile__btn iata-tile__btn--empty" onClick={startSearch}>
          <Search size={16} />{ph}
        </button>
      )}
    </div>
  )
}
