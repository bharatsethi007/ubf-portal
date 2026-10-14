import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { fmtNum } from './eaTypes'
import { Tag } from './eaUi'
import { currentLines, pieceView } from './eaDims'
import type { CargoLine } from './useEaBooking'

const MAX_PCS = 24
const grid = 'grid grid-cols-[22px_80px_minmax(150px,1.4fr)_repeat(3,minmax(64px,1fr))] items-center gap-x-3'

/** Dimension lines. Collapsed: one overview row per line. Open: one row per piece. */
export default function EaPieceLines({ lines, empty = 'No dimensions yet. Edit the HAWB to add L × W × H.' }: { lines: CargoLine[]; empty?: string }) {
  const { kind, lines: ls } = currentLines(lines)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const flip = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const all = ls.length > 0 && ls.every((l) => open.has(l.id))
  if (!ls.length) return <p className="m-0 py-2 text-[12px] text-[#98A2B3]">{empty}</p>

  return (
    <div className="text-[12px]">
      <div className={`${grid} border-b border-[#F1F2F5] py-1.5 text-[10px] uppercase tracking-[.05em] text-[#98A2B3]`}>
        <button type="button" onClick={() => setOpen(all ? new Set() : new Set(ls.map((l) => l.id)))} title={all ? 'Collapse all' : 'Expand all'}
          className="inline-flex h-5 w-5 items-center justify-center rounded border-0 bg-transparent p-0 text-[#98A2B3] hover:bg-[#F2F4F7]">
          <ChevronRight size={12} style={{ transform: all ? 'rotate(90deg)' : undefined }} className="transition-transform" />
        </button>
        <span>Line</span><span>L × W × H</span><span className="text-right">Kg</span><span className="text-right">m³</span><span className="text-right">Vol kg</span>
      </div>
      {ls.map((l, i) => {
        const v = pieceView(l)
        const isOpen = open.has(l.id)
        const shown = Math.min(v.pcs, MAX_PCS)
        return (
          <div key={l.id} className="border-b border-[#F6F7F9] last:border-b-0">
            <button type="button" onClick={() => flip(l.id)} aria-expanded={isOpen}
              className={`${grid} bk-mono w-full border-0 bg-transparent py-[7px] text-left text-[12px] text-[#14161A] hover:bg-[#F8F9FB]`}>
              <ChevronRight size={12} className="justify-self-center text-[#98A2B3] transition-transform" style={{ transform: isOpen ? 'rotate(90deg)' : undefined }} />
              <span className="font-sans">{i + 1} · <b className="font-medium">{fmtNum(v.pcs)}</b> pc{v.pcs === 1 ? '' : 's'}</span>
              <span className={v.dims ? '' : 'font-sans text-[#B54708]'}>{v.dims ?? 'No dims'}{v.pcs > 1 && v.dims ? <span className="font-sans text-[#98A2B3]"> each</span> : null}</span>
              <span className="text-right">{fmtNum(v.kg, 1)}</span>
              <span className="text-right">{fmtNum(v.cbm, 3)}</span>
              <span className={`text-right ${v.vol != null && v.kg != null && v.vol > v.kg ? 'text-[#B54708]' : 'text-[#5B616E]'}`}>{fmtNum(v.vol)}</span>
            </button>
            {isOpen ? (
              <div className="bg-[#FAFBFC] pb-1 duration-150 animate-in fade-in-0">
                {Array.from({ length: shown }, (_, p) => (
                  <div key={p} className={`${grid} bk-mono py-[5px] text-[11.5px] text-[#5B616E]`}>
                    <span />
                    <span className="font-sans text-[#98A2B3]">Pc {p + 1}</span>
                    <span>{v.dims ?? '—'}</span>
                    <span className="text-right">{fmtNum(v.kgEach, 1)}</span>
                    <span className="text-right">{fmtNum(v.cbmEach, 3)}</span>
                    <span className="text-right">{fmtNum(v.cbmEach != null ? Math.ceil(v.cbmEach * 167) : null)}</span>
                  </div>
                ))}
                {v.pcs > shown ? <div className="px-[34px] py-1 text-[11px] text-[#98A2B3]">+{v.pcs - shown} more identical pieces</div> : null}
              </div>
            ) : null}
          </div>
        )
      })}
      {kind === 'actual' ? <div className="pt-1.5"><Tag tone="navy">Warehouse measured</Tag></div> : null}
    </div>
  )
}
