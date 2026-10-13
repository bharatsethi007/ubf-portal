import { Copy, Plus, Trash2 } from 'lucide-react'
import { fmtNum } from './eaTypes'
import { lbl } from './eaUi'

export type Line = { pcs: string; l: string; w: string; h: string; kg: string }
export const emptyLine = (): Line => ({ pcs: '', l: '', w: '', h: '', kg: '' })

const n = (s: string) => (s.trim() === '' ? null : Number(s))

/** Per line: kg is per line total, dims per piece in cm. */
export function lineCbm(x: Line) {
  const [p, l, w, h] = [n(x.pcs) ?? 1, n(x.l), n(x.w), n(x.h)]
  return l && w && h ? (p * l * w * h) / 1_000_000 : null
}

export function lineTotals(lines: Line[]) {
  let pcs = 0, kg = 0, cbm = 0, anyCbm = false
  for (const x of lines) {
    pcs += n(x.pcs) ?? 0
    kg += n(x.kg) ?? 0
    const c = lineCbm(x)
    if (c != null) { cbm += c; anyCbm = true }
  }
  const vol = anyCbm ? cbm * 167 : 0
  return { pcs, kg, cbm: anyCbm ? Number(cbm.toFixed(3)) : null, chg: kg || vol ? Math.ceil(Math.max(kg, vol)) : 0, volumetric: vol > kg }
}

const cell = 'bk-mono h-[30px] w-full rounded-[6px] border border-[#E3E6EB] bg-white px-2 text-right text-[12.5px] outline-none focus:border-[#0A2472]'
const icon = 'inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-[#98A2B3] hover:bg-[#F2F4F7] hover:text-[#14161A] disabled:opacity-30'

export default function EaCargoLines({ lines, onChange }: { lines: Line[]; onChange: (l: Line[]) => void }) {
  const t = lineTotals(lines)
  const set = (i: number, k: keyof Line, v: string) => onChange(lines.map((x, j) => (j === i ? { ...x, [k]: v.replace(/[^\d.]/g, '') } : x)))
  const cols = 'grid grid-cols-[72px_repeat(3,minmax(0,1fr))_minmax(0,1.1fr)_90px_64px] items-center gap-2'

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`${cols} ${lbl}`}>
        <span className="text-right">Pieces</span><span className="text-right">L cm</span><span className="text-right">W cm</span>
        <span className="text-right">H cm</span><span className="text-right">Kg (line)</span><span className="text-right">m³</span><span />
      </div>
      {lines.map((x, i) => (
        <div key={i} className={cols}>
          {(['pcs', 'l', 'w', 'h', 'kg'] as const).map((k) => (
            <input key={k} inputMode="decimal" aria-label={`Line ${i + 1} ${k}`} value={x[k]} onChange={(e) => set(i, k, e.target.value)} className={cell} />
          ))}
          <span className="bk-mono text-right text-[12px] text-[#5B616E]">{fmtNum(lineCbm(x), 3)}</span>
          <span className="flex justify-end">
            <button type="button" className={icon} title="Copy line" aria-label={`Copy line ${i + 1}`} onClick={() => onChange([...lines.slice(0, i + 1), { ...x }, ...lines.slice(i + 1)])}><Copy size={13} /></button>
            <button type="button" className={icon} title="Remove line" aria-label={`Remove line ${i + 1}`} disabled={lines.length === 1} onClick={() => onChange(lines.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
          </span>
        </div>
      ))}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-[#F1F2F5] pt-2.5">
        <button type="button" onClick={() => onChange([...lines, emptyLine()])} title="Add line" aria-label="Add line"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E3E6EB] bg-white text-[#0A2472] hover:bg-[#F6F7F9]"><Plus size={14} /></button>
        <div className="bk-mono flex gap-4 text-[12px] text-[#5B616E]">
          <span><b className="font-medium text-[#14161A]">{fmtNum(t.pcs)}</b> pcs</span>
          <span><b className="font-medium text-[#14161A]">{fmtNum(t.kg, 1)}</b> kg</span>
          <span><b className="font-medium text-[#14161A]">{fmtNum(t.cbm, 3)}</b> m³</span>
          <span>chg <b className="font-medium text-[#14161A]">{fmtNum(t.chg)}</b>{t.volumetric ? <span className="ml-1 text-[#B54708]">volumetric</span> : null}</span>
        </div>
      </div>
    </div>
  )
}
