import { Copy, X } from 'lucide-react'
import type { CargoLineRow, LengthUnit, WeightUnit } from '../../types/bookingCargoLine'
import { computeCargoTotals, computeRowCbm, newCargoLine } from './cargoLineUtils'
import './cargoLinesTable.css'

type Props = {
  lines: CargoLineRow[]
  onChange: (lines: CargoLineRow[]) => void
}

function patchLine(lines: CargoLineRow[], id: string, patch: Partial<CargoLineRow>) {
  return lines.map((row) => (row.id === id ? { ...row, ...patch } : row))
}

export default function CargoLinesTable({ lines, onChange }: Props) {
  const totals = computeCargoTotals(lines)

  function update(id: string, patch: Partial<CargoLineRow>) {
    onChange(patchLine(lines, id, patch))
  }

  function remove(id: string) {
    const next = lines.filter((r) => r.id !== id)
    onChange(next.length ? next : [newCargoLine()])
  }

  function duplicate(id: string) {
    const src = lines.find((r) => r.id === id)
    if (!src) return
    onChange([...lines, { ...src, id: crypto.randomUUID() }])
  }

  function addLine() {
    onChange([...lines, newCargoLine()])
  }

  return (
    <>
      <div className="cargo-table-wrap">
        <table className="cargo-table">
          <thead>
            <tr>
              <th className="cargo-table__actions">Actions</th>
              <th className="cargo-table__desc">Goods Description</th>
              <th className="cargo-table__pieces">No. of Pieces</th>
              <th className="cargo-table__unit">Length Unit</th>
              <th className="cargo-table__dim">Length</th>
              <th className="cargo-table__dim">Width</th>
              <th className="cargo-table__dim">Height</th>
              <th className="cargo-table__num">CBM</th>
              <th className="cargo-table__unit">Weight Unit</th>
              <th className="cargo-table__num">Weight</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((row) => {
              const cbm = computeRowCbm(row)
              return (
                <tr key={row.id}>
                  <td className="cargo-table__actions">
                    <div className="cargo-table__actions-inner">
                      <button type="button" className="cargo-table__icon cargo-table__icon--danger" onClick={() => remove(row.id)} aria-label="Delete row">
                        <X size={14} />
                      </button>
                      <button type="button" className="cargo-table__icon" onClick={() => duplicate(row.id)} aria-label="Duplicate row">
                        <Copy size={14} />
                      </button>
                    </div>
                  </td>
                  <td>
                    <input className="cargo-table__input cargo-table__desc" value={row.goodsDesc} onChange={(e) => update(row.id, { goodsDesc: e.target.value })} />
                  </td>
                  <td>
                    <input className="cargo-table__input cargo-table__pieces" inputMode="numeric" value={row.pieces} onChange={(e) => update(row.id, { pieces: e.target.value })} />
                  </td>
                  <td>
                    <select className="cargo-table__select cargo-table__unit" value={row.lengthUnit} onChange={(e) => update(row.id, { lengthUnit: e.target.value as LengthUnit })}>
                      <option value="CM">CM</option>
                      <option value="M">M</option>
                      <option value="IN">IN</option>
                    </select>
                  </td>
                  <td><input className="cargo-table__input cargo-table__dim" inputMode="decimal" value={row.length} onChange={(e) => update(row.id, { length: e.target.value })} /></td>
                  <td><input className="cargo-table__input cargo-table__dim" inputMode="decimal" value={row.width} onChange={(e) => update(row.id, { width: e.target.value })} /></td>
                  <td><input className="cargo-table__input cargo-table__dim" inputMode="decimal" value={row.height} onChange={(e) => update(row.id, { height: e.target.value })} /></td>
                  <td>
                    <input className="cargo-table__input cargo-table__dim cargo-table__input--readonly" readOnly tabIndex={-1} value={cbm == null ? '' : cbm.toFixed(4)} />
                  </td>
                  <td>
                    <select className="cargo-table__select cargo-table__unit" value={row.weightUnit} onChange={(e) => update(row.id, { weightUnit: e.target.value as WeightUnit })}>
                      <option value="KG">KG</option>
                      <option value="LB">LB</option>
                    </select>
                  </td>
                  <td><input className="cargo-table__input cargo-table__dim" inputMode="decimal" value={row.weight} onChange={(e) => update(row.id, { weight: e.target.value })} /></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Totals</td>
              <td>{totals.totalPieces ?? '—'}</td>
              <td colSpan={4} />
              <td>{totals.totalCbm == null ? '—' : totals.totalCbm.toFixed(4)}</td>
              <td>KG</td>
              <td>{totals.totalWeightKg == null ? '—' : totals.totalWeightKg.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button type="button" className="cargo-table__add" onClick={addLine}>+ Add Line</button>
      <p className="cargo-table__chargeable">
        Chargeable weight:{' '}
        <strong>{totals.chargeableWeightKg == null ? '—' : `${totals.chargeableWeightKg.toFixed(2)} kg`}</strong>
        {' '}(volumetric basis 1 CBM = 167 kg)
      </p>
    </>
  )
}
