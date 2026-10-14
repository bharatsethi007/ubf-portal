import { Plus, X } from 'lucide-react'
import QuoteCargoEntry, { type CargoEntryMode } from '../QuoteCargoEntry'
import type { ContainerSize, ContainerType, QuoteContainerDraft } from '../quoteContainersApi'
import type { QuoteCargoLine } from '../quoteCargoApi'
import { Card, btn, inp, lbl } from './qdUi'
import type { QuoteMode } from './quoteMode'

const SIZES: { value: ContainerSize; label: string }[] = [
  { value: '20', label: '20ft' }, { value: '20HC', label: '20ft HC' }, { value: '40', label: '40ft' }, { value: '40HC', label: '40ft HC' },
]
const TYPES: { value: ContainerType; label: string }[] = [
  { value: 'standard', label: 'Standard (dry)' }, { value: 'reefer', label: 'Reefer' }, { value: 'opentop', label: 'Open top' },
  { value: 'flatrack', label: 'Flat rack' }, { value: 'isotank', label: 'ISO tank' }, { value: 'openside', label: 'Open side' },
]
const COLS = 'grid grid-cols-[64px_minmax(96px,1fr)_minmax(130px,1.4fr)_minmax(90px,.9fr)_minmax(140px,2fr)_30px] items-center gap-2'

type Props = {
  mode: QuoteMode
  groups: QuoteContainerDraft[]
  onPatch: (i: number, p: Partial<QuoteContainerDraft>) => void
  onAdd: () => void
  onRemove: (i: number) => void
  entryMode: CargoEntryMode
  onEntryMode: (m: CargoEntryMode) => void
  lines: QuoteCargoLine[]
  onLines: (l: QuoteCargoLine[]) => void
  onAddLine: () => void
}

function containerSummary(groups: QuoteContainerDraft[]) {
  if (!groups.length) return null
  const n = groups.reduce((s, g) => s + (g.qty || 0), 0)
  const t = groups.reduce((s, g) => s + (g.qty || 0) * (g.weight_per_container_mt || 0), 0)
  const mix = groups.map((g) => `${g.qty}×${SIZES.find((s) => s.value === g.container_size)?.label ?? g.container_size}`).join(' + ')
  return `${mix} · ${n} ctr${t ? ` · ${Math.round(t * 10) / 10} t` : ''}`
}

/** FCL: container rows. LCL / Air: the existing cargo-line entry (total or per piece). */
export default function QuoteLoadsCard(p: Props) {
  if (p.mode !== 'FCL') {
    return (
      <Card title={p.mode === 'Air' ? 'Air cargo' : 'LCL cargo'}>
        <div className="px-4 py-3.5">
          <QuoteCargoEntry mode={p.mode === 'Air' ? 'air' : 'sea'} entryMode={p.entryMode} onEntryModeChange={p.onEntryMode}
            lines={p.lines} onChange={p.onLines} onAddLine={p.onAddLine} />
        </div>
      </Card>
    )
  }

  const sum = containerSummary(p.groups)
  return (
    <Card title="Containers" aside={sum ? <span className="bk-mono text-[11.5px] text-[#5B616E]">{sum}</span> : null}>
      <div className="overflow-x-auto px-4 py-3">
        <div className="min-w-[620px]">
          {p.groups.length ? (
            <div className={`${COLS} pb-1.5`}>
              <span className={lbl}>Qty</span><span className={lbl}>Size</span><span className={lbl}>Type</span>
              <span className={lbl}>t / ctr</span><span className={lbl}>Commodity</span><span />
            </div>
          ) : (
            <p className="m-0 py-2 text-[12.5px] text-[#98A2B3]">No containers yet.</p>
          )}
          {p.groups.map((g, i) => (
            <div key={i} className={`${COLS} border-t border-[#F1F2F5] py-1.5 first-of-type:border-t-0`}>
              <input aria-label="Quantity" className={`${inp} bk-mono text-right`} type="number" min={1} value={g.qty}
                onChange={(e) => p.onPatch(i, { qty: Math.max(1, Number(e.target.value) || 1) })} />
              <select aria-label="Size" className={inp} value={g.container_size} onChange={(e) => p.onPatch(i, { container_size: e.target.value as ContainerSize })}>
                {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select aria-label="Type" className={inp} value={g.container_type} onChange={(e) => p.onPatch(i, { container_type: e.target.value as ContainerType })}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input aria-label="Weight per container (t)" className={`${inp} bk-mono text-right`} type="number" step="0.1" placeholder="—"
                value={g.weight_per_container_mt ?? ''} onChange={(e) => p.onPatch(i, { weight_per_container_mt: e.target.value === '' ? null : Number(e.target.value) })} />
              <input aria-label="Commodity" className={inp} placeholder="General" value={g.commodity ?? ''}
                onChange={(e) => p.onPatch(i, { commodity: e.target.value || null })} />
              <button type="button" aria-label="Remove container" title="Remove" onClick={() => p.onRemove(i)}
                className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border-0 bg-transparent text-[#98A2B3] hover:bg-[#FEF3F2] hover:text-[#B42318]">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-[#F1F2F5] px-4 py-2.5">
        <button type="button" className={btn} onClick={p.onAdd}><Plus size={13} /> Add container</button>
      </div>
    </Card>
  )
}
