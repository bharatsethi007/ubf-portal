import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { filterAirports, findAirport, type Airport } from '../../../utils/filterAirports'

type Props = { value: string; onChange: (code: string) => void; width?: number }

export default function AirportCell({ value, onChange, width = 148 }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimer = useRef<number | undefined>(undefined)
  const selected = value ? findAirport(value) : undefined
  const q = text.trim()
  const results = useMemo(() => (q ? filterAirports(q, 8) : []), [q])
  const showMenu = open && q.length > 0 && results.length > 0

  function measure() {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 240) })
  }

  useEffect(() => {
    if (!open) return
    measure()
    const onMove = () => measure()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  function pick(a: Airport) {
    onChange(a.iata)
    setText('')
    setOpen(false)
  }

  const display = open ? text : selected ? `${selected.iata} · ${selected.city || selected.name}` : value

  return (
    <div style={{ width }}>
      <input
        ref={inputRef}
        className="input input--sm"
        style={{ width }}
        value={display}
        placeholder="Search airport"
        onFocus={() => { setOpen(true); setText(''); measure() }}
        onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 150) }}
        onChange={(e) => { setText(e.target.value); setOpen(true); if (!e.target.value.trim()) onChange('') }}
      />
      {showMenu && rect && createPortal(
        <ul role="listbox" style={{ position: 'fixed', zIndex: 1000, top: rect.top, left: rect.left, width: rect.width, maxHeight: 260, overflowY: 'auto', margin: 0, padding: 4, listStyle: 'none', background: '#fff', border: '1px solid var(--color-line, rgba(0,0,0,.12))', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
          {results.map((a) => (
            <li key={a.iata} role="option">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(a)}
                style={{ display: 'flex', gap: 8, width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 8px', borderRadius: 6, fontSize: 13 }}>
                <span className="mono" style={{ fontWeight: 600, minWidth: 34 }}>{a.iata}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.city || a.name}</span>
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  )
}
