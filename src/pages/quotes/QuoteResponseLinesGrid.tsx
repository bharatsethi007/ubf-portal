import { useMemo } from 'react'
import { ChevronUp, ChevronDown, Copy, Trash2, Plus } from 'lucide-react'
import RefSelect from '../../components/common/RefSelect'
import { useChargeUnits, useTaxRates, useCurrencies } from '../../hooks/useQuoteRefData'
import { computeResponseLine, newQuoteResponseLine, type QuoteResponseLine } from './quoteResponseLinesApi'
import './quoteResponseLinesGrid.css'

type Props = {
  lines: QuoteResponseLine[]
  currency: string
  onChange: (lines: QuoteResponseLine[]) => void
}

function fmt(n: number): string {
  return n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function QuoteResponseLinesGrid({ lines, currency, onChange }: Props) {
  const { items: units } = useChargeUnits()
  const { items: taxes } = useTaxRates()
  const { items: currencies } = useCurrencies()

  const unitOptions = useMemo(() => units.map((u) => ({ value: u.code, label: u.label })), [units])
  const taxOptions = useMemo(() => taxes.map((t) => ({ value: t.code, label: t.label })), [taxes])
  const curOptions = useMemo(() => currencies.map((c) => ({ value: c.code, label: c.code })), [currencies])

  function update(id: string, patch: Partial<QuoteResponseLine>) {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }
  function addLine() {
    onChange([...lines, newQuoteResponseLine(lines.length, currency)])
  }
  function copyLine(id: string) {
    const idx = lines.findIndex((l) => l.id === id)
    if (idx < 0) return
    const dup = { ...lines[idx], id: crypto.randomUUID() }
    const next = [...lines]
    next.splice(idx + 1, 0, dup)
    onChange(next)
  }
  function removeLine(id: string) {
    onChange(lines.filter((l) => l.id !== id))
  }
  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= lines.length) return
    const next = [...lines]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    onChange(next)
  }

  const numInput = (value: string, onCh: (v: string) => void) => (
    <input type="number" className="qrl-in qrl-num" value={value} onChange={(e) => onCh(e.target.value)} />
  )

  return (
    <div className="qrl-wrap">
      <div className="qrl-scroll">
        <table className="qrl-table">
          <thead>
            <tr>
              <th className="qrl-c-act">Actions</th>
              <th className="qrl-c-desc">Description</th>
              <th className="qrl-c-unit">Unit</th>
              <th className="qrl-c-num">Qty</th>
              <th className="qrl-c-cur">Buy Cur</th>
              <th className="qrl-c-cur">Sell Cur</th>
              <th className="qrl-c-num">Min Buy</th>
              <th className="qrl-c-num">Min Sell</th>
              <th className="qrl-c-num">Buy</th>
              <th className="qrl-c-num">Sell</th>
              <th className="qrl-c-tax">Tax</th>
              <th className="qrl-c-num">Ex Buy</th>
              <th className="qrl-c-num">Ex Sell</th>
              <th className="qrl-c-total">Total Buy</th>
              <th className="qrl-c-total">Total Sell</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={15} className="qrl-empty">No charge lines yet — add one to start pricing.</td></tr>
            ) : lines.map((l, idx) => {
              const c = computeResponseLine(l)
              return (
                <tr key={l.id}>
                  <td className="qrl-c-act">
                    <div className="qrl-actions">
                      <button type="button" className="qrl-iconbtn" aria-label="Move up" disabled={idx === 0} onClick={() => move(idx, -1)}><ChevronUp size={14} /></button>
                      <button type="button" className="qrl-iconbtn" aria-label="Move down" disabled={idx === lines.length - 1} onClick={() => move(idx, 1)}><ChevronDown size={14} /></button>
                      <button type="button" className="qrl-iconbtn" aria-label="Copy" onClick={() => copyLine(l.id)}><Copy size={14} /></button>
                      <button type="button" className="qrl-iconbtn qrl-iconbtn--danger" aria-label="Delete" onClick={() => removeLine(l.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                  <td className="qrl-c-desc"><input className="qrl-in" value={l.description} onChange={(e) => update(l.id, { description: e.target.value })} /></td>
                  <td className="qrl-c-unit"><RefSelect className="qrl-in" value={l.unit} options={unitOptions} placeholder="Unit" onChange={(v) => update(l.id, { unit: v ?? '' })} /></td>
                  <td className="qrl-c-num">{numInput(l.qty, (v) => update(l.id, { qty: v }))}</td>
                  <td className="qrl-c-cur"><RefSelect className="qrl-in" value={l.buy_currency} options={curOptions} allowEmpty={false} onChange={(v) => update(l.id, { buy_currency: v ?? currency })} /></td>
                  <td className="qrl-c-cur"><RefSelect className="qrl-in" value={l.sell_currency} options={curOptions} allowEmpty={false} onChange={(v) => update(l.id, { sell_currency: v ?? currency })} /></td>
                  <td className="qrl-c-num">{numInput(l.min_buy, (v) => update(l.id, { min_buy: v }))}</td>
                  <td className="qrl-c-num">{numInput(l.min_sell, (v) => update(l.id, { min_sell: v }))}</td>
                  <td className="qrl-c-num">{numInput(l.buy_rate, (v) => update(l.id, { buy_rate: v }))}</td>
                  <td className="qrl-c-num">{numInput(l.sell_rate, (v) => update(l.id, { sell_rate: v }))}</td>
                  <td className="qrl-c-tax"><RefSelect className="qrl-in" value={l.tax} options={taxOptions} placeholder="Tax" onChange={(v) => update(l.id, { tax: v ?? '' })} /></td>
                  <td className="qrl-c-num">{numInput(l.ex_rate_buy, (v) => update(l.id, { ex_rate_buy: v }))}</td>
                  <td className="qrl-c-num">{numInput(l.ex_rate_sell, (v) => update(l.id, { ex_rate_sell: v }))}</td>
                  <td className="qrl-c-total"><input className="qrl-in qrl-in--ro" value={fmt(c.totalBuy)} readOnly tabIndex={-1} /></td>
                  <td className="qrl-c-total"><input className="qrl-in qrl-in--ro" value={fmt(c.totalSell)} readOnly tabIndex={-1} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button type="button" className="qrl-add" onClick={addLine}><Plus size={15} /> Add Line</button>
    </div>
  )
}
