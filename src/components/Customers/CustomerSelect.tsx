import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus, Search } from 'lucide-react'
import { useCustomerSearch, type CustomerPickerValue } from '../../hooks/useBookings'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import NotInCfBadge from './NotInCfBadge'
import QuickCustomerDialog from './QuickCustomerDialog'

type Props = {
  value: CustomerPickerValue | null
  onChange: (c: CustomerPickerValue) => void
  /** Class for the trigger's name text, so it can match the page heading. */
  nameClassName?: string
  placeholder?: string
}

/** Dropdown-style customer switcher with search and a quick "new customer" popup. */
export default function CustomerSelect({ value, onChange, nameClassName, placeholder = 'Select customer' }: Props) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [creating, setCreating] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const debounced = useDebouncedValue(term, 250)
  const { data, loading } = useCustomerSearch(open ? debounced : '')

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(c: CustomerPickerValue) {
    onChange(c)
    setOpen(false)
    setTerm('')
  }

  const q = term.trim()

  return (
    <div ref={box} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Change customer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid transparent', borderRadius: 8,
          background: open ? '#F1F5F9' : 'transparent', padding: '2px 6px', margin: '-2px -6px', cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#E2E8F0' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent' }}
      >
        <span className={nameClassName}>{value?.name || placeholder}</span>
        <ChevronDown size={16} color="#64748B" />
      </button>
      <NotInCfBadge source={value?.source} />

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: -6, zIndex: 40, width: 380, background: '#fff',
            border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 12px 32px rgba(15,23,42,.12)', overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: '1px solid #EEF2F6' }}>
            <Search size={14} color="#94A3B8" />
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search customer name…"
              style={{ border: 0, outline: 'none', flex: 1, fontSize: 13, background: 'transparent' }}
            />
          </div>
          <ul role="listbox" style={{ listStyle: 'none', margin: 0, padding: 4, maxHeight: 280, overflowY: 'auto' }}>
            {q.length < 2 ? (
              <li className="text-muted-foreground" style={{ padding: '8px 10px', fontSize: 12 }}>Type 2+ letters to search</li>
            ) : loading ? (
              <li className="text-muted-foreground" style={{ padding: '8px 10px', fontSize: 12 }}>Searching…</li>
            ) : data.length === 0 ? (
              <li className="text-muted-foreground" style={{ padding: '8px 10px', fontSize: 12 }}>No matches</li>
            ) : (
              data.map((c) => (
                <li key={c.account_id} role="option" aria-selected={c.account_id === value?.account_id}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', border: 0,
                      background: c.account_id === value?.account_id ? '#EFF4FF' : 'transparent',
                      padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F6F7F9' }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = c.account_id === value?.account_id ? '#EFF4FF' : 'transparent'
                    }}
                  >
                    <span style={{ fontWeight: 500, color: '#0F172A' }}>{c.name}</span>
                    <span className="mono text-muted-foreground" style={{ fontSize: 11 }}>{c.account_id}</span>
                    <span style={{ marginLeft: 'auto' }}><NotInCfBadge source={c.source} /></span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <button
            type="button"
            onClick={() => { setCreating(true); setOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%', border: 0, borderTop: '1px solid #EEF2F6',
              background: '#FAFBFC', padding: '9px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#2563EB',
            }}
          >
            <Plus size={14} /> New customer{q ? ` "${q}"` : ''}
          </button>
        </div>
      )}

      <QuickCustomerDialog open={creating} initialName={q} onClose={() => setCreating(false)} onCreated={(c) => pick(c)} />
    </div>
  )
}
