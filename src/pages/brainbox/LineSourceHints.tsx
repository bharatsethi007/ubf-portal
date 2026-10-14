import type { QuoteResponseLine } from '../quotes/quoteResponseLinesApi'
import { statKey, statMapKey, unitClass, type ChargeStat } from './brainboxApi'
import { SOURCE_CHIP, SOURCE_GROUP, GROUP_META, money } from './sourceMeta'

/** Small chip in the description cell: where this line's price came from. */
export function LineSourceChip({ line }: { line: QuoteResponseLine }) {
  const text = SOURCE_CHIP[line.rate_source]
  if (!text) return null
  const g = GROUP_META[SOURCE_GROUP[line.rate_source] ?? 'manual']
  return (
    <span className="shrink-0 rounded px-1.5 py-px text-[10px] leading-4" style={{ background: g.chipBg, color: g.chipFg }}
      title={line.rate_source === 'manual' ? 'Typed by hand, no rate card' : `Priced from ${g.label.toLowerCase()}`}>
      {text}
    </span>
  )
}

const pctTxt = (a: number, b: number) => (b > 0 ? `${a >= b ? '+' : ''}${(((a - b) / b) * 100).toFixed(1)}%` : '')

/**
 * One line under the Sell input. Card lines compare with the card's sell;
 * hand-typed lines compare with what the team usually charges.
 */
export function LineSellHint({ line, code, stats }: { line: QuoteResponseLine; code: string; stats: Map<string, ChargeStat> }) {
  const sell = Number(line.sell_rate)
  const sugg = line.suggested_sell.trim() ? Number(line.suggested_sell) : null
  const sysLine = line.rate_source !== 'manual' && line.rate_source !== 'legacy'

  if (sysLine && sugg != null) {
    const changed = line.sell_rate.trim() !== '' && sell !== sugg
    return (
      <div className={`mt-0.5 text-right text-[10px] leading-3 ${changed ? 'text-[#8A4A17]' : 'text-[#8A93A5]'}`}
        title={changed ? `Card sell ${money(sugg)}, now ${money(sell)} (${pctTxt(sell, sugg)})` : 'Card price kept'}>
        {changed ? `card ${money(sugg)} ${pctTxt(sell, sugg)}` : 'card'}
      </div>
    )
  }

  // Freight is lane-priced and weight-driven totals vary, so only stable team prices are shown.
  if (!line.description.trim() || line.charge_group === 'freight') return null
  const s = stats.get(statMapKey(statKey(code, line.description), line.sell_currency || 'NZD', unitClass(line.unit)))
  if (!s || s.n_quotes < 3 || (s.pattern !== 'fixed' && s.pattern !== 'mostly')) return null
  const out = line.sell_rate.trim() !== '' && Math.abs(sell - s.mode_val) > 0.2 * s.mode_val
  const fixed = s.pattern === 'fixed'
  const text = fixed ? `always ${money(s.mode_val)}` : `usual ${money(s.mode_val)}`
  const tip = `${s.label}: ${money(s.mode_val)} ${s.currency} on ${Math.round(s.mode_share * 100)}% of ${s.n_quotes} quotes, range ${money(s.mn)} to ${money(s.mx)}`
  return (
    <div className={`mt-0.5 text-right text-[10px] leading-3 ${out ? 'text-[#8A4A17]' : fixed ? 'text-[#0F7A4F]' : 'text-[#8A93A5]'}`} title={tip}>
      {text}
    </div>
  )
}
