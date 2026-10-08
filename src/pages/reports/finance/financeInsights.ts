import type { AgingRow, FlagRow, ForecastRow, KpiRow } from './financeApi'
import { compact, growth, monthLabel, pct, ratio, type ServiceLine, type Totals } from './financeUtil'

export type Tone = 'good' | 'warn' | 'bad' | 'info'
export type Insight = { tone: Tone; title: string; body: string }

type Input = {
  cur: Totals; prev: Totals | null; periodLabel: string
  slCur: ServiceLine[]; slPrev: ServiceLine[]
  kpis: KpiRow[]; aging: AgingRow[]; forecast: ForecastRow[]; flags: FlagRow[]
}

// Rule-based CFO commentary. Every sentence is computed from the ledger, nothing is invented.
export function buildInsights(x: Input): Insight[] {
  const out: Insight[] = []
  const { cur, prev } = x
  const gm = ratio(cur.gp, cur.revenue)

  if (prev && prev.revenue) {
    const g = growth(cur.revenue, prev.revenue)!
    const gpG = growth(cur.gp, prev.gp)!
    const pgm = ratio(prev.gp, prev.revenue)
    out.push({
      tone: gpG >= 0 ? 'good' : 'bad',
      title: `Revenue ${g >= 0 ? 'up' : 'down'} ${pct(Math.abs(g))}, gross profit ${gpG >= 0 ? 'up' : 'down'} ${pct(Math.abs(gpG))}`,
      body: `${x.periodLabel}: revenue ${compact(cur.revenue)} vs ${compact(prev.revenue)} last year. Gross margin ${pct(gm)} vs ${pct(pgm)} (${gm != null && pgm != null ? `${(gm - pgm >= 0 ? '+' : '')}${(gm - pgm).toFixed(1)} pts` : ''}). Gross profit, not revenue, is the number to manage: freight rates move revenue without moving profit.`,
    })
    const oxG = growth(cur.opex, prev.opex)
    if (oxG != null) {
      const lev = gpG - oxG
      out.push({
        tone: lev >= 0 ? 'good' : 'warn',
        title: lev >= 0 ? 'Positive operating leverage' : 'Overheads growing faster than gross profit',
        body: `Overheads ${oxG >= 0 ? 'up' : 'down'} ${pct(Math.abs(oxG))} against gross profit ${gpG >= 0 ? 'up' : 'down'} ${pct(Math.abs(gpG))}. ${lev >= 0 ? 'Each extra dollar of GP is dropping through to profit.' : 'Profit growth will lag until cost growth is brought below GP growth.'}`,
      })
    }
  } else if (gm != null) {
    out.push({ tone: 'info', title: `Gross margin ${pct(gm)}`, body: `${x.periodLabel}: revenue ${compact(cur.revenue)}, gross profit ${compact(cur.gp)}. No prior-year comparison in the synced window.` })
  }

  const peoplePct = ratio(cur.people, cur.gp)
  if (peoplePct != null) {
    out.push({
      tone: peoplePct > 65 ? 'bad' : peoplePct > 55 ? 'warn' : 'good',
      title: `People cost is ${pct(peoplePct, 0)} of gross profit`,
      body: `Staff cost ${compact(cur.people)}. Forwarders typically run 50 to 60% of GP on people. ${peoplePct > 55 ? 'Above that range: check productivity per head (jobs or GP per staff member) before adding headcount.' : 'Within a healthy range.'}`,
    })
  }
  const premPct = ratio(cur.premises, cur.gp)
  if (premPct != null && premPct > 0) {
    out.push({
      tone: premPct > 20 ? 'warn' : 'info',
      title: `Premises cost ${pct(premPct, 0)} of gross profit`,
      body: `Rent and premises ${compact(cur.premises)}. Rent is the second-largest fixed cost; any rent paid to a related party should be benchmarked to market.`,
    })
  }
  const conv = ratio(cur.ebit, cur.gp)
  if (conv != null) {
    out.push({
      tone: conv >= 25 ? 'good' : conv >= 10 ? 'info' : 'bad',
      title: `Operating profit converts ${pct(conv, 0)} of gross profit`,
      body: `EBIT ${compact(cur.ebit)}${cur.adj ? ` after ${compact(cur.adj)} of job costs not yet posted in TradeWindow` : ''}. Strong forwarders convert 25 to 35% of GP to EBIT. Depreciation and tax are not posted in the ledger, so true net profit is lower.`,
    })
  }

  // service lines
  const sl = x.slCur.filter((s) => s.revenue > 0)
  const totGp = sl.reduce((a, s) => a + s.gp, 0)
  if (sl.length && totGp) {
    const top = sl[0]
    out.push({ tone: 'info', title: `${top.line} earns ${pct(ratio(top.gp, totGp), 0)} of gross profit`,
      body: sl.slice(0, 4).map((s) => `${s.line} ${compact(s.gp)} at ${pct(s.margin, 0)}`).join(' · ') })
    const prevMap = new Map(x.slPrev.map((s) => [s.line, s]))
    const moves = sl.map((s) => ({ s, d: s.gp - (prevMap.get(s.line)?.gp ?? 0) })).filter((m) => prevMap.has(m.s.line))
    if (moves.length) {
      moves.sort((a, b) => a.d - b.d)
      const worst = moves[0], best = moves[moves.length - 1]
      if (best.d > 0) out.push({ tone: 'good', title: `${best.s.line} GP up ${compact(best.d)} on last year`, body: 'Largest gross-profit gain of any service line.' })
      if (worst.d < 0) out.push({ tone: 'warn', title: `${worst.s.line} GP down ${compact(-worst.d)} on last year`, body: 'Largest gross-profit decline. Check rates, volumes and cost recovery on this line.' })
    }
    const thin = sl.filter((s) => s.margin != null && s.margin < 15 && s.revenue > 100000)
    if (thin.length) out.push({ tone: 'warn', title: 'Thin-margin lines', body: thin.map((s) => `${s.line} ${pct(s.margin, 0)}`).join(', ') + '. Volume without margin ties up cash in receivables.' })
  }

  // receivables
  const ar = x.aging.filter((a) => a.total > 0)
  const arTot = ar.reduce((a, r) => a + r.total, 0)
  const billed = x.aging.reduce((a, r) => a + r.billed_12m, 0)
  if (arTot && billed) {
    const dso = (arTot / billed) * 365
    const over = ar.reduce((a, r) => a + r.d31_60 + r.d61_90 + r.d90_plus, 0)
    out.push({ tone: dso > 45 ? 'warn' : 'good', title: `Debtor days ${dso.toFixed(0)}`,
      body: `${compact(arTot)} owed by customers, ${pct(ratio(over, arTot), 0)} more than 30 days overdue. Billing includes duty and GST recharged to clients, so this is cash UBF has fronted.` })
    const top10 = [...x.aging].sort((a, b) => b.billed_12m - a.billed_12m).slice(0, 10)
    const share = ratio(top10.reduce((a, r) => a + r.billed_12m, 0), billed)
    if (share != null) out.push({ tone: share > 50 ? 'warn' : 'info', title: `Top 10 customers are ${pct(share, 0)} of billing`,
      body: top10.slice(0, 3).map((r) => r.name || r.accountid).join(', ') + ' lead. Concentration above 50% makes cash flow depend on a few payers.' })
  }

  // cash
  const sorted = [...x.kpis].sort((a, b) => a.month.localeCompare(b.month))
  const last = sorted[sorted.length - 1]
  if (last) {
    const recent = sorted.slice(-3)
    const fixed = recent.reduce((a, k) => a + k.opex, 0) / Math.max(1, recent.length)
    const cover = fixed ? last.cash / fixed : null
    out.push({ tone: cover != null && cover < 2 ? 'warn' : 'good', title: `Cash ${compact(last.cash)} at ${monthLabel(last.month)}`,
      body: cover != null ? `Covers ${cover.toFixed(1)} months of overheads (${compact(fixed)} a month).` : '' })
  }
  if (x.forecast.length) {
    const low = x.forecast.reduce((m, r) => (r.closing < m.closing ? r : m), x.forecast[0])
    out.push({ tone: low.closing < 250000 ? 'bad' : low.closing < 500000 ? 'warn' : 'info',
      title: `Forecast cash low ${compact(low.closing)} in week of ${new Date(low.week_start).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}`,
      body: 'From open invoices, supplier bills and recent run-rates. Supplier and customs payments fall due ahead of customer receipts.' })
  }

  for (const f of x.flags) {
    if (f.code === 'open_month') out.push({ tone: 'bad', title: 'Latest month not closed', body: `As of today ${compact(f.amount ?? 0)} of supplier invoices are not yet costed to jobs. Reports add the month-end amount back as "Job costs not yet posted".` })
    if (f.code === 'related_party') out.push({ tone: 'warn', title: `Related-party advances ${compact(f.amount ?? 0)}`, body: f.detail })
  }
  return out
}
