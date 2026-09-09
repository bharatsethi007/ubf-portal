import { Copy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CourierPiece } from './CourierCargoPanel'
import './courierPieceCards.css'

function patchPiece(pieces: CourierPiece[], id: string, patch: Partial<CourierPiece>) {
  return pieces.map((row) => (row.id === id ? { ...row, ...patch } : row))
}

function fmt(n: number, d = 1): string {
  if (!n) return '0'
  return n.toFixed(d)
}

type Props = {
  pieces: CourierPiece[]
  onChange: (pieces: CourierPiece[]) => void
  onAddPiece: () => void
}

export default function CourierPieceRows({ pieces, onChange, onAddPiece }: Props) {
  let totalQty = 0
  let totalWeight = 0

  for (const row of pieces) {
    const qty = Number(row.qty) || 0
    const w = Number(row.weightKg) || 0
    totalQty += qty
    totalWeight += qty * w
  }

  function update(id: string, patch: Partial<CourierPiece>) {
    onChange(patchPiece(pieces, id, patch))
  }

  function remove(id: string) {
    const next = pieces.filter((r) => r.id !== id)
    onChange(next.length ? next : [{ id: crypto.randomUUID(), qty: '', weightKg: '', lengthCm: '', widthCm: '', heightCm: '' }])
  }

  function duplicate(id: string) {
    const src = pieces.find((r) => r.id === id)
    if (!src) return
    onChange([...pieces, { ...src, id: crypto.randomUUID() }])
  }

  return (
    <div className="cpc">
      <div className="cpc__list">
        {pieces.map((row) => (
          <div key={row.id} className="cpc__card">
            <label className="cpc__field">
              <span className="cpc__label">Qty</span>
              <input className="cpc__input" inputMode="numeric" value={row.qty} onChange={(e) => update(row.id, { qty: e.target.value })} />
            </label>
            <label className="cpc__field">
              <span className="cpc__label">Weight (kg)</span>
              <input className="cpc__input cpc__input--weight" inputMode="decimal" value={row.weightKg} onChange={(e) => update(row.id, { weightKg: e.target.value })} />
            </label>
            <div className="cpc__field">
              <span className="cpc__label">L × W × H (cm)</span>
              <div className="cpc__dims">
                <input className="cpc__input cpc__input--dim" inputMode="decimal" value={row.lengthCm} onChange={(e) => update(row.id, { lengthCm: e.target.value })} aria-label="Length cm" />
                <span className="cpc__sep">×</span>
                <input className="cpc__input cpc__input--dim" inputMode="decimal" value={row.widthCm} onChange={(e) => update(row.id, { widthCm: e.target.value })} aria-label="Width cm" />
                <span className="cpc__sep">×</span>
                <input className="cpc__input cpc__input--dim" inputMode="decimal" value={row.heightCm} onChange={(e) => update(row.id, { heightCm: e.target.value })} aria-label="Height cm" />
              </div>
            </div>
            <div className="cpc__actions">
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => duplicate(row.id)} aria-label="Duplicate piece">
                <Copy size={14} />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(row.id)} aria-label="Remove piece">
                <X size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="cpc__totals">
        <span>Total pieces: <strong>{fmt(totalQty, 0)}</strong></span>
        <span>Total weight: <strong>{fmt(totalWeight, 2)} kg</strong></span>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={onAddPiece}>
        Add piece
      </Button>
    </div>
  )
}
