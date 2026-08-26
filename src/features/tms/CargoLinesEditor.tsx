import { Plus, X } from 'lucide-react'
import { CARGO_TYPES, cubeM3, emptyCargo, type CargoDraft } from './consignmentFormApi'

type Props = { cargo: CargoDraft[]; onChange: (c: CargoDraft[]) => void }

export default function CargoLinesEditor({ cargo, onChange }: Props) {
  const set = (i: number, patch: Partial<CargoDraft>) => onChange(cargo.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  const remove = (i: number) => onChange(cargo.length > 1 ? cargo.filter((_, idx) => idx !== i) : cargo)
  const add = () => onChange([...cargo, emptyCargo()])

  const totUnits = cargo.reduce((t, c) => t + (parseFloat(c.units) || 0), 0)
  const totWeight = cargo.reduce((t, c) => t + (parseFloat(c.weight_kg) || 0), 0)
  const totCube = cargo.reduce((t, c) => t + cubeM3(c.length_cm, c.width_cm, c.height_cm, c.units), 0)

  return (
    <div className="mt-2">
      <div className="hidden grid-cols-[1.4fr_0.7fr_0.9fr_0.8fr_0.8fr_0.8fr_0.9fr_28px] gap-2 px-1 pb-1 text-xs text-neutral-500 md:grid">
        <span>Type</span><span>Units</span><span>Weight (kg)</span><span>Length (cm)</span><span>Width (cm)</span><span>Height (cm)</span><span>Cube (m³)</span><span />
      </div>
      {cargo.map((c, i) => (
        <div key={i} className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-[1.4fr_0.7fr_0.9fr_0.8fr_0.8fr_0.8fr_0.9fr_28px] md:items-center">
          <select className="input" value={c.type} onChange={(e) => set(i, { type: e.target.value })}>
            <option value="">Select…</option>
            {CARGO_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
          </select>
          <input className="input" inputMode="decimal" placeholder="Units" value={c.units} onChange={(e) => set(i, { units: e.target.value })} />
          <input className="input" inputMode="decimal" placeholder="Weight" value={c.weight_kg} onChange={(e) => set(i, { weight_kg: e.target.value })} />
          <input className="input" inputMode="decimal" placeholder="L" value={c.length_cm} onChange={(e) => set(i, { length_cm: e.target.value })} />
          <input className="input" inputMode="decimal" placeholder="W" value={c.width_cm} onChange={(e) => set(i, { width_cm: e.target.value })} />
          <input className="input" inputMode="decimal" placeholder="H" value={c.height_cm} onChange={(e) => set(i, { height_cm: e.target.value })} />
          <span className="px-1 text-sm text-neutral-600">{cubeM3(c.length_cm, c.width_cm, c.height_cm, c.units).toFixed(4)}</span>
          <button type="button" aria-label="Remove row" className="flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-red-600" onClick={() => remove(i)}>
            <X size={15} />
          </button>
        </div>
      ))}
      <button type="button" className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-neutral-300 py-2 text-sm text-neutral-600 hover:bg-neutral-50" onClick={add}>
        <Plus size={15} /> Add Another Row
      </button>
      <div className="mt-2 flex gap-6 px-1 text-sm text-neutral-700">
        <span>Totals:</span><span>{totUnits} units</span><span>{totWeight} kg</span><span>{totCube.toFixed(4)} m³</span>
      </div>
    </div>
  )
}
