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

function suggestedSell(buy: string, markup?: number | null): string {
  const b = Number(buy)
  if (!buy || isNaN(b) || markup == null || isNaN(markup)) return ''
  return String(Math.round(b * (1 + markup / 100) * 100) / 100)
}
function marginPct(buy: string, sell: string): number | null {
  const b = Number(buy)
  const s = Number(sell)
  if (!buy || !sell || isNaN(b) || isNaN(s) || s === 0) return null
  return Math.round(((s - b) / s) * 1000) / 10
}
function marginColor(m: number | null): string {
  if (m == null) return 'var(--muted-foreground)'
  if (m <= 0) return '#B23B3B'
  if (m < 15) return '#B4791F'
  return '#1F8A4C'
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
    rate_per_wm: '', sell_per_wm: '', min_charge: '', sell_min: '', currency_code: defaultCurrency,
    transit_days: '', via: '', frequency: '', lane_charges: [],
  }
}

type Props = { lines: LclLineDraft[]; defaultCurrency: string; defaultMarkupPct?: number | null; onChange: (lines: LclLineDraft[]) => void }

export default function LclLinesGrid({ lines, defaultCurrency, defaultMarkupPct, onChange }: Props) {
  const { ports } = useSeaPorts()
  const { items: currencies } = useCurrencies()

  function update(key: string, patch: Partial<LclLineDraft>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  function remove(key: string) { onChange(lines.filter((l) => l.key !== key)) }
  function add() { onChange([...lines, newLclLine(defaultCurrency)]) }
  function onWmChange(l: LclLineDraft, v: string) {
    const patch: Partial<LclLineDraft> = { rate_per_wm: v }
    if ((l.sell_per_wm ?? '') === '') {
      const sug = suggestedSell(v, defaultMarkupPct)
      if (sug) patch.sell_per_wm = sug
    }
    update(l.key, patch)
  }
  function onMinChange(l: LclLineDraft, v: string) {
    const patch: Partial<LclLineDraft> = { min_charge: v }
    if ((l.sell_min ?? '') === '') {
      const sug = suggestedSell(v, defaultMarkupPct)
      if (sug) patch.sell_min = sug
    }
    update(l.key, patch)
  }
  function fillEmptySells() {
    onChange(lines.map((l) => {
      const next = { ...l }
      if ((next.sell_per_wm ?? '') === '') { const s = suggestedSell(next.rate_per_wm, defaultMarkupPct); if (s) next.sell_per_wm = s }
      if ((next.sell_min ?? '') === '') { const s = suggestedSell(next.min_charge, defaultMarkupPct); if (s) next.sell_min = s }
      return next
    }))
  }

  const markupReady = defaultMarkupPct != null && !isNaN(defaultMarkupPct)

  return (
    <div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Origin</th><th>Destination</th><th>Rate /WM</th><th>Sell /WM</th><th>Min</th><th>Sell min</th><th>Cur</th><th>Margin</th>
              <th>Transit (d)</th><th>Freq</th><th>Via</th><th>Charges /WM</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={13} className="text-muted-foreground pad-inline">No lines yet. Add a lane rate.</td></tr>
            ) : lines.map((l) => {
              const m = marginPct(l.rate_per_wm, l.sell_per_wm ?? '')
              return (
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
                  <input className="input input--sm" type="number" inputMode="decimal" value={l.rate_per_wm} onChange={(e) => onWmChange(l, e.target.value)} style={{ width: 90 }} />
                </td>
                <td>
                  <input className="input input--sm" type="number" inputMode="decimal" value={l.sell_per_wm ?? ''} onChange={(e) => update(l.key, { sell_per_wm: e.target.value })} style={{ width: 90 }} placeholder={markupReady ? suggestedSell(l.rate_per_wm, defaultMarkupPct) || '—' : '—'} />
                </td>
                <td>
                  <input className="input input--sm" type="number" inputMode="decimal" value={l.min_charge} onChange={(e) => onMinChange(l, e.target.value)} style={{ width: 80 }} placeholder="—" />
                </td>
                <td>
                  <input className="input input--sm" type="number" inputMode="decimal" value={l.sell_min ?? ''} onChange={(e) => update(l.key, { sell_min: e.target.value })} style={{ width: 80 }} placeholder={markupReady ? suggestedSell(l.min_charge, defaultMarkupPct) || '—' : '—'} />
                </td>
                <td>
                  <select className="input input--sm" value={l.currency_code} onChange={(e) => update(l.key, { currency_code: e.target.value })}>
                    <option value="">—</option>
                    {currencies.map((c) => (<option key={c.code} value={c.code}>{c.code}</option>))}
                  </select>
                </td>
                <td style={{ color: marginColor(m), fontVariantNumeric: 'tabular-nums', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {m == null ? '—' : `${m.toFixed(1)}%`}
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
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn--inline" onClick={add} aria-label="Add line" title="Add line" style={{ padding: '6px 10px' }}>
          <Plus size={16} strokeWidth={2} />
        </button>
        <button type="button" className="btn btn--inline" onClick={fillEmptySells} disabled={!markupReady || lines.length === 0} title={markupReady ? 'Fill empty Sell cells using the card markup' : 'Set a Default markup % on the card first'}>
          Fill sell from markup
        </button>
      </div>
    </div>
  )
}
