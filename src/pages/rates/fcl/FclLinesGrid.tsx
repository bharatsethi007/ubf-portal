import type { CSSProperties } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useSeaPorts } from '../../../hooks/useSeaPorts'
import { useContainerTypes, useCurrencies } from '../../../hooks/useQuoteRefData'
import type { FclLineDraft } from '../ratesApi'
import MarginField from '../MarginField'
import { BulkMarginBar, RowBox, SelectAllBox } from '../BulkMarginBar'
import { useLineSelection } from '../useLineSelection'
import { lineMargin, marginText, resolveMargin, suggestSell, type Margin } from '../margin'

function rowStyle(c?: string): CSSProperties | undefined {
  if (c === 'red') return { background: 'rgba(220,38,38,0.08)' }
  if (c === 'amber') return { background: 'rgba(245,158,11,0.10)' }
  return undefined
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
  /** Card default margin (% or fixed per container); lines may override. */
  cardMargin?: Margin | null
  onChange: (lines: FclLineDraft[]) => void
}

const lineText = (l: FclLineDraft) => `${l.origin_port_code} ${l.dest_port_code} ${l.container_type} ${l.via} ${l.currency_code}`

export default function FclLinesGrid({ lines, defaultCurrency, cardMargin = null, onChange }: Props) {
  const sel = useLineSelection(lines, lineText)
  const effective = (l: FclLineDraft) => resolveMargin(lineMargin(l.margin_type, l.margin_value), cardMargin)
  const hasOverride = (l: FclLineDraft) => lineMargin(l.margin_type, l.margin_value) != null
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
    // Auto-fill sell when empty, or when the line has its own margin; never clobber a manual sell otherwise.
    if ((l.sell_rate ?? '') === '' || hasOverride(l)) {
      const sug = suggestSell(v, effective(l))
      if (sug) patch.sell_rate = sug
    }
    update(l.key, patch)
  }
  function onMarginChange(l: FclLineDraft, type: 'pct' | 'fixed', value: string) {
    const next = { ...l, margin_type: type, margin_value: value }
    const sug = suggestSell(l.base_rate, effective(next))
    update(l.key, { margin_type: type, margin_value: value, ...(sug ? { sell_rate: sug } : {}) })
  }
  function fillEmptySells() {
    onChange(lines.map((l) => {
      if ((l.sell_rate ?? '') !== '') return l
      const sug = suggestSell(l.base_rate, effective(l))
      return sug ? { ...l, sell_rate: sug } : l
    }))
  }

  const markupReady = cardMargin != null || lines.some(hasOverride)

  function bulkApply(type: 'pct' | 'fixed', value: number) {
    onChange(lines.map((l) => {
      if (!sel.selected.has(l.key)) return l
      const next = { ...l, margin_type: type, margin_value: String(value) }
      const sug = suggestSell(l.base_rate, effective(next))
      return sug ? { ...next, sell_rate: sug } : next
    }))
  }
  function bulkReset() {
    onChange(lines.map((l) => {
      if (!sel.selected.has(l.key)) return l
      const next: FclLineDraft = { ...l, margin_type: '', margin_value: '' }
      return { ...next, sell_rate: suggestSell(l.base_rate, effective(next)) }
    }))
  }
  return (
    <div>
      <BulkMarginBar total={lines.length} shown={sel.visible.length} selectedCount={sel.selected.size}
        filter={sel.filter} onFilter={sel.setFilter} onApply={bulkApply} onReset={bulkReset} onClearSelection={sel.clear} unit="container" />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}><SelectAllBox all={sel.allVisible} some={sel.someVisible} onToggle={sel.toggleAllVisible} /></th><th>Origin</th><th>Destination</th><th>Container</th>
              <th>Base rate</th><th title="Blank = card default">Markup</th><th>Sell</th><th>Cur</th><th>Margin</th>
              <th>Transit (d)</th><th>Via</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={12} className="text-muted-foreground pad-inline">No lines yet. Add a lane rate.</td></tr>
            ) : sel.visible.map((l) => {
              const m = marginPct(l.base_rate, l.sell_rate ?? '')
              return (
              <tr key={l.key} style={rowStyle(l.confidence)} title={l.confidence && l.confidence !== 'green' ? (l.note || (l.raw_origin ? `Sheet said: ${l.raw_origin}` : '')) : undefined}>
                <td><RowBox checked={sel.selected.has(l.key)} onToggle={(shift) => sel.toggle(l.key, shift)} /></td>
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
                  <MarginField compact type={l.margin_type || cardMargin?.type || 'pct'} value={l.margin_value ?? ''}
                    placeholder={marginText(cardMargin)} onChange={(t, v) => onMarginChange(l, t, v)} />
                </td>
                <td>
                  <input className="input input--sm" type="number" inputMode="decimal" value={l.sell_rate ?? ''} onChange={(e) => update(l.key, { sell_rate: e.target.value })} style={{ width: 100 }} placeholder={suggestSell(l.base_rate, effective(l)) || '—'} />
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
        <button type="button" className="btn btn--inline" onClick={fillEmptySells} disabled={!markupReady || lines.length === 0} title={markupReady ? 'Fill empty Sell cells using each line margin, else the card default' : 'Set a Default margin on the card first'}>
          Fill sell from margin
        </button>
      </div>
    </div>
  )
}
