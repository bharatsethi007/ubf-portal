import { Plus, Trash2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useCurrencies } from '../../../hooks/useQuoteRefData'
import type { AirLineDraft } from '../airRatesApi'
import AirportCell from './AirportCell'

function rowStyle(c?: string): CSSProperties | undefined {
  if (c === 'red') return { background: 'rgba(220,38,38,0.08)' }
  if (c === 'amber') return { background: 'rgba(245,158,11,0.10)' }
  return undefined
}

let tmpSeq = 0
export function newAirLine(defaultCurrency: string): AirLineDraft {
  tmpSeq += 1
  return {
    key: `tmp-${tmpSeq}`, dbId: null,
    origin_port_code: '', dest_port_code: '',
    min_charge: '', rate_n: '', rate_45: '', rate_100: '', rate_250: '', rate_500: '', rate_1000: '',
    markup_pct: '', currency_code: defaultCurrency,
    transit_days: '', via: '', frequency: '',
  }
}

const RATE_FIELDS: { k: keyof AirLineDraft; label: string; w: number }[] = [
  { k: 'min_charge', label: 'Min', w: 74 },
  { k: 'rate_n', label: 'N (<45)', w: 76 },
  { k: 'rate_45', label: '+45', w: 66 },
  { k: 'rate_100', label: '+100', w: 66 },
  { k: 'rate_250', label: '+250', w: 66 },
  { k: 'rate_500', label: '+500', w: 66 },
  { k: 'rate_1000', label: '+1000', w: 70 },
]

type Props = { lines: AirLineDraft[]; defaultCurrency: string; defaultMarkupPct?: number | null; onChange: (lines: AirLineDraft[]) => void }

export default function AirLinesGrid({ lines, defaultCurrency, defaultMarkupPct, onChange }: Props) {
  const { items: currencies } = useCurrencies()
  function update(key: string, patch: Partial<AirLineDraft>) { onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l))) }
  function remove(key: string) { onChange(lines.filter((l) => l.key !== key)) }
  function add() { onChange([...lines, newAirLine(defaultCurrency)]) }

  const mkPlaceholder = defaultMarkupPct != null && !isNaN(defaultMarkupPct) ? String(defaultMarkupPct) : '—'

  return (
    <div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Origin</th><th>Destination</th>
              {RATE_FIELDS.map((f) => (<th key={f.k as string} title={`${f.label} — per kg`}>{f.label}</th>))}
              <th title="Sell markup % — overrides card default">Mk %</th>
              <th>Cur</th><th>Transit (d)</th><th>Freq</th><th>Via</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={15} className="text-muted-foreground pad-inline">No lines yet. Add a lane rate.</td></tr>
            ) : lines.map((l) => (
              <tr key={l.key} style={rowStyle(l.confidence)} title={l.confidence && l.confidence !== 'green' ? (l.note || (l.raw_origin ? `Sheet said: ${l.raw_origin}` : '')) : undefined}>
                <td><AirportCell value={l.origin_port_code} onChange={(code) => update(l.key, { origin_port_code: code })} /></td>
                <td><AirportCell value={l.dest_port_code} onChange={(code) => update(l.key, { dest_port_code: code })} /></td>
                {RATE_FIELDS.map((f) => (
                  <td key={f.k as string}>
                    <input className="input input--sm" type="number" inputMode="decimal" value={(l[f.k] as string) ?? ''} onChange={(e) => update(l.key, { [f.k]: e.target.value } as Partial<AirLineDraft>)} style={{ width: f.w }} placeholder="—" />
                  </td>
                ))}
                <td><input className="input input--sm" type="number" inputMode="decimal" value={l.markup_pct ?? ''} onChange={(e) => update(l.key, { markup_pct: e.target.value })} style={{ width: 62 }} placeholder={mkPlaceholder} /></td>
                <td>
                  <select className="input input--sm" value={l.currency_code} onChange={(e) => update(l.key, { currency_code: e.target.value })}>
                    <option value="">—</option>
                    {currencies.map((c) => (<option key={c.code} value={c.code}>{c.code}</option>))}
                  </select>
                </td>
                <td><input className="input input--sm" type="number" value={l.transit_days} onChange={(e) => update(l.key, { transit_days: e.target.value })} style={{ width: 60 }} /></td>
                <td><input className="input input--sm" value={l.frequency} onChange={(e) => update(l.key, { frequency: e.target.value })} style={{ width: 84 }} placeholder="Daily" /></td>
                <td><input className="input input--sm" value={l.via} onChange={(e) => update(l.key, { via: e.target.value })} style={{ width: 84 }} placeholder="—" /></td>
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
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn--inline" onClick={add} aria-label="Add line" title="Add line" style={{ padding: '6px 10px' }}>
          <Plus size={16} strokeWidth={2} />
        </button>
        <span className="text-muted-foreground" style={{ fontSize: 12 }}>Per-kg by weight break; Min is a flat floor. Chargeable weight is applied at quote time.</span>
      </div>
    </div>
  )
}
