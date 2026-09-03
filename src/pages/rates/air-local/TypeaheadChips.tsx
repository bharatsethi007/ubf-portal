import { useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'

export type TypeaheadItem = { code: string; label: string }

type Props = {
  value: string[]
  onChange: (v: string[]) => void
  search: (q: string, limit: number) => TypeaheadItem[]
  resolve: (code: string) => string
  placeholder?: string
}

// Chip multi-select backed by a client-side typeahead (airports / airlines).
// Kept out of any overflow-clipping container so the dropdown can expand freely.
export default function TypeaheadChips({ value, onChange, search, resolve, placeholder }: Props) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const blurTimer = useRef<number | undefined>(undefined)
  const selectedSet = useMemo(() => new Set(value), [value])

  const q = term.trim()
  const results = useMemo(() => (q ? search(q, 10).filter((r) => !selectedSet.has(r.code)) : []), [q, search, selectedSet])
  const showMenu = open && q.length > 0 && results.length > 0

  function add(code: string) {
    if (!selectedSet.has(code)) onChange([...value, code])
    setTerm('')
  }
  function remove(code: string) {
    onChange(value.filter((x) => x !== code))
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="input"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 40, alignItems: 'center', cursor: 'text', height: 'auto', paddingTop: 6, paddingBottom: 6 }}
        onClick={() => setOpen(true)}
      >
        {value.map((code) => (
          <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EEF1F5', borderRadius: 6, padding: '2px 8px', fontSize: 13 }}>
            {resolve(code)}
            <button type="button" aria-label={`Remove ${code}`} onClick={(e) => { e.stopPropagation(); remove(code) }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', color: 'var(--muted-foreground)', padding: 0 }}>
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 150) }}
          placeholder={value.length ? '' : (placeholder ?? 'Search…')}
          style={{ border: 'none', outline: 'none', flex: 1, minWidth: 110, background: 'transparent', fontSize: 14 }}
        />
      </div>
      {showMenu && (
        <div style={{ position: 'absolute', zIndex: 30, top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid var(--border, #D9DEE6)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 260, overflow: 'auto' }}>
          {results.map((r) => (
            <button key={r.code} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(r.code)}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 12px', cursor: 'pointer', fontSize: 14 }}>
              <span className="mono" style={{ color: 'var(--muted-foreground)', marginRight: 8 }}>{r.code}</span>{r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
