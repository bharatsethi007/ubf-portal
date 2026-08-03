import { Plus, Trash2 } from 'lucide-react'
import { useChargeCodes, useContainerTypes, useCurrencies } from '../../../hooks/useQuoteRefData'
import type { FclSurchargeDraft } from '../ratesApi'

const BASES = [
  { v: 'per_container', label: 'Per container' },
  { v: 'per_bl', label: 'Per B/L' },
  { v: 'per_cbm', label: 'Per CBM' },
  { v: 'per_teu', label: 'Per TEU' },
  { v: 'percent', label: 'Percent' },
  { v: 'flat', label: 'Flat' },
] as const

const SCOPES = ['origin', 'freight', 'dest'] as const

let tmpSeq = 0
export function newSurcharge(defaultCurrency: string): FclSurchargeDraft {
  tmpSeq += 1
  return {
    key: `tmp-${tmpSeq}`,
    dbId: null,
    charge_code: '',
    label: '',
    amount: '',
    currency_code: defaultCurrency,
    basis: 'per_container',
    scope: '',
    container_type: '',
    condition: '',
    charge_group: '',
  }
}

type Props = {
  rows: FclSurchargeDraft[]
  defaultCurrency: string
  onChange: (rows: FclSurchargeDraft[]) => void
}

export default function FclSurchargesGrid({ rows, defaultCurrency, onChange }: Props) {
  const { items: chargeCodes } = useChargeCodes()
  const { items: containers } = useContainerTypes()
  const { items: currencies } = useCurrencies()

  function update(key: string, patch: Partial<FclSurchargeDraft>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  function remove(key: string) {
    onChange(rows.filter((r) => r.key !== key))
  }
  function add() {
    onChange([...rows, newSurcharge(defaultCurrency)])
  }
  function onCode(key: string, code: string) {
    const cc = chargeCodes.find((c) => c.code === code)
    const row = rows.find((r) => r.key === key)
    const patch: Partial<FclSurchargeDraft> = { charge_code: code, charge_group: cc?.charge_group ?? '' }
    if (cc && (!row || !row.label.trim())) patch.label = cc.description || code
    update(key, patch)
  }

  return (
    <div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Charge</th><th>Label</th><th>Amount</th><th>Cur</th>
              <th>Basis</th><th>Scope</th><th>Container</th><th>Condition</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="text-muted-foreground pad-inline">No surcharges yet. Add one.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.key}>
                <td>
                  <select className="input input--sm" value={r.charge_code} onChange={(e) => onCode(r.key, e.target.value)}>
                    <option value="">—</option>
                    {chargeCodes.map((c) => (<option key={c.code} value={c.code}>{c.code}</option>))}
                  </select>
                </td>
                <td>
                  <input className="input input--sm" value={r.label} onChange={(e) => update(r.key, { label: e.target.value })} style={{ width: 160 }} placeholder="Description" />
                </td>
                <td>
                  <input className="input input--sm" type="number" inputMode="decimal" value={r.amount} onChange={(e) => update(r.key, { amount: e.target.value })} style={{ width: 90 }} />
                </td>
                <td>
                  <select className="input input--sm" value={r.currency_code} onChange={(e) => update(r.key, { currency_code: e.target.value })}>
                    <option value="">—</option>
                    {currencies.map((c) => (<option key={c.code} value={c.code}>{c.code}</option>))}
                  </select>
                </td>
                <td>
                  <select className="input input--sm" value={r.basis} onChange={(e) => update(r.key, { basis: e.target.value })}>
                    {BASES.map((b) => (<option key={b.v} value={b.v}>{b.label}</option>))}
                  </select>
                </td>
                <td>
                  <select className="input input--sm" value={r.scope} onChange={(e) => update(r.key, { scope: e.target.value })}>
                    <option value="">—</option>
                    {SCOPES.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}
                  </select>
                </td>
                <td>
                  <select className="input input--sm" value={r.container_type} onChange={(e) => update(r.key, { container_type: e.target.value })}>
                    <option value="">—</option>
                    {containers.map((c) => (<option key={c.code} value={c.code}>{c.code}</option>))}
                  </select>
                </td>
                <td>
                  <input className="input input--sm" value={r.condition} onChange={(e) => update(r.key, { condition: e.target.value })} style={{ width: 140 }} placeholder="—" />
                </td>
                <td>
                  <button type="button" onClick={() => remove(r.key)} aria-label="Remove surcharge"
                    style={{ display: 'inline-flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#B23B3B', padding: 4 }}>
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn" style={{ marginTop: 10 }} onClick={add}>
        <Plus size={15} strokeWidth={2} /> Add surcharge
      </button>
    </div>
  )
}
