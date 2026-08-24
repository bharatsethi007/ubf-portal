import { Copy, X, AlertTriangle } from 'lucide-react'
import { computeCargoLine, type QuoteCargoLine } from './quoteCargoApi'

type Props = {
  row: QuoteCargoLine
  mode: 'air' | 'sea'
  onUpdate: (patch: Partial<QuoteCargoLine>) => void
  onRemove: () => void
  onDuplicate: () => void
}

function fmt4(n: number): string {
  return n ? n.toFixed(4) : ''
}

function fmt2(n: number): string {
  return n ? n.toFixed(2) : ''
}

export default function QuoteCargoLineRow({ row, mode, onUpdate, onRemove, onDuplicate }: Props) {
  const computed = computeCargoLine(row, mode)

  // All three dimensions entered but the volume rounds to zero → almost always a
  // unit mistake (e.g. metric sizes typed while the unit is still CM).
  const l = Number(row.length)
  const w = Number(row.width)
  const h = Number(row.height)
  const hasDims = [l, w, h].every((n) => Number.isFinite(n) && n > 0)
  const dimsWarn = hasDims && computed.cbm === 0

  function toggleOverride(checked: boolean) {
    if (checked) {
      onUpdate({
        override_chargeable: true,
        chargeable_wt: fmt2(computed.chargeable),
      })
    } else {
      onUpdate({ override_chargeable: false, chargeable_wt: '' })
    }
  }

  return (
    <>
      <tr>
        <td className="cargo-table__actions">
          <div className="cargo-table__actions-inner">
            <button type="button" className="cargo-table__icon cargo-table__icon--danger" onClick={onRemove} aria-label="Delete row">
              <X size={14} />
            </button>
            <button type="button" className="cargo-table__icon" onClick={onDuplicate} aria-label="Duplicate row">
              <Copy size={14} />
            </button>
          </div>
        </td>
        <td>
          <input
            className="cargo-table__input cargo-table__desc"
            list="cargo-desc-suggest"
            value={row.cargo_description}
            onChange={(e) => onUpdate({ cargo_description: e.target.value })}
          />
        </td>
        <td>
          <input
            className="cargo-table__input cargo-table__pkg"
            list="pkg-type-suggest"
            placeholder="PACKAGE(S)"
            value={row.package_type}
            onChange={(e) => onUpdate({ package_type: e.target.value })}
          />
        </td>
        <td>
          <input
            className="cargo-table__input cargo-table__pieces"
            inputMode="numeric"
            value={row.quantity}
            onChange={(e) => onUpdate({ quantity: e.target.value })}
          />
        </td>
        <td>
          <select
            className="cargo-table__select cargo-table__unit"
            value={row.weight_unit}
            onChange={(e) => onUpdate({ weight_unit: e.target.value })}
          >
            <option value="KG">KG</option>
            <option value="LB">LB</option>
          </select>
        </td>
        <td>
          <input
            className="cargo-table__input cargo-table__num"
            inputMode="decimal"
            value={row.per_package_weight}
            onChange={(e) => onUpdate({ per_package_weight: e.target.value })}
          />
        </td>
        <td>
          {Number(row.per_package_weight) > 0 ? (
            <input
              className="cargo-table__input cargo-table__num cargo-table__input--readonly"
              readOnly
              tabIndex={-1}
              value={fmt2(computed.grossTotal)}
            />
          ) : (
            <input
              className="cargo-table__input cargo-table__num"
              inputMode="decimal"
              value={row.total_weight}
              onChange={(e) => onUpdate({ total_weight: e.target.value })}
            />
          )}
        </td>
        <td>
          <input
            className="cargo-table__input cargo-table__dim"
            inputMode="decimal"
            value={row.length}
            onChange={(e) => onUpdate({ length: e.target.value })}
          />
        </td>
        <td>
          <input
            className="cargo-table__input cargo-table__dim"
            inputMode="decimal"
            value={row.width}
            onChange={(e) => onUpdate({ width: e.target.value })}
          />
        </td>
        <td>
          <input
            className="cargo-table__input cargo-table__dim"
            inputMode="decimal"
            value={row.height}
            onChange={(e) => onUpdate({ height: e.target.value })}
          />
        </td>
        <td>
          <select
            className="cargo-table__select cargo-table__unit"
            value={row.dim_unit}
            onChange={(e) => onUpdate({ dim_unit: e.target.value })}
          >
            <option value="CM">CM</option>
            <option value="M">M</option>
            <option value="IN">IN</option>
          </select>
        </td>
        <td>
          <input
            className="cargo-table__input cargo-table__num cargo-table__input--readonly"
            readOnly
            tabIndex={-1}
            value={fmt4(computed.cbm)}
          />
        </td>
        <td>
          <input
            className="cargo-table__input cargo-table__num cargo-table__input--readonly"
            readOnly
            tabIndex={-1}
            value={fmt4(computed.totalCbm)}
          />
        </td>
        <td>
          {row.override_chargeable ? (
            <input
              className="cargo-table__input cargo-table__num"
              inputMode="decimal"
              value={row.chargeable_wt}
              onChange={(e) => onUpdate({ chargeable_wt: e.target.value })}
            />
          ) : (
            <input
              className="cargo-table__input cargo-table__num cargo-table__input--readonly"
              readOnly
              tabIndex={-1}
              value={fmt2(computed.chargeable)}
            />
          )}
        </td>
        <td className="cargo-table__override">
          <input
            type="checkbox"
            checked={row.override_chargeable}
            onChange={(e) => toggleOverride(e.target.checked)}
            aria-label="Override chargeable weight"
          />
        </td>
      </tr>
      {dimsWarn && (
        <tr>
          <td colSpan={15} style={{ padding: '4px 10px 8px', border: 'none' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 500,
                color: '#b45309',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 6,
                padding: '3px 8px',
              }}
            >
              <AlertTriangle size={13} aria-hidden />
              The dims seem to be incorrect. Try entering cms, or change the unit to Metres.
            </span>
          </td>
        </tr>
      )}
    </>
  )
}
