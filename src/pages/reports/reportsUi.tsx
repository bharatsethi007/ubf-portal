import { useMemo, useState, type CSSProperties } from 'react'

export const NAVY = '#0A2472'
export const ORANGE = '#F7941D'
export const BLUE = '#5B8DEF'
export const C = {
  ink: '#1A1E24', ink2: '#5B6470', mut: '#9499A2', faint: '#CBD0D7',
  border: '#E8EAEF', line: '#EFF1F4', chip: '#F4F5F7', green: '#1FA463',
  navySoft: '#EAEDF6', orangeSoft: '#FEF2E3', red: '#E03257',
}
export const FONT = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"

export const glass: CSSProperties = {
  background: 'rgba(255,255,255,0.7)',
  backdropFilter: 'blur(16px) saturate(150%)',
  WebkitBackdropFilter: 'blur(16px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.75)',
  boxShadow: '0 1px 2px rgba(16,19,23,.04), 0 10px 30px rgba(16,19,23,.05), inset 0 1px 0 rgba(255,255,255,.6)',
  borderRadius: 16,
}

export const nf = new Intl.NumberFormat('en-NZ')
export const cf = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 })

export const Card = ({ children, style, pad = 18 }: any) => (
  <div style={{ ...glass, padding: pad, ...style }}>{children}</div>
)
export const Title = ({ children, right }: any) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
    <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{children}</span>{right}
  </div>
)
export const LegendDot = ({ c, t }: any) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.ink2 }}>
    <span style={{ width: 8, height: 8, borderRadius: 99, background: c }} />{t}
  </span>
)

export function Seg<T extends string>({ options, value, onChange }: { options: { k: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: C.chip, borderRadius: 9, padding: 3 }}>
      {options.map((o) => {
        const on = o.k === value
        return (
          <button key={o.k} onClick={() => onChange(o.k)} style={{
            border: 'none', cursor: 'pointer', padding: '5px 12px', borderRadius: 7, fontSize: 12,
            fontWeight: on ? 600 : 500, background: on ? '#fff' : 'transparent', color: on ? NAVY : C.mut,
            boxShadow: on ? '0 1px 2px rgba(16,19,23,.08)' : 'none',
          }}>{o.label}</button>
        )
      })}
    </div>
  )
}

export type Kpi = { label: string; value: string; delta?: string; accent?: string }
export const KpiRail = ({ items }: { items: Kpi[] }) => (
  <Card pad={0} style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
    {items.map((k, i) => (
      <div key={i} style={{ minWidth: 0, padding: '16px 16px', borderLeft: i ? `1px solid ${C.line}` : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <span style={{ width: 2, height: 11, background: k.accent || C.faint, borderRadius: 2 }} />
          <span style={{ fontSize: 11.5, color: C.ink2, fontWeight: 450, whiteSpace: 'nowrap' }}>{k.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{k.value}</span>
          {k.delta && <span style={{ fontSize: 11.5, color: C.mut, fontWeight: 500 }}>{k.delta}</span>}
        </div>
      </div>
    ))}
  </Card>
)

export const Th = ({ children, right }: any) => (
  <th style={{ textAlign: right ? 'right' : 'left', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: C.mut, padding: '14px 12px 10px', whiteSpace: 'nowrap' }}>{children}</th>
)
export const Td = ({ children, right, strong, muted, trunc, title }: any) => (
  <td
    title={title}
    style={{
      textAlign: right ? 'right' : 'left',
      fontSize: 12.5,
      fontWeight: strong ? 600 : 450,
      color: muted ? C.mut : C.ink,
      padding: '10px 12px',
      whiteSpace: 'nowrap',
      fontVariantNumeric: right ? 'tabular-nums' : 'normal',
      ...(trunc ? { overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0 } : {}),
    }}
  >
    {children}
  </td>
)

/* ── searchable combobox (handles 1000s of options) ── */
export type Opt = { value: string; label: string }
export function SearchSelect({
  value, onChange, options, placeholder = 'All', width = 220,
}: { value: string | null; onChange: (v: string | null) => void; options: Opt[]; placeholder?: string; width?: number }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value) || null
  const q = text.trim().toLowerCase()
  const list = useMemo(() => (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options).slice(0, 50), [q, options])
  return (
    <div style={{ position: 'relative', width }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${C.border}`, borderRadius: 9, background: 'rgba(255,255,255,.7)', padding: '6px 8px' }}>
        <input
          value={open ? text : selected?.label ?? ''}
          placeholder={placeholder}
          onFocus={() => { setOpen(true); setText('') }}
          onChange={(e) => { setText(e.target.value); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%', color: C.ink, fontFamily: FONT }}
        />
        {value && (
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(null); setText(''); setOpen(false) }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.mut, fontSize: 16, lineHeight: 1 }} aria-label="Clear">×</button>
        )}
      </div>
      {open && list.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, right: 0, maxHeight: 260, overflowY: 'auto', ...glass, background: 'rgba(255,255,255,.98)', padding: 6 }}>
          {list.map((o) => (
            <div key={o.value} onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(o.value); setText(''); setOpen(false) }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.chip)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              style={{ padding: '7px 9px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: o.value === value ? NAVY : C.ink }}>
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
