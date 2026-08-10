import type { CSSProperties } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useSeaPorts } from '../../../hooks/useSeaPorts'
import { useContainerTypes, useCurrencies } from '../../../hooks/useQuoteRefData'
import type { FclLineDraft } from '../ratesApi'

function rowStyle(c?: string): CSSProperties | undefined {
  if (c === 'red') return { background: 'rgba(220,38,38,0.08)' }
  if (c === 'amber') return { background: 'rgba(245,158,11,0.10)' }
  return undefined
}

function suggestedSell(buy: string, markup: number | null | undefined): string {
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
    sell_rate: '',
    currency_code: defaultCurrency,
    transit_days: '',
    via: '',
  }
}

type Props = {
  lines: FclLineDraft[]
  defaultCurrency: string
  defaultMarkupPct?: number | null
  onChange: (lines: FclLineDraft[]) => void
}

export default function FclLinesGrid({ lines, defaultCurrency, defaultMarkupPct, onChange }: Props) {
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
  function onBuyChange(l: FclLineDraft, v: string) {
    const patch: Partial<FclLineDraft> = { base_rate: v }
    // Only auto-fill sell when it's still empty — never clobber a manual sell.
    if ((l.sell_rate ?? '') === '') {
      const sug = suggestedSell(v, defaultMarkupPct)
      if (sug) patch.sell_rate = sug
    }
    update(l.key, patch)
  }
  function fillEmptySells() {
    onChange(lines.map((l) => {
      if ((l.sell_rate ?? '') !== '') return l
      const sug = suggestedSell(l.base_rate, defaultMarkupPct)
      return sug ? { ...l, sell_rate: sug } : l
    }))
  }

  const markupReady = defaultMarkupPct != null && !isNaN(defaultMarkupPct)

  return (
    <div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Origin</th><th>Destination</th><th>Container</th>
              <th>Base rate</th><th>Sell</th><th>Cur</th><th>Margin</th>
              <th>Transit (d)</th><th>Via</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={10} className="text-muted-foreground pad-inline">No lines yet. Add a lane rate.</td></tr>
            ) : lines.map((l) => {
              const m = marginPct(l.base_rate, l.sell_rate ?? '')
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
                  <select className="input input--sm" value={l.container_type} onChange={(e) => update(l.key, { container_type: e.target.value })}>
                    <option value="">—</option>
                    {containers.map((c) => (<option key={c.code} value={c.code}>{c.code}</option>))}
                  </select>
                </td>
                <td>
                  <input className="input input--sm" type="number" inputMode="decimal" value={l.base_rate} onChange={(e) => onBuyChange(l, e.target.value)} style={{ width: 100 }} />
                </td>
                <td>
                  <input className="input input--sm" type="number" inputMode="decimal" value={l.sell_rate ?? ''} onChange={(e) => update(l.key, { sell_rate: e.target.value })} style={{ width: 100 }} placeholder={markupReady ? suggestedSell(l.base_rate, defaultMarkupPct) || '—' : '—'} />
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
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--inline" onClick={add}>
          <Plus size={15} strokeWidth={2} /> Add line
        </button>
        <button type="button" className="btn btn--inline" onClick={fillEmptySells} disabled={!markupReady || lines.length === 0} title={markupReady ? 'Fill empty Sell cells using the card markup' : 'Set a Default markup % on the card first'}>
          Fill sell from markup
        </button>
      </div>
    </div>
  )
}
