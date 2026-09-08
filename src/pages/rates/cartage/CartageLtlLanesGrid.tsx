import type { CSSProperties } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import type { CartageZone, CartageBand } from '../../cartage/cartageApi'
import type { CartageLtlLaneDraft } from './cartageRatesApi'

function rowStyle(c?: string): CSSProperties | undefined {
  if (c === 'red') return { background: 'rgba(220,38,38,0.08)' }
  if (c === 'amber') return { background: 'rgba(245,158,11,0.10)' }
  return undefined
}

let tmpSeq = 0
export function newCartageLtlLane(): CartageLtlLaneDraft {
  tmpSeq += 1
  return {
    key: `tmp-ltl-${tmpSeq}`,
    dbId: null,
    direction: 'export',
    origin_zone_id: '',
    dest_zone_id: '',
    min_charge: '',
    per_cbm: '',
    band_rates: {},
  }
}

type Props = {
  lanes: CartageLtlLaneDraft[]
  zones: CartageZone[]
  bands: CartageBand[]
  onChange: (lanes: CartageLtlLaneDraft[]) => void
  onSave: () => void
  saving: boolean
}

export default function CartageLtlLanesGrid({ lanes, zones, bands, onChange, onSave, saving }: Props) {
  function update(key: string, patch: Partial<CartageLtlLaneDraft>) {
    onChange(lanes.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  function setBand(l: CartageLtlLaneDraft, bandId: string, v: string) {
    update(l.key, { band_rates: { ...l.band_rates, [bandId]: v } })
  }
  function remove(key: string) {
    onChange(lanes.filter((l) => l.key !== key))
  }
  function add() {
    onChange([...lanes, newCartageLtlLane()])
  }

  return (
    <div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Direction</th><th>Origin zone</th><th>Dest zone</th>
              <th>Min charge</th><th>Per CBM</th>
              {bands.map((b) => (<th key={b.id} title={`${b.min_kg}–${b.max_kg ?? '+'} kg`}>{b.band_code} $/kg</th>))}
              <th aria-label="Actions" style={{ width: 50 }} />
            </tr>
          </thead>
          <tbody>
            {lanes.length === 0 ? (
              <tr><td colSpan={6 + bands.length} className="text-muted-foreground pad-inline">No LTL lanes yet. Add a lane.</td></tr>
            ) : lanes.map((l) => (
              <tr key={l.key} style={rowStyle(l.confidence)} title={l.confidence && l.confidence !== 'green' ? (l.note || [l.raw_origin, l.raw_dest].filter(Boolean).join(' → ')) : undefined}>
                <td>
                  <select className="input input--sm" style={{ width: 110 }} value={l.direction} onChange={(e) => update(l.key, { direction: e.target.value as 'import' | 'export' })}>
                    <option value="export">export</option>
                    <option value="import">import</option>
                  </select>
                </td>
                <td>
                  <select className="input input--sm" style={{ width: 180 }} value={l.origin_zone_id} onChange={(e) => update(l.key, { origin_zone_id: e.target.value })}>
                    <option value="">—</option>
                    {zones.map((z) => (<option key={z.id} value={z.id}>{z.zone_code} · {z.name}</option>))}
                  </select>
                </td>
                <td>
                  <select className="input input--sm" style={{ width: 180 }} value={l.dest_zone_id} onChange={(e) => update(l.key, { dest_zone_id: e.target.value })}>
                    <option value="">—</option>
                    {zones.map((z) => (<option key={z.id} value={z.id}>{z.zone_code} · {z.name}</option>))}
                  </select>
                </td>
                <td>
                  <input className="input input--sm" type="number" inputMode="decimal" value={l.min_charge} onChange={(e) => update(l.key, { min_charge: e.target.value })} style={{ width: 90 }} placeholder="—" />
                </td>
                <td>
                  <input className="input input--sm" type="number" inputMode="decimal" value={l.per_cbm} onChange={(e) => update(l.key, { per_cbm: e.target.value })} style={{ width: 90 }} placeholder="—" />
                </td>
                {bands.map((b) => (
                  <td key={b.id}>
                    <input className="input input--sm" type="number" inputMode="decimal" value={l.band_rates[b.id] ?? ''} onChange={(e) => setBand(l, b.id, e.target.value)} style={{ width: 80 }} placeholder="—" />
                  </td>
                ))}
                <td>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" className="icon-btn" onClick={() => remove(l.key)} aria-label="Remove lane">
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
        <button type="button" className="btn btn--inline" title="Add lane" aria-label="Add lane" style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={add}>
          <Plus size={16} strokeWidth={2} />
        </button>
        <button type="button" className="btn btn--inline" title="Save LTL lanes" aria-label="Save LTL lanes" style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={onSave} disabled={saving}>
          <Save size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
