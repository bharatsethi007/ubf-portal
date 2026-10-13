import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { filterSeaPorts, useSeaPorts, type SeaPort } from '../hooks/useSeaPorts'

type Props = { value: string; onChange: (code: string) => void; width?: number | string; placeholder?: string; className?: string }

// One code -> port map shared by every cell. Rebuilt only when the port list itself changes.
let mapFor: SeaPort[] | null = null
let byCode = new Map<string, SeaPort>()
function lookup(ports: SeaPort[], code: string): SeaPort | undefined {
  if (mapFor !== ports) { byCode = new Map(ports.map((p) => [p.code, p])); mapFor = ports }
  return byCode.get(code)
}

/**
 * Type-to-search sea port input. Renders at most 12 matches, never the full UN/LOCODE list
 * (17k+ ports), so grids with many rows stay fast.
 */
export default function SeaPortCell({ value, onChange, width = 190, placeholder = 'Search port', className = 'input input--sm' }: Props) {
  const { ports } = useSeaPorts()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const q = text.trim()
  const results = useMemo(() => (open && q ? filterSeaPorts(ports, q, 12) : []), [open, q, ports])
  const selected = value ? lookup(ports, value) : undefined

  function measure() {
    const r = inputRef.current?.getBoundingClientRect()
    if (r) setRect({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 260) })
  }

  useEffect(() => {
    if (!open) return
    const onMove = () => measure()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => { window.removeEventListener('scroll', onMove, true); window.removeEventListener('resize', onMove) }
  }, [open])

  function pick(p: SeaPort) {
    onChange(p.code)
    setText('')
    setOpen(false)
  }

  const display = open ? text : selected ? `${selected.code} · ${selected.name}` : value

  return (
    <div style={{ width }}>
      <input
        ref={inputRef}
        className={className}
        style={{ width }}
        value={display}
        title={display}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setText(''); measure() }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setText(e.target.value); setOpen(true); if (!e.target.value.trim()) onChange('') }}
      />
      {open && results.length > 0 && rect && createPortal(
        <ul role="listbox" style={{ position: 'fixed', zIndex: 1000, top: rect.top, left: rect.left, width: rect.width, maxHeight: 280, overflowY: 'auto', margin: 0, padding: 4, listStyle: 'none', background: '#fff', border: '1px solid rgba(0,0,0,.12)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
          {results.map((p) => (
            <li key={p.code} role="option">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}
                style={{ display: 'flex', gap: 8, width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 8px', borderRadius: 6, fontSize: 13 }}>
                <span className="mono" style={{ fontWeight: 600, minWidth: 52 }}>{p.code}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  )
}
