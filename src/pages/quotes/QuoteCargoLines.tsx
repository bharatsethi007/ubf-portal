import { Copy, X } from 'lucide-react'
import type { QuoteCargoLine } from './quoteCargoApi'
import { newQuoteCargoLine } from './quoteCargoApi'
import '../../components/bookings/cargoLinesTable.css'

type Props = {
  lines: QuoteCargoLine[]
  onChange: (lines: QuoteCargoLine[]) => void
}

function patchLine(lines: QuoteCargoLine[], id: string, patch: Partial<QuoteCargoLine>) {
  return lines.map((row) => (row.id === id ? { ...row, ...patch } : row))
}

function sumField(lines: QuoteCargoLine[], key: keyof QuoteCargoLine): number {
  return lines.reduce((acc, row) => {
    const n = Number(row[key])
    return acc + (Number.isFinite(n) ? n : 0)
  }, 0)
}

function fmtNum(n: number, decimals: number): string {
  if (!n) return '0'
  return n.toFixed(decimals).replace(/\.?0+$/, '') || '0'
}

export default function QuoteCargoLines({ lines, onChange }: Props) {
  const totalPackages = sumField(lines, 'packages')
  const totalCbm = sumField(lines, 'volume_cbm')
  const totalGross = sumField(lines, 'gross_wt')
  const totalChargeable = sumField(lines, 'chargeable_wt')

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
      <table className="cargo-table">
        <thead>
          <tr>
            <th className="cargo-table__actions">Actions</th>
            <th className="cargo-table__desc">Cargo Description</th>
            <th>Type / Package</th>
            <th className="cargo-table__pieces">Packages</th>
            <th className="cargo-table__num">Volume CBM</th>
            <th className="cargo-table__num">Vol. Wt</th>
            <th className="cargo-table__num">Gross Wt</th>
            <th className="cargo-table__num">Chargeable Wt</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((row) => (
            <tr key={row.id}>
              <td className="cargo-table__actions">
                <div className="cargo-table__actions-inner">
                  <button
                    type="button"
                    className="cargo-table__icon cargo-table__icon--danger"
                    onClick={() => remove(row.id)}
                    aria-label="Delete row"
                  >
                    <X size={14} />
                  </button>
                  <button
                    type="button"
                    className="cargo-table__icon"
                    onClick={() => duplicate(row.id)}
                    aria-label="Duplicate row"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </td>
              <td>
                <input
                  className="cargo-table__input cargo-table__desc"
                  value={row.cargo_description}
                  onChange={(e) => update(row.id, { cargo_description: e.target.value })}
                />
              </td>
              <td>
                <input
                  className="cargo-table__input cargo-table__desc"
                  placeholder="PACKAGE(S)"
                  value={row.package_type}
                  onChange={(e) => update(row.id, { package_type: e.target.value })}
                />
              </td>
              <td>
                <input
                  className="cargo-table__input cargo-table__pieces"
                  inputMode="numeric"
                  value={row.packages}
                  onChange={(e) => update(row.id, { packages: e.target.value })}
                />
              </td>
              <td>
                <input
                  className="cargo-table__input cargo-table__num"
                  inputMode="decimal"
                  value={row.volume_cbm}
                  onChange={(e) => update(row.id, { volume_cbm: e.target.value })}
                />
              </td>
              <td>
                <input
                  className="cargo-table__input cargo-table__num"
                  inputMode="decimal"
                  value={row.volume_wt}
                  onChange={(e) => update(row.id, { volume_wt: e.target.value })}
                />
              </td>
              <td>
                <input
                  className="cargo-table__input cargo-table__num"
                  inputMode="decimal"
                  value={row.gross_wt}
                  onChange={(e) => update(row.id, { gross_wt: e.target.value })}
                />
              </td>
              <td>
                <input
                  className="cargo-table__input cargo-table__num"
                  inputMode="decimal"
                  value={row.chargeable_wt}
                  onChange={(e) => update(row.id, { chargeable_wt: e.target.value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Totals</td>
            <td>{fmtNum(totalPackages, 0)}</td>
            <td>{fmtNum(totalCbm, 4)}</td>
            <td />
            <td>{fmtNum(totalGross, 2)}</td>
            <td>{fmtNum(totalChargeable, 2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
