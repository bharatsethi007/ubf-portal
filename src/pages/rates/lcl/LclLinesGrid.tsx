import type { CSSProperties } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useSeaPorts } from '../../../hooks/useSeaPorts'
import { useCurrencies } from '../../../hooks/useQuoteRefData'
import type { LaneCharge, LclLineDraft } from '../ratesApi'

export function formatLaneCharges(lc: LaneCharge[]): string {
  return (lc ?? []).map((c) => `${c.code}:${c.per_wm}`).join(', ')
}
export function parseLaneCharges(s: string): LaneCharge[] {
  return s.split(',').map((t) => t.trim()).filter(Boolean).map((t) => {
    const [code, amt] = t.split(':').map((x) => (x ?? '').trim())
    const up = (code || '').toUpperCase()
    return { code: up, label: up, per_wm: Number(amt) || 0 }
  }).filter((c) => c.code)
}

function rowStyle(c?: string): CSSProperties | undefined {
  if (c === 'red') return { background: 'rgba(220,38,38,0.08)' }
  if (c === 'amber') return { background: 'rgba(245,158,11,0.10)' }
  return undefined
}

let tmpSeq = 0
export function newLclLine(defaultCurrency: string): LclLineDraft {
  tmpSeq += 1
  return {
    key: `tmp-${tmpSeq}`, dbId: null,
    origin_port_code: '', dest_port_code: '',
    rate_per_wm: '', min_charge: '', currency_code: defaultCurrency,
    transit_days: '', via: '', frequency: '', lane_charges: [],
  }
}

type Props = { lines: LclLineDraft[]; defaultCurrency: string; onChange: (lines: LclLineDraft[]) => void }

export default function LclLinesGrid({ lines, defaultCurrency, onChange }: Props) {
  const { ports } = useSeaPorts()
  const { items: currencies } = useCurrencies()

  function update(key: string, patch: Partial<LclLineDraft>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  function remove(key: string) { onChange(lines.filter((l) => l.key !== key)) }
  function add() { onChange([...lines, newLclLine(defaultCurrency)]) }

  return (
    <div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Origin</th><th>Destination</th><th>Rate /WM</th><th>Min</th><th>Cur</th>
              <th>Transit (d)</th><th>Freq</th><th>Via</th><th>Charges /WM</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={10} className="text-muted-foreground pad-inline">No lines yet. Add a lane rate.</td></tr>
            ) : lines.map((l) => (
              <tr key={l.key} style={rowStyle(l.confidence)} title={l.confidence && l.confidence !== 'green' ? (l.note || (l.raw_origin ? `Sheet said: ${l.raw_origin}` : '')) : undefined}>
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
                  <input className="input input--sm" type="number" inputMode="decimal" value={l.rate_per_wm} onChange={(e) => update(l.key, { rate_per_wm: e.target.value })} style={{ width: 90 }} />
                </td>
                <td>
                  <input className="input input--sm" type="number" inputMode="decimal" value={l.min_charge} onChange={(e) => update(l.key, { min_charge: e.target.value })} style={{ width: 80 }} placeholder="—" />
                </td>
                <td>
                  <select className="input input--sm" value={l.currency_code} onChange={(e) => update(l.key, { currency_code: e.target.value })}>
                    <option value="">—</option>
                    {currencies.map((c) => (<option key={c.code} value={c.code}>{c.code}</option>))}
                  </select>
                </td>
                <td>
                  <input className="input input--sm" type="number" value={l.transit_days} onChange={(e) => update(l.key, { transit_days: e.target.value })} style={{ width: 60 }} />
                </td>
                <td>
                  <input className="input input--sm" value={l.frequency} onChange={(e) => update(l.key, { frequency: e.target.value })} style={{ width: 90 }} placeholder="Weekly" />
                </td>
                <td>
                  <input className="input input--sm" value={l.via} onChange={(e) => update(l.key, { via: e.target.value })} style={{ width: 110 }} placeholder="—" />
                </td>
                <td>
                  <input className="input input--sm" value={formatLaneCharges(l.lane_charges)} onChange={(e) => update(l.key, { lane_charges: parseLaneCharges(e.target.value) })} style={{ width: 130 }} placeholder="BAF:13, LSS:5" title="Per-w/m surcharges as CODE:amount, comma-separated" />
                </td>
                <td>
                  <button type="button" onClick={() => remove(l.key)} aria-label="Remove line" style={{ display: 'inline-flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#B23B3B', padding: 4 }}>
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn btn--inline" onClick={add} aria-label="Add line" title="Add line" style={{ marginTop: 10, padding: '6px 10px' }}>
        <Plus size={16} strokeWidth={2} />
      </button>
    </div>
  )
}
