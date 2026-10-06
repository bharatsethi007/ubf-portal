// Cargo lines for an export air booking: pieces, dims (cm), weight; totals with air chargeable weight (1:6000).
import { Plus, X } from 'lucide-react'
import { totals, type EaLine } from './eaBookingApi'

const n = (v: string) => (v.trim() === '' ? null : Number(v))

export default function EaCargoLines({ lines, onChange }: { lines: EaLine[]; onChange: (l: EaLine[]) => void }) {
  const rows = lines.length ? lines : [{}]
  const t = totals(rows)
  const set = (i: number, k: keyof EaLine, v: string) => onChange(rows.map((l, j) => (j === i ? { ...l, [k]: n(v) } : l)))
  const cell = (i: number, k: keyof EaLine, label: string) => (
    <input className="ibx-in ibx-in--num" inputMode="decimal" aria-label={label} placeholder={label}
      value={rows[i][k] ?? ''} onChange={(e) => set(i, k, e.target.value)} />
  )
  return (
    <div className="ibx-lines">
      <div className="ibx-lines__head"><span>Pieces</span><span>L cm</span><span>W cm</span><span>H cm</span><span>Weight kg</span><span /></div>
      {rows.map((_, i) => (
        <div key={i} className="ibx-lines__row">
          {cell(i, 'pieces', 'Pieces')}{cell(i, 'l', 'Length')}{cell(i, 'w', 'Width')}{cell(i, 'h', 'Height')}{cell(i, 'kg', 'Weight')}
          <button type="button" className="ibx-mail__icon" style={{ width: 28, height: 28 }} aria-label="Remove line"
            onClick={() => onChange(rows.filter((__, j) => j !== i))}><X size={14} /></button>
        </div>
      ))}
      <div className="ibx-lines__foot">
        <button type="button" className="ibx-link" onClick={() => onChange([...rows, {}])}><Plus size={13} style={{ verticalAlign: -2 }} /> Add line</button>
        <span style={{ marginLeft: 'auto' }}>{t.pcs || 0} pcs · {t.kg ? t.kg.toFixed(1) : 0} kg · {t.cbm.toFixed(3)} m³ · Chargeable {t.chargeable} kg</span>
      </div>
    </div>
  )
}
