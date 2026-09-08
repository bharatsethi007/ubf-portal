import type { CSSProperties } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import type { CartageZone } from '../../cartage/cartageApi'
import type { CartageFclLineDraft } from './cartageRatesApi'

function rowStyle(c?: string): CSSProperties | undefined {
  if (c === 'red') return { background: 'rgba(220,38,38,0.08)' }
  if (c === 'amber') return { background: 'rgba(245,158,11,0.10)' }
  return undefined
}

let tmpSeq = 0
export function newCartageFclLine(): CartageFclLineDraft {
  tmpSeq += 1
  return {
    key: `tmp-fcl-${tmpSeq}`,
    dbId: null,
    direction: 'export',
    origin_zone_id: '',
    dest_zone_id: '',
    container_size: '',
    base_rate: '',
    min_charge: '',
  }
}

type Props = {
  lines: CartageFclLineDraft[]
  zones: CartageZone[]
  onChange: (lines: CartageFclLineDraft[]) => void
  onSave: () => void
  saving: boolean
}

export default function CartageFclLinesGrid({ lines, zones, onChange, onSave, saving }: Props) {
  function update(key: string, patch: Partial<CartageFclLineDraft>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  function remove(key: string) {
    onChange(lines.filter((l) => l.key !== key))
  }
  function add() {
    onChange([...lines, newCartageFclLine()])
  }

  return (
    <div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Direction</th><th>Origin zone</th><th>Dest zone</th><th>Size</th>
              <th>Base rate</th><th>Min charge</th><th aria-label="Actions" style={{ width: 50 }} />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={7} className="text-muted-foreground pad-inline">No FCL lines yet. Add a lane.</td></tr>
            ) : lines.map((l) => (
              <tr key={l.key} style={rowStyle(l.confidence)} title={l.confidence && l.confidence !== 'green' ? (l.note || [l.raw_origin, l.raw_dest].filter(Boolean).join(' → ')) : undefined}>
                <td>
                  <select className="input input--sm" style={{ width: 110 }} value={l.direction} onChange={(e) => update(l.key, { direction: e.target.value as 'import' | 'export' })}>
                    <option value="export">export</option>
                    <option value="import">import</option>
                  </select>
                </td>
                <td>
                  <select className="input input--sm" style={{ width: 190 }} value={l.origin_zone_id} onChange={(e) => update(l.key, { origin_zone_id: e.target.value })}>
                    <option value="">—</option>
                    {zones.map((z) => (<option key={z.id} value={z.id}>{z.zone_code} · {z.name}</option>))}
                  </select>
                </td>
                <td>
                  <select className="input input--sm" style={{ width: 190 }} value={l.dest_zone_id} onChange={(e) => update(l.key, { dest_zone_id: e.target.value })}>
                    <option value="">—</option>
                    {zones.map((z) => (<option key={z.id} value={z.id}>{z.zone_code} · {z.name}</option>))}
                  </select>
                </td>
                <td>
                  <select className="input input--sm" style={{ width: 80 }} value={l.container_size} onChange={(e) => update(l.key, { container_size: e.target.value })}>
                    <option value="">—</option>
                    <option value="20">20</option>
                    <option value="40">40</option>
                  </select>
                </td>
                <td>
                  <input className="input input--sm" type="number" inputMode="decimal" value={l.base_rate} onChange={(e) => update(l.key, { base_rate: e.target.value })} style={{ width: 100 }} />
                </td>
                <td>
                  <input className="input input--sm" type="number" inputMode="decimal" value={l.min_charge} onChange={(e) => update(l.key, { min_charge: e.target.value })} style={{ width: 100 }} placeholder="—" />
                </td>
                <td>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" className="icon-btn" onClick={() => remove(l.key)} aria-label="Remove line">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <button type="button" className="btn btn--inline" title="Add line" aria-label="Add line" style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={add}>
          <Plus size={16} strokeWidth={2} />
        </button>
        <button type="button" className="btn btn--inline" title="Save FCL lines" aria-label="Save FCL lines" style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={onSave} disabled={saving}>
          <Save size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
