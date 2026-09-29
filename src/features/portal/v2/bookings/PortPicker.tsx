import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Plane, Ship } from 'lucide-react'
import type { PortMap } from '../../../../hooks/usePorts'
import { shortPlace } from '../homeModel'

type Props = {
  id: string
  label: string
  value: string
  onChange: (code: string) => void
  ports: PortMap
  mode: 'sea' | 'air'
  placeholder?: string
}

/** Searchable port picker. Sea shows UN/LOCODEs (5 chars), air shows IATA airports (3 chars). */
export default function PortPicker({ id, label, value, onChange, ports, mode, placeholder }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const list = useMemo(() => [...ports.values()].filter((p) => (mode === 'sea' ? p.code.length === 5 : p.code.length === 3)), [ports, mode])
  const selected = value ? ports.get(value) : undefined

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return list.slice(0, 8)
    return list
      .filter((p) => p.code.toLowerCase().startsWith(n) || p.name.toLowerCase().includes(n))
      .sort((a, b) => Number(b.code.toLowerCase().startsWith(n)) - Number(a.code.toLowerCase().startsWith(n)))
      .slice(0, 8)
  }, [list, q])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => { setCursor(0) }, [q])

  const pick = (code: string) => { onChange(code); setQ(''); setOpen(false) }
  const Icon = mode === 'sea' ? Ship : Plane

  return (
    <div className="pv3-field" ref={boxRef}>
      <label htmlFor={id}>{label}</label>
      <div className="pv3-combo">
        <MapPin size={15} className="pv3-combo__ico" aria-hidden />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          autoComplete="off"
          value={open ? q : selected ? `${shortPlace(selected.name, selected.code)} (${selected.code})` : ''}
          placeholder={placeholder ?? (mode === 'sea' ? 'Port, e.g. Shanghai or CNSHA' : 'Airport, e.g. Nadi or NAN')}
          onFocus={() => { setOpen(true); setQ('') }}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(matches.length - 1, c + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)) }
            else if (e.key === 'Enter' && open && matches[cursor]) { e.preventDefault(); pick(matches[cursor].code) }
            else if (e.key === 'Escape') setOpen(false)
          }}
        />
        {open && (
          <ul className="pv3-combo__list" id={`${id}-list`} role="listbox">
            {matches.length === 0 && <li className="pv3-combo__empty">No match. Try the city or code.</li>}
            {matches.map((p, i) => (
              <li key={p.code} role="option" aria-selected={i === cursor}>
                <button type="button" className={i === cursor ? 'pv3-combo__opt pv3-combo__opt--on' : 'pv3-combo__opt'}
                  onMouseEnter={() => setCursor(i)} onMouseDown={(e) => { e.preventDefault(); pick(p.code) }}>
                  <Icon size={14} aria-hidden />
                  <span className="pv3-combo__name">{shortPlace(p.name, p.code)}</span>
                  <span className="pv3-combo__code">{p.code}</span>
                  {p.country_code && <span className={`fi fi-${p.country_code.toLowerCase()}`} aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
