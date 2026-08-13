import { useMemo, useState } from 'react'
import { X } from 'lucide-react'

export type McsOption = { value: string; label: string }

type Props = {
  options: McsOption[]
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}

// Searchable multi-select rendered as chips + a dropdown of remaining options.
// Not inside an overflow-clipping container, so the dropdown is free to expand.
export default function MultiChipSelect({ options, value, onChange, placeholder }: Props) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const selectedSet = useMemo(() => new Set(value), [value])

  const labelFor = useMemo(() => {
    const m = new Map(options.map((o) => [o.value, o.label]))
    return (v: string) => m.get(v) ?? v
  }, [options])

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase()
    const base = options.filter((o) => !selectedSet.has(o.value))
    if (!q) return base.slice(0, 40)
    return base
      .filter((o) => o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q))
      .slice(0, 40)
  }, [options, term, selectedSet])

  function add(v: string) {
    if (!selectedSet.has(v)) onChange([...value, v])
    setTerm('')
  }
  function remove(v: string) {
    onChange(value.filter((x) => x !== v))
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="input"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 40, alignItems: 'center', cursor: 'text', height: 'auto', paddingTop: 6, paddingBottom: 6 }}
        onClick={() => setOpen(true)}
      >
        {value.map((v) => (
          <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EEF1F5', borderRadius: 6, padding: '2px 8px', fontSize: 13 }}>
            {labelFor(v)}
            <button type="button" aria-label={`Remove ${v}`} onClick={(e) => { e.stopPropagation(); remove(v) }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', color: 'var(--muted-foreground)', padding: 0 }}>
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={value.length ? '' : (placeholder ?? 'Search…')}
          style={{ border: 'none', outline: 'none', flex: 1, minWidth: 90, background: 'transparent', fontSize: 14 }}
        />
      </div>
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 30, top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid var(--border, #D9DEE6)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 260, overflow: 'auto' }}>
          {filtered.map((o) => (
            <button key={o.value} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(o.value)}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 12px', cursor: 'pointer', fontSize: 14 }}>
              <span className="mono" style={{ color: 'var(--muted-foreground)', marginRight: 8 }}>{o.value}</span>{o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
