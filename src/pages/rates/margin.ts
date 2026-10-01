// Rate card margin rules, shared by FCL / LCL / Air cards, grids and rate search.
//
// A card has a default margin: a % on cost, or a fixed amount per unit
// (per container for FCL, per W/M for LCL, per kg for air). Any line can override it.
// Sell resolution: explicit line sell > line margin > card margin > cost.

export type MarginType = 'pct' | 'fixed'
export type Margin = { type: MarginType; value: number }

const num = (v: unknown): number | null => {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Card default margin from its columns, or null when none is set. */
export function cardMargin(card: {
  default_margin_type?: string | null
  default_markup_pct?: number | string | null
  default_margin_fixed?: number | string | null
}): Margin | null {
  if (card.default_margin_type === 'fixed') {
    const v = num(card.default_margin_fixed)
    return v == null ? null : { type: 'fixed', value: v }
  }
  const v = num(card.default_markup_pct)
  return v == null ? null : { type: 'pct', value: v }
}

/** Line override, or null to fall back to the card default. */
export function lineMargin(type: string | null | undefined, value: unknown): Margin | null {
  const v = num(value)
  if (v == null) return null
  return { type: type === 'fixed' ? 'fixed' : 'pct', value: v }
}

export function resolveMargin(line: Margin | null, card: Margin | null): Margin | null {
  return line ?? card
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Cost + margin. Fixed is added once per unit; % multiplies. */
export function applyMargin(cost: number, m: Margin | null): number {
  if (!m || !m.value) return cost
  return round2(m.type === 'fixed' ? cost + m.value : cost * (1 + m.value / 100))
}

/** Sell suggestion for a buy cell (string in, string out) for the line grids. */
export function suggestSell(buy: string, m: Margin | null): string {
  const b = num(buy)
  if (b == null || !m) return ''
  return String(applyMargin(b, m))
}

export function marginText(m: Margin | null, unit = ''): string {
  if (!m) return '—'
  return m.type === 'fixed' ? `+${m.value}${unit ? ` ${unit}` : ''}` : `${m.value}%`
}
