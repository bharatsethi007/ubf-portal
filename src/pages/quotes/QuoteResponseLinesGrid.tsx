import { useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, Copy, Trash2, Plus, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import RefSelect from '../../components/common/RefSelect'
import { useChargeUnits, useTaxRates, useCurrencies, useChargeGroups, useChargeCodes } from '../../hooks/useQuoteRefData'
import { useEffectiveRates } from '../../hooks/useEffectiveRates'
import { createChargeCodeAuto } from '../setup/chargeCodesApi'
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
  const { items: groups } = useChargeGroups()
  const { items: chargeCodes, refresh: refreshCodes } = useChargeCodes()
  const { rates: fxRates, loading: fxLoading, reload: reloadFx } = useEffectiveRates(currency)
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [addGroup, setAddGroup] = useState('freight')

  const unitOptions = useMemo(() => units.map((u) => ({ value: u.code, label: u.label })), [units])
  const taxOptions = useMemo(() => taxes.map((t) => ({ value: t.code, label: t.label })), [taxes])
  const curOptions = useMemo(() => currencies.map((c) => ({ value: c.code, label: c.code })), [currencies])
  const groupOptions = useMemo(() => groups.map((g) => ({ value: g.code, label: g.label })), [groups])
  const codeByDesc = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of chargeCodes) m.set(c.description.toLowerCase(), c.charge_group)
    return m
  }, [chargeCodes])

  const round4 = (n: number) => String(Math.round(n * 10000) / 10000)
  function exFor(cur: string, side: 'buy' | 'sell'): string | null {
    if (!cur || cur === currency) return '1'
    const e = fxRates.get(cur)
    if (!e) return null
    return round4(side === 'buy' ? e.buy : e.sell)
  }

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
              <th className="qrl-c-group">Group</th>
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
              <tr><td colSpan={16} className="qrl-empty">No charge lines yet — add one to start pricing.</td></tr>
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
                  <td className="qrl-c-desc">
                    <input className="qrl-in" list="qrl-charge-codes" value={l.description}
                      onChange={(e) => {
                        const v = e.target.value
                        const grp = codeByDesc.get(v.toLowerCase())
                        update(l.id, grp ? { description: v, charge_group: grp } : { description: v })
                      }} />
                    {l.description.trim() && !codeByDesc.has(l.description.trim().toLowerCase()) && (
                      addingFor === l.id ? (
                        <div className="qrl-addcode-row">
                          <RefSelect className="qrl-in" value={addGroup} options={groupOptions} allowEmpty={false}
                            onChange={(v) => setAddGroup(v ?? 'freight')} />
                          <button type="button" className="qrl-iconbtn" aria-label="Save charge code"
                            onClick={async () => {
                              try {
                                await createChargeCodeAuto(l.description, addGroup)
                                await refreshCodes()
                                update(l.id, { charge_group: addGroup })
                                setAddingFor(null)
                                toast.success('Charge code added to Setup')
                              } catch { toast.error('Could not add charge code') }
                            }}><Check size={14} /></button>
                          <button type="button" className="qrl-iconbtn" aria-label="Cancel"
                            onClick={() => setAddingFor(null)}><X size={14} /></button>
                        </div>
                      ) : (
                        <button type="button" className="qrl-addcode-btn"
                          onClick={() => { setAddingFor(l.id); setAddGroup(l.charge_group || 'freight') }}>
                          + Add &ldquo;{l.description.trim()}&rdquo; to charge codes
                        </button>
                      )
                    )}
                  </td>
                  <td className="qrl-c-group"><RefSelect className="qrl-in" value={l.charge_group} options={groupOptions} allowEmpty={false} onChange={(v) => update(l.id, { charge_group: v ?? 'freight' })} /></td>
                  <td className="qrl-c-unit"><RefSelect className="qrl-in" value={l.unit} options={unitOptions} placeholder="Unit" onChange={(v) => update(l.id, { unit: v ?? '' })} /></td>
                  <td className="qrl-c-num">{numInput(l.qty, (v) => update(l.id, { qty: v }))}</td>
                  <td className="qrl-c-cur"><RefSelect className="qrl-in" value={l.buy_currency} options={curOptions} allowEmpty={false}
                    onChange={(v) => {
                      const cur = v ?? currency
                      const ex = exFor(cur, 'buy')
                      update(l.id, { buy_currency: cur, ...(ex != null ? { ex_rate_buy: ex } : {}) })
                    }} /></td>
                  <td className="qrl-c-cur"><RefSelect className="qrl-in" value={l.sell_currency} options={curOptions} allowEmpty={false}
                    onChange={(v) => {
                      const cur = v ?? currency
                      const ex = exFor(cur, 'sell')
                      update(l.id, { sell_currency: cur, ...(ex != null ? { ex_rate_sell: ex } : {}) })
                    }} /></td>
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
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="qrl-add" onClick={addLine}><Plus size={15} /> Add Line</button>
        <button
          type="button"
          className="qrl-add"
          disabled={fxLoading || fxRates.size === 0}
          onClick={() => {
            onChange(lines.map((l) => {
              const eb = exFor(l.buy_currency, 'buy')
              const es = exFor(l.sell_currency, 'sell')
              return {
                ...l,
                ...(eb != null ? { ex_rate_buy: eb } : {}),
                ...(es != null ? { ex_rate_sell: es } : {}),
              }
            }))
            toast.success('Applied live FX rates')
          }}
        >
          Apply live FX
        </button>
      </div>
      <datalist id="qrl-charge-codes">
        {chargeCodes.map((c) => <option key={c.code} value={c.description}>{c.code} — {c.description}</option>)}
      </datalist>
    </div>
  )
}
