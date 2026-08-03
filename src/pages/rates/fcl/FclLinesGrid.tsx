import { Plus, Trash2 } from 'lucide-react'
import { useSeaPorts } from '../../../hooks/useSeaPorts'
import { useContainerTypes, useCurrencies } from '../../../hooks/useQuoteRefData'
import type { FclLineDraft } from '../ratesApi'

let tmpSeq = 0
export function newFclLine(defaultCurrency: string): FclLineDraft {
  tmpSeq += 1
  return {
    key: `tmp-${tmpSeq}`,
    dbId: null,
    origin_port_code: '',
    dest_port_code: '',
    container_type: '',
    base_rate: '',
    currency_code: defaultCurrency,
    transit_days: '',
    via: '',
  }
}

type Props = {
  lines: FclLineDraft[]
  defaultCurrency: string
  onChange: (lines: FclLineDraft[]) => void
}

export default function FclLinesGrid({ lines, defaultCurrency, onChange }: Props) {
  const { ports } = useSeaPorts()
  const { items: containers } = useContainerTypes()
  const { items: currencies } = useCurrencies()

  function update(key: string, patch: Partial<FclLineDraft>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  function remove(key: string) {
    onChange(lines.filter((l) => l.key !== key))
  }
  function add() {
    onChange([...lines, newFclLine(defaultCurrency)])
  }

  return (
    <div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Origin</th><th>Destination</th><th>Container</th>
              <th>Base rate</th><th>Cur</th><th>Transit (d)</th><th>Via</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={8} className="text-muted-foreground pad-inline">No lines yet. Add a lane rate.</td></tr>
            ) : lines.map((l) => (
              <tr key={l.key}>
                <td>
                  <select className="input input--sm" value={l.origin_port_code} onChange={(e) => update(l.key, { origin_port_code: e.target.value })}>
                    <option value="">—</option>
                    {ports.map((p) => (<option key={p.code} value={p.code}>{p.code} · {p.name}</option>))}
                  </select>
                </td>
                <td>
                  <select className="input input--sm" value={l.dest_port_code} onChange={(e) => update(l.key, { dest_port_code: e.target.value })}>
                    <option value="">—</option>
                    {ports.map((p) => (<option key={p.code} value={p.code}>{p.code} · {p.name}</option>))}
                  </select>
                </td>
                <td>
                  <select className="input input--sm" value={l.container_type} onChange={(e) => update(l.key, { container_type: e.target.value })}>
                    <option value="">—</option>
                    {containers.map((c) => (<option key={c.code} value={c.code}>{c.code}</option>))}
                  </select>
                </td>
                <td>
                  <input className="input input--sm" type="number" inputMode="decimal" value={l.base_rate} onChange={(e) => update(l.key, { base_rate: e.target.value })} style={{ width: 100 }} />
                </td>
                <td>
                  <select className="input input--sm" value={l.currency_code} onChange={(e) => update(l.key, { currency_code: e.target.value })}>
                    <option value="">—</option>
                    {currencies.map((c) => (<option key={c.code} value={c.code}>{c.code}</option>))}
                  </select>
                </td>
                <td>
                  <input className="input input--sm" type="number" value={l.transit_days} onChange={(e) => update(l.key, { transit_days: e.target.value })} style={{ width: 70 }} />
                </td>
                <td>
                  <input className="input input--sm" value={l.via} onChange={(e) => update(l.key, { via: e.target.value })} style={{ width: 120 }} placeholder="—" />
                </td>
                <td>
                  <button type="button" onClick={() => remove(l.key)} aria-label="Remove line"
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
        <Plus size={15} strokeWidth={2} /> Add line
      </button>
    </div>
  )
}
