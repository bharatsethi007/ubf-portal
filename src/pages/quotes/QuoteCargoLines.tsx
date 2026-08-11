import { useEffect, useState } from 'react'
import { computeCargoLine, fetchCargoDescriptionSuggestions, newQuoteCargoLine, type QuoteCargoLine } from './quoteCargoApi'
import QuoteCargoLineRow from './QuoteCargoLineRow'
import '../../components/bookings/cargoLinesTable.css'

type Props = {
  lines: QuoteCargoLine[]
  mode: 'air' | 'sea'
  onChange: (lines: QuoteCargoLine[]) => void
}

function patchLine(lines: QuoteCargoLine[], id: string, patch: Partial<QuoteCargoLine>) {
  return lines.map((row) => (row.id === id ? { ...row, ...patch } : row))
}

function lineChargeable(row: QuoteCargoLine, mode: 'air' | 'sea'): number {
  if (row.override_chargeable) {
    const n = Number(row.chargeable_wt)
    return Number.isFinite(n) ? n : 0
  }
  return computeCargoLine(row, mode).chargeable
}

function fmtTotal(n: number, decimals: number): string {
  if (!n) return '0'
  return n.toFixed(decimals)
}

export default function QuoteCargoLines({ lines, mode, onChange }: Props) {
  const [descOpts, setDescOpts] = useState<string[]>([])
  useEffect(() => { fetchCargoDescriptionSuggestions().then(setDescOpts).catch(() => {}) }, [])

  let totalQty = 0
  let totalCbm = 0
  let totalWeight = 0
  let totalChargeable = 0

  for (const row of lines) {
    const c = computeCargoLine(row, mode)
    totalQty += Number(row.quantity) || Number(row.packages) || 0
    totalCbm += c.totalCbm
    totalWeight += c.grossTotal
    totalChargeable += lineChargeable(row, mode)
  }

  function update(id: string, patch: Partial<QuoteCargoLine>) {
    onChange(patchLine(lines, id, patch))
  }

  function remove(id: string) {
    const next = lines.filter((r) => r.id !== id)
    onChange(next.length ? next : [newQuoteCargoLine(0)])
  }

  function duplicate(id: string) {
    const src = lines.find((r) => r.id === id)
    if (!src) return
    onChange([...lines, { ...src, id: crypto.randomUUID(), ord: lines.length }])
  }

  return (
    <div className="cargo-table-wrap">
      <datalist id="cargo-desc-suggest">{descOpts.map((d) => <option key={d} value={d} />)}</datalist>
      <datalist id="pkg-type-suggest">{['Pallets','Cartons','Crates','Rolls','Packages','Drums','Coils'].map((p) => <option key={p} value={p} />)}</datalist>
      <table className="cargo-table cargo-table--quote-loads">
        <thead>
          <tr>
            <th className="cargo-table__actions">Actions</th>
            <th className="cargo-table__desc">Cargo Description</th>
            <th className="cargo-table__pkg">Package Type</th>
            <th className="cargo-table__pieces">Quantity</th>
            <th className="cargo-table__unit">Weight Unit</th>
            <th className="cargo-table__num">Per Pkg Wt</th>
            <th className="cargo-table__num">Total Weight</th>
            <th className="cargo-table__dim">L</th>
            <th className="cargo-table__dim">W</th>
            <th className="cargo-table__dim">H</th>
            <th className="cargo-table__unit">Dim Unit</th>
            <th className="cargo-table__num">CBM</th>
            <th className="cargo-table__num">Total CBM</th>
            <th className="cargo-table__num">Chargeable Wt</th>
            <th className="cargo-table__override">Override</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((row) => (
            <QuoteCargoLineRow
              key={row.id}
              row={row}
              mode={mode}
              onUpdate={(patch) => update(row.id, patch)}
              onRemove={() => remove(row.id)}
              onDuplicate={() => duplicate(row.id)}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Totals</td>
            <td>{fmtTotal(totalQty, 0)}</td>
            <td />
            <td />
            <td>{fmtTotal(totalWeight, 2)}</td>
            <td colSpan={4} />
            <td />
            <td>{fmtTotal(totalCbm, 4)}</td>
            <td>{fmtTotal(totalChargeable, 2)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
