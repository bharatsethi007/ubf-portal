import type { IntelOption } from './laneIntelApi'
import type { Credit, RateCardSummary, RateSummary } from './factsApi'
import type { Check } from './quoteChecks'

export type Signal = { id: string; level: 'warn' | 'info'; text: string; sub?: string }

const m = (n: number, ccy?: string | null) => `${ccy ? `${ccy} ` : '$'}${Math.round(n).toLocaleString()}`
const day = (s: string) => new Date(s).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
const num = (s: string) => Number(s) || 0

// 1. Foreign-currency lines left at ex rate 1 on an option in another currency.
function fxSignals(o: IntelOption): Signal[] {
  const bad = new Map<string, number>()
  for (const l of o.lines) {
    if (!l.description.trim()) continue
    const hit = (l.buy_currency && l.buy_currency !== o.currency && num(l.buy_rate) > 0 && num(l.ex_rate_buy) === 1) ? l.buy_currency
      : (l.sell_currency && l.sell_currency !== o.currency && num(l.sell_rate) > 0 && num(l.ex_rate_sell) === 1) ? l.sell_currency : null
    if (hit) bad.set(hit, (bad.get(hit) ?? 0) + 1)
  }
  return [...bad].map(([ccy, n]) => ({ id: `fx-${ccy}`, level: 'warn' as const,
    text: `${n} ${ccy} line${n === 1 ? '' : 's'} at exchange rate 1`, sub: `Option is in ${o.currency}. Totals and margin are wrong until the rate is set.` }))
}

function matchCard(o: IntelOption, live: RateCardSummary[]): RateCardSummary | null {
  const c = (o.carrier || '').toLowerCase()
  if (c) { const hit = live.find((x) => x.carrier.toLowerCase().includes(c) || c.includes(x.carrier.toLowerCase())); if (hit) return hit }
  return [...live].filter((x) => x.validTo).sort((a, b) => (a.validTo! < b.validTo! ? -1 : 1))[0] ?? null
}

// 2. Option validity runs past the rate card it was priced from.
function validitySignal(o: IntelOption, rs: RateSummary | null): Signal | null {
  if (!o.validTill || !rs?.live.length) return null
  const card = matchCard(o, rs.live)
  if (!card?.validTo || o.validTill <= card.validTo) return null
  return { id: 'valid', level: 'warn', text: `Quote valid to ${day(o.validTill)}, ${card.carrier} card ends ${day(card.validTo)}`, sub: 'Shorten validity or add a rate-review clause.' }
}

// 3. Freight buy that matches no live card rate (typo or stale buy).
function buySignal(o: IntelOption, rs: RateSummary | null): Signal | null {
  if (!rs || rs.kind === 'air' || !rs.live.length) return null
  const buys = rs.live.flatMap((c) => c.rows.filter((r) => r.buy != null).map((r) => ({ ccy: c.currency, buy: r.buy!, k: r.k, carrier: c.carrier })))
  for (const l of o.lines) {
    if (l.charge_group !== 'freight' || num(l.buy_rate) <= 0) continue
    const same = buys.filter((b) => b.ccy === l.buy_currency)
    if (!same.length) continue
    const b = num(l.buy_rate)
    if (same.some((x) => Math.abs(x.buy - b) / x.buy <= 0.02)) continue
    const ref = same.slice(0, 3).map((x) => `${x.k} ${m(x.buy, x.ccy)}`).join(' · ')
    return { id: 'buy', level: 'info', text: `Freight buy ${m(b, l.buy_currency)} matches no live card`, sub: `Live: ${ref}` }
  }
  return null
}

// 4. Credit: only signals worth acting on (60+ days overdue, over limit, COD with arrears).
function creditSignals(c: Credit | null, name: string | null): Signal[] {
  if (!c) return []
  const out: Signal[] = []
  const who = name || 'Customer'
  if (c.creditLimit && c.creditLimit > 0 && c.outstanding > c.creditLimit)
    out.push({ id: 'limit', level: 'warn', text: `${who} is over credit limit`, sub: `${m(c.outstanding)} owing on ${m(c.creditLimit)} limit.` })
  if (c.overdue60 > 0)
    out.push({ id: 'od60', level: 'warn', text: `${m(c.overdue60)} overdue 60+ days`, sub: `Oldest ${c.oldestDays} days. Check with accounts before sending.` })
  else if ((c.terms || '').toLowerCase() === 'cod' && c.overdue > 0)
    out.push({ id: 'cod', level: 'warn', text: `COD account with ${m(c.overdue)} overdue`, sub: `${c.invoicesOverdue} invoice${c.invoicesOverdue === 1 ? '' : 's'}, oldest ${c.oldestDays} days.` })
  return out
}

// 5. FCL vs LCL break-even on freight buy (same currency only).
const FIT: [string, number][] = [['20GP', 28], ['40GP', 58], ['40HQ', 68]]
function breakEven(kind: string, cbm: number | null, kg: number | null, fcl: RateSummary | null, lcl: RateSummary | null): Signal | null {
  if (!cbm || cbm < 6 || !fcl?.live.length || !lcl?.live.length) return null
  const wm = Math.max(cbm, (kg ?? 0) / 1000)
  const size = FIT.find(([, cap]) => cbm <= cap)
  if (!size) return null
  const fclOpts = fcl.live.flatMap((c) => c.rows.filter((r) => r.k === size[0] && r.buy != null).map((r) => ({ ccy: c.currency, v: r.buy!, who: c.carrier })))
  const lclOpts = lcl.live.flatMap((c) => c.rows.filter((r) => r.buy != null).map((r) => ({ ccy: c.currency, v: Math.max(r.min ?? 0, r.buy! * wm), who: c.carrier })))
  for (const f of fclOpts.sort((a, b) => a.v - b.v)) {
    const l = lclOpts.filter((x) => x.ccy === f.ccy).sort((a, b) => a.v - b.v)[0]
    if (!l) continue
    if (kind === 'lcl' && f.v < l.v * 0.9)
      return { id: 'be', level: 'info', text: `At ${cbm.toFixed(1)} m³ a ${size[0]} is cheaper than LCL`, sub: `${size[0]} ${m(f.v, f.ccy)} (${f.who}) vs LCL ${m(l.v, l.ccy)}. Freight buy only, check locals.` }
    if (kind === 'fcl' && l.v < f.v * 0.9)
      return { id: 'be', level: 'info', text: `At ${cbm.toFixed(1)} m³ LCL is cheaper than a ${size[0]}`, sub: `LCL ${m(l.v, l.ccy)} (${l.who}) vs ${size[0]} ${m(f.v, f.ccy)}. Freight buy only.` }
    return null
  }
  return null
}

export function buildSignals(p: {
  kind: 'fcl' | 'lcl' | 'air'; option: IntelOption | null; rates: RateSummary | null; otherRates: RateSummary | null
  credit: Credit | null; customerName: string | null; checks: Check[]; cbm: number | null; kg: number | null
}): Signal[] {
  const out: Signal[] = []
  out.push(...creditSignals(p.credit, p.customerName))
  if (p.option) {
    out.push(...fxSignals(p.option))
    const v = validitySignal(p.option, p.rates); if (v) out.push(v)
    const b = buySignal(p.option, p.rates); if (b) out.push(b)
  }
  for (const c of p.checks) if (c.level !== 'ok') out.push({ id: `chk-${c.id}`, level: c.level, text: c.text, sub: c.sub })
  if (p.kind !== 'air') {
    const fcl = p.kind === 'fcl' ? p.rates : p.otherRates
    const lcl = p.kind === 'lcl' ? p.rates : p.otherRates
    const be = breakEven(p.kind, p.cbm, p.kg, fcl, lcl); if (be) out.push(be)
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1))
}
