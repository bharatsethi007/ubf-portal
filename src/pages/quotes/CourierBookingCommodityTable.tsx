import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { newCommodityLine, type CourierCommodityLine } from './courierBookingTypes'

type Props = {
  lines: CourierCommodityLine[]
  onChange: (lines: CourierCommodityLine[]) => void
}

function patchLine(lines: CourierCommodityLine[], id: string, patch: Partial<CourierCommodityLine>) {
  return lines.map((r) => (r.id === id ? { ...r, ...patch } : r))
}

export default function CourierBookingCommodityTable({ lines, onChange }: Props) {
  let total = 0
  for (const l of lines) total += (Number(l.qty) || 0) * (Number(l.value) || 0)

  function update(id: string, patch: Partial<CourierCommodityLine>) {
    onChange(patchLine(lines, id, patch))
  }

  function remove(id: string) {
    const next = lines.filter((r) => r.id !== id)
    onChange(next.length ? next : [newCommodityLine()])
  }

  return (
    <div className="cbf-section">
      <table className="cbf-commodity-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>HS code</th>
            <th>Qty</th>
            <th>Value</th>
            <th>Cur</th>
            <th>Origin</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((row) => (
            <tr key={row.id}>
              <td><input value={row.description} onChange={(e) => update(row.id, { description: e.target.value })} /></td>
              <td><input value={row.hsCode} onChange={(e) => update(row.id, { hsCode: e.target.value })} /></td>
              <td><input inputMode="numeric" value={row.qty} onChange={(e) => update(row.id, { qty: e.target.value })} /></td>
              <td><input inputMode="decimal" value={row.value} onChange={(e) => update(row.id, { value: e.target.value })} /></td>
              <td>
                <select value={row.currency} onChange={(e) => update(row.id, { currency: e.target.value })}>
                  {['NZD', 'USD', 'AUD', 'EUR', 'GBP'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td><input value={row.countryOfManufacture} maxLength={2} onChange={(e) => update(row.id, { countryOfManufacture: e.target.value.toUpperCase() })} /></td>
              <td>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove line" onClick={() => remove(row.id)}>
                  <X size={14} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, newCommodityLine()])}>
          <Plus size={14} /> Add line
        </Button>
        <span className="cbf-label">Total declared value: <strong style={{ color: '#0A2472' }}>{total.toFixed(2)}</strong></span>
      </div>
    </div>
  )
}
