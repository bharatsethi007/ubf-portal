import { useState, useMemo, type CSSProperties } from 'react'
import { Calendar } from 'lucide-react'

const NAVY = '#0A2472'
const BORDER = '#E8EAEF'
const INK = '#1A1E24'
const MUT = '#9499A2'
const CHIP = '#F4F5F7'
const FONT = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"

const WD = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
function parseISO(v: string | null) {
  if (!v) return null
  const [y, m, d] = v.split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m: m - 1, d }
}
const fmt = (v: string | null) => {
  const p = parseISO(v)
  return p ? `${pad(p.d)}/${pad(p.m + 1)}/${p.y}` : ''
}

const navBtn: CSSProperties = { border: `1px solid ${BORDER}`, background: '#fff', borderRadius: 7, width: 26, height: 26, cursor: 'pointer', fontSize: 15, lineHeight: 1 }
const selStyle: CSSProperties = { flex: 1, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '4px 6px', fontSize: 12.5, fontFamily: FONT, background: '#fff' }

export default function DateField({
  value, onChange, width, placeholder = 'Select', disabled = false,
}: { value: string | null; onChange: (v: string) => void; width?: number | string; placeholder?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const sel = parseISO(value)
  const today = new Date()
  const [viewY, setViewY] = useState(sel?.y ?? today.getFullYear())
  const [viewM, setViewM] = useState(sel?.m ?? today.getMonth())

  const years = useMemo(() => {
    const base = today.getFullYear()
    const arr: number[] = []
    for (let y = base + 5; y >= base - 15; y--) arr.push(y)
    return arr
  }, [])

  const cells = useMemo(() => {
    const startDow = (new Date(viewY, viewM, 1).getDay() + 6) % 7
    const days = new Date(viewY, viewM + 1, 0).getDate()
    const out: (number | null)[] = []
    for (let i = 0; i < startDow; i++) out.push(null)
    for (let d = 1; d <= days; d++) out.push(d)
    return out
  }, [viewY, viewM])

  const openCal = () => {
    if (disabled) return
    if (sel) { setViewY(sel.y); setViewM(sel.m) }
    setOpen((o) => !o)
  }
  const prevM = () => { const m = viewM - 1; if (m < 0) { setViewM(11); setViewY(viewY - 1) } else setViewM(m) }
  const nextM = () => { const m = viewM + 1; if (m > 11) { setViewM(0); setViewY(viewY + 1) } else setViewM(m) }
  const pick = (d: number) => { onChange(toISO(viewY, viewM, d)); setOpen(false) }

  return (
    <div style={{ position: 'relative', width: width ?? '100%' }}>
      <div onClick={openCal}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, border: `1px solid ${BORDER}`, borderRadius: 9, background: disabled ? '#f3f4f6' : 'rgba(255,255,255,.7)', padding: '7px 9px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13, color: value ? INK : MUT, fontFamily: FONT }}>
        <span>{fmt(value) || placeholder}</span>
        <Calendar size={14} color={MUT} />
      </div>
      {open && !disabled && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0 10px 28px rgba(16,24,40,.14)', background: '#fff', padding: 10, width: 250 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <button type="button" onClick={prevM} style={navBtn}>&lsaquo;</button>
              <select value={viewM} onChange={(e) => setViewM(Number(e.target.value))} style={selStyle}>
                {MONTHS.map((mn, i) => <option key={i} value={i}>{mn}</option>)}
              </select>
              <select value={viewY} onChange={(e) => setViewY(Number(e.target.value))} style={selStyle}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <button type="button" onClick={nextM} style={navBtn}>&rsaquo;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {WD.map((w) => <div key={w} style={{ textAlign: 'center', fontSize: 11, color: MUT, padding: '2px 0' }}>{w}</div>)}
              {cells.map((d, i) => {
                if (d == null) return <div key={i} />
                const isSel = !!sel && sel.y === viewY && sel.m === viewM && sel.d === d
                const isToday = today.getFullYear() === viewY && today.getMonth() === viewM && today.getDate() === d
                return (
                  <div key={i} onClick={() => pick(d)}
                    style={{ textAlign: 'center', padding: '6px 0', fontSize: 12.5, borderRadius: 7, cursor: 'pointer', background: isSel ? NAVY : 'transparent', color: isSel ? '#fff' : INK, border: isToday && !isSel ? `1px solid ${NAVY}` : '1px solid transparent' }}
                    onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = CHIP }}
                    onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                    {d}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
