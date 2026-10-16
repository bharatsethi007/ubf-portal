import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { GP_FLOOR, UNIT, allIn, computeSell, laneKey, lineGp, money, type Line, type MarginMethod, type Product, type Rule } from './rateCardModel'
import type { Watch } from './rateCardsApi'

type Props = {
  lines: Line[]; editable: boolean; rules: Partial<Record<Product, Rule>>; fx: Record<string, number>
  watch: Map<string, Watch>; liveNow: Map<string, { value: number; currency: string | null; ref: string | null }>
  onChange: (idx: number, patch: Partial<Line>) => void; onRemove: (idx: number) => void
}

const METHODS: { key: MarginMethod; label: string }[] = [
  { key: 'rule', label: 'Rule' }, { key: 'pct', label: '%' }, { key: 'flat', label: '$/unit' }, { key: 'sell', label: 'Sell' },
]
const num = (v: string) => (v.trim() === '' ? null : Number(v))
const cell = 'h-7 w-[76px] rounded-md border border-[#E6E8EE] px-2 text-right text-[12.5px] tabular-nums'

/** Lanes grouped by mode. Margin edits recompute freight sell; hidden lanes stay for reference. */
export default function RateCardLanes({ lines, editable, rules, fx, watch, liveNow, onChange, onRemove }: Props) {
  const groups = (['FCL', 'LCL', 'AIR'] as Product[]).map((p) => ({ p, rows: lines.map((l, i) => ({ l, i })).filter((x) => x.l.product === p) })).filter((g) => g.rows.length)

  function setMargin(i: number, l: Line, method: MarginMethod, value: number | null) {
    const next = { ...l, margin_method: method, margin_value: method === 'sell' ? null : value }
    onChange(i, { margin_method: method, margin_value: next.margin_value, freight_sell: method === 'sell' ? l.freight_sell : computeSell(next, rules[l.product] ?? null) })
  }

  if (!lines.length) return <p className="m-0 px-[18px] py-8 text-center text-[12.5px] text-[#5B6474]">No lanes yet. Add them from carrier rates or by hand.</p>

  return (
    <div className="table-wrap">
      <table className="data-table" style={{ minWidth: 1180 }}>
        <thead><tr>
          <th style={{ width: 30 }} aria-label="Show" /><th>Lane</th><th>Unit</th><th>Priced from</th>
          <th style={{ textAlign: 'right' }}>Buy</th><th>Margin</th><th style={{ textAlign: 'right' }}>Freight</th>
          <th style={{ textAlign: 'right' }}>Origin</th><th style={{ textAlign: 'right' }}>Dest</th><th style={{ textAlign: 'right' }}>All-in</th>
          <th style={{ textAlign: 'right' }}>GP</th><th style={{ textAlign: 'right' }}>Live now</th><th>Transit</th>{editable && <th aria-label="Remove" />}
        </tr></thead>
        <tbody>
          {groups.map((g) => [
            <tr key={g.p}><td colSpan={editable ? 14 : 13} className="bg-[#F8FAFF] text-[11.5px] font-medium text-[#0A2472]">{g.p} · {UNIT[g.p]} · {g.rows.length} lane{g.rows.length > 1 ? 's' : ''}</td></tr>,
            ...g.rows.map(({ l, i }) => {
              const gp = lineGp(l)
              const w = l.id ? watch.get(l.id) : undefined
              const up = w?.current_buy != null && l.buy != null && Number(w.current_buy) > Number(l.buy)
              const live = liveNow.get(laneKey(l))
              const ai = allIn(l, fx)
              return (
                <tr key={l.id ?? `n${i}`} style={{ opacity: l.show ? 1 : 0.5 }}>
                  <td><input type="checkbox" checked={l.show} disabled={!editable} aria-label="Show on rate card" onChange={(e) => onChange(i, { show: e.target.checked })} /></td>
                  <td className="whitespace-nowrap font-mono text-[12px]">{l.origin_code} &gt; {l.dest_code}</td>
                  <td className="whitespace-nowrap text-[#334155]">{l.product === 'FCL' ? l.container_type : UNIT[l.product].replace('per ', '')}</td>
                  <td className="max-w-[200px]">
                    {l.source_card_id
                      ? <Link to={`/setup/rates/${l.source_table}/${l.source_card_id}`} className="block truncate text-[11.5px] text-[#0A2472]" title={w?.source_title ?? ''}>{w?.source_title ?? 'Carrier rate'}</Link>
                      : <span className="text-[11.5px] text-[#5B6474]">Manual</span>}
                    {up && <div className="text-[10.5px] text-[#B42318]">Buy now {money(w!.current_buy, l.buy_currency)}</div>}
                  </td>
                  <td className="text-right tabular-nums text-[#5B6474]">{money(l.buy)}</td>
                  <td className="whitespace-nowrap">
                    {editable ? (
                      <span className="inline-flex items-center gap-1">
                        <select className="h-7 rounded-md border border-[#E6E8EE] px-1 text-[12px]" value={l.margin_method}
                          onChange={(e) => setMargin(i, l, e.target.value as MarginMethod, l.margin_value)}>
                          {METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                        </select>
                        {l.margin_method === 'pct' || l.margin_method === 'flat'
                          ? <input className={cell} style={{ width: 60 }} value={l.margin_value ?? ''} aria-label="Margin" onChange={(e) => setMargin(i, l, l.margin_method, num(e.target.value))} />
                          : null}
                      </span>
                    ) : <span className="text-[12px] text-[#334155]">{l.margin_method === 'rule' ? 'Rule' : l.margin_method === 'sell' ? 'Set sell' : l.margin_method === 'pct' ? `${l.margin_value}%` : `+${l.margin_value}`}</span>}
                  </td>
                  <td className="text-right">
                    {editable && l.margin_method === 'sell'
                      ? <input className={`${cell} border-[#2E5BFF] bg-[#F5F8FF]`} value={l.freight_sell ?? ''} aria-label="Freight sell" onChange={(e) => onChange(i, { freight_sell: num(e.target.value) })} />
                      : <span className="tabular-nums">{money(l.freight_sell, null, l.product === 'FCL' ? 0 : 2)}</span>}
                  </td>
                  <td className="text-right">{editable
                    ? <input className={cell} value={l.origin_sell ?? ''} aria-label="Origin charges" onChange={(e) => onChange(i, { origin_sell: num(e.target.value) })} />
                    : <span className="tabular-nums">{money(l.origin_sell)}</span>}<div className="text-[10px] text-[#5B6474]">{l.origin_currency ?? l.sell_currency}</div></td>
                  <td className="text-right">{editable
                    ? <input className={cell} value={l.dest_sell ?? ''} aria-label="Destination charges" onChange={(e) => onChange(i, { dest_sell: num(e.target.value) })} />
                    : <span className="tabular-nums">{money(l.dest_sell)}</span>}<div className="text-[10px] text-[#5B6474]">{l.dest_currency ?? l.sell_currency}</div></td>
                  <td className="text-right font-medium tabular-nums">{ai == null ? '–' : money(ai, l.sell_currency, l.product === 'FCL' ? 0 : 2)}</td>
                  <td className="text-right tabular-nums" style={{ color: gp == null ? undefined : gp < GP_FLOOR ? '#B42318' : '#067647' }}>{gp == null ? '–' : `${gp}%`}</td>
                  <td className="text-right tabular-nums text-[#5B6474]" title={live?.ref ?? ''}>{live ? money(live.value, live.currency) : '–'}</td>
                  <td className="whitespace-nowrap text-[#5B6474]">{l.transit_days ? `${l.transit_days}d` : '–'}{l.via ? ` · ${l.via}` : ''}</td>
                  {editable && <td><button type="button" className="text-[#98A2B3] hover:text-[#B42318]" aria-label="Remove lane" onClick={() => onRemove(i)}><Trash2 size={14} /></button></td>}
                </tr>
              )
            }),
          ])}
        </tbody>
      </table>
    </div>
  )
}
