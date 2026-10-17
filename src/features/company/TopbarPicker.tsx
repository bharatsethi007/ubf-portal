import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export type PickerOption = { value: string; label: string; icon?: ReactNode; title?: string }

type Props = {
  value: string
  options: PickerOption[]
  onPick: (value: string) => void
  disabled?: boolean
  ariaLabel: string
}

const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 8px',
  border: '1px solid var(--line, var(--border))', borderRadius: 8, background: 'var(--paper, #fff)',
  fontSize: 13, fontWeight: 400, color: 'var(--ink-2)', cursor: 'pointer',
}
const menu: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: '100%', zIndex: 60, padding: 4,
  background: 'var(--paper, #fff)', border: '1px solid var(--line, var(--border))', borderRadius: 10,
  boxShadow: '0 8px 24px rgba(16,24,40,.12)', listStyle: 'none', margin: 0,
}
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', border: 'none',
  borderRadius: 6, background: 'transparent', fontSize: 13, fontWeight: 400, color: 'var(--ink)',
  cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'left',
}

// Small topbar dropdown: chip shows icon + short label, list shows icon + label.
export default function TopbarPicker({ value, options, onPick, disabled, ariaLabel }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" style={chip} disabled={disabled} title={current?.title} aria-label={`${ariaLabel}: ${current?.label}`}
        aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {current?.icon}
        <span>{current?.label}</span>
        <ChevronDown size={13} strokeWidth={2} aria-hidden style={{ color: 'var(--muted-foreground)' }} />
      </button>
      {open ? (
        <ul role="listbox" aria-label={ariaLabel} style={menu}>
          {options.map((o) => {
            const on = o.value === value
            return (
              <li key={o.value}>
                <button type="button" role="option" aria-selected={on} title={o.title} style={row}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  onClick={() => { setOpen(false); if (!on) onPick(o.value) }}>
                  {o.icon}
                  <span style={{ flex: 1 }}>{o.label}</span>
                  {on ? <Check size={14} strokeWidth={2} aria-hidden style={{ color: 'var(--muted-foreground)' }} /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
